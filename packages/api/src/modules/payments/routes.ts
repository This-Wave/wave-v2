import type { FastifyInstance } from "fastify";
import {
  fetchPaystackTransaction,
  initiatePaystackPayment,
  paystackCustomerEmail,
  paystackErrorMessage,
  verifyPaystackSignature,
} from "./paystack";
import { paystackMatchesGhs } from "./amounts";
import { confirmDeliveryFeePaid, confirmGoodsPaid } from "./confirm";
import { capturePaymentError, capturePaymentIssue } from "../../lib/sentry";
import { parseCorsOrigins } from "../../config/cors";
import type { Env } from "../../config/env";

const PAYABLE_DELIVERY_STATUSES = ["pending", "payment_pending"] as const;

/** What both initiate routes attach, and Paystack echoes back on the webhook. */
interface PaystackMetadata {
  order_id?: string;
  student_id?: string;
  kind?: string;
}

/**
 * Paystack returns `metadata` as an object on some events and as a JSON string
 * on others, and as an empty string when there was none. Anything unparseable
 * is treated as absent — this is a fallback path, so a bad value must degrade
 * to "no metadata", never throw inside the webhook.
 */
function parsePaystackMetadata(raw: PaystackMetadata | string | undefined): PaystackMetadata | undefined {
  if (!raw) return undefined;
  if (typeof raw !== "string") return raw;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as PaystackMetadata) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A charge that matched its order by metadata rather than by reference — i.e.
 * the student paid on a checkout page whose reference has since been
 * overwritten by another `/initiate`.
 *
 * Recoverable, and recovered: the order is confirmed and the paid reference is
 * written back so a later refund targets the transaction that actually took
 * money. Still worth an alert, because it means a second checkout was opened
 * and may also have been paid.
 */
function reportStaleReference(args: {
  log: { warn: (obj: unknown, msg: string) => void };
  phase: string;
  orderId: string;
  reference: string;
  storedReference: string | null;
}): void {
  args.log.warn(
    { orderId: args.orderId, paidReference: args.reference, storedReference: args.storedReference },
    "Paystack charge matched by metadata — the order carried a newer reference from a re-initiated checkout",
  );
  capturePaymentIssue("Paystack charge paid on a superseded reference", {
    phase: args.phase,
    orderId: args.orderId,
    reference: args.reference,
  });
}

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post("/initiate", { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as {
      orderId?: string;
      method?: "momo" | "card";
      /** Web app origin — Paystack returns the student to this tab after pay. */
      returnOrigin?: string;
    };
    if (!body.orderId) return reply.code(400).send({ error: "orderId is required" });
    // The student already picked a method on the checkout screen; carrying it
    // through means Paystack opens on that channel instead of asking twice.
    const channels =
      body.method === "momo" ? (["mobile_money"] as const)
      : body.method === "card" ? (["card"] as const)
      : undefined;

    const order = await fastify.prisma.order.findUnique({ where: { id: body.orderId } });
    if (!order) return reply.code(404).send({ error: "Order not found" });
    if (order.studentId !== request.user!.id) {
      return reply.code(403).send({ error: "Not your order" });
    }
    if (order.paidAt) {
      return reply.code(409).send({ error: "This order has already been paid" });
    }
    if (!PAYABLE_DELIVERY_STATUSES.includes(order.status as (typeof PAYABLE_DELIVERY_STATUSES)[number])) {
      return reply.code(409).send({ error: "This order cannot be paid in its current state" });
    }

    const amountGhs = Number(order.totalAmount);
    if (!Number.isFinite(amountGhs) || amountGhs <= 0) {
      return reply.code(409).send({ error: "This order has nothing to pay yet" });
    }

    // Never abandon a reference without asking whether it was paid.
    //
    // The row holds at most one reference, so minting a new one orphans the old
    // — and the old checkout page is still live in the student's browser or
    // WebView. Checking first turns the dangerous case (they pay on the old
    // page after we stopped watching it) into an ordinary "already paid", and
    // stops a student being charged twice for one order.
    if (order.paystackRef) {
      const settled = await confirmIfAlreadyPaid({
        reference: order.paystackRef,
        isGoods: false,
        orderId: order.id,
        expectedGhs: amountGhs,
        log: request.log,
      });
      if (settled) {
        return reply.code(409).send({
          error: "This order has already been paid — pull down to refresh.",
        });
      }
    }

    const profile = await fastify.prisma.profile.findUnique({ where: { id: order.studentId } });
    const reference = `WAVE-${order.id}-${Date.now()}`;
    const callbackUrl = paystackCallbackUrl(fastify.config, body.returnOrigin);

    let authorization_url: string;
    try {
      ({ authorization_url } = await initiatePaystackPayment(fastify.config.PAYSTACK_SECRET_KEY, {
        email: paystackCustomerEmail(profile!.phone),
        amountGhs,
        reference,
        callbackUrl,
        metadata: { order_id: order.id, student_id: order.studentId },
        channels: channels ? [...channels] : undefined,
      }));
    } catch (err) {
      const message = paystackErrorMessage(err);
      request.log.error(err, "Paystack initiate failed");
      capturePaymentError(err, { phase: "initiate", orderId: order.id, reference });
      return reply.code(502).send({ error: message ?? "Payment provider error, please try again" });
    }

    await fastify.prisma.order.update({ where: { id: order.id }, data: { paystackRef: reference } });
    return reply.send({ payment_url: authorization_url, reference });
  });

  /**
   * The second charge on a suggested-shop order: the goods.
   *
   * Separate from `/initiate` rather than a flag on it, because the two charges
   * differ in every respect that matters — different amount, different Paystack
   * reference column, different precondition, and a different thing goes wrong
   * if they are confused. Sharing a handler would mean one `if` deciding which
   * of two reference columns to write, on the money path.
   *
   * The amount is `totalAmount - deliveryFee-and-adjustments already paid`,
   * computed here from the order rather than sent by the client.
   */
  fastify.post("/initiate-goods", { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as {
      orderId?: string;
      method?: "momo" | "card";
      returnOrigin?: string;
    };
    if (!body.orderId) return reply.code(400).send({ error: "orderId is required" });
    const channels =
      body.method === "momo" ? (["mobile_money"] as const)
      : body.method === "card" ? (["card"] as const)
      : undefined;

    const order = await fastify.prisma.order.findUnique({ where: { id: body.orderId } });
    if (!order) return reply.code(404).send({ error: "Order not found" });
    if (order.studentId !== request.user!.id) {
      return reply.code(403).send({ error: "Not your order" });
    }
    if (order.orderType !== "shop_pickup") {
      return reply.code(409).send({ error: "This order was paid in full when you placed it" });
    }
    if (order.goodsPaidAt) {
      return reply.code(409).send({ error: "You've already paid for the goods on this order" });
    }

    const goodsAmount = Number(order.itemPrice ?? 0);
    if (goodsAmount <= 0) {
      return reply
        .code(409)
        .send({ error: "Your runner hasn't recorded what the items cost yet" });
    }

    if (order.goodsPaystackRef) {
      const settled = await confirmIfAlreadyPaid({
        reference: order.goodsPaystackRef,
        isGoods: true,
        orderId: order.id,
        expectedGhs: goodsAmount,
        log: request.log,
      });
      if (settled) {
        return reply.code(409).send({
          error: "You've already paid for the goods on this order — pull down to refresh.",
        });
      }
    }

    const profile = await fastify.prisma.profile.findUnique({ where: { id: order.studentId } });
    const reference = `WAVEGOODS-${order.id}-${Date.now()}`;
    const callbackUrl = paystackCallbackUrl(fastify.config, body.returnOrigin);

    let authorization_url: string;
    try {
      ({ authorization_url } = await initiatePaystackPayment(fastify.config.PAYSTACK_SECRET_KEY, {
        email: profile?.email ?? paystackCustomerEmail(profile!.phone),
        amountGhs: goodsAmount,
        reference,
        callbackUrl,
        metadata: { order_id: order.id, student_id: order.studentId, kind: "goods" },
        channels: channels ? [...channels] : undefined,
      }));
    } catch (err) {
      const message = paystackErrorMessage(err);
      request.log.error(err, "Paystack goods initiate failed");
      capturePaymentError(err, { phase: "initiate_goods", orderId: order.id, reference });
      return reply.code(502).send({ error: message ?? "Payment provider error, please try again" });
    }

    await fastify.prisma.order.update({
      where: { id: order.id },
      data: { goodsPaystackRef: reference },
    });
    return reply.send({ payment_url: authorization_url, reference, amountGhs: goodsAmount });
  });

  // Public endpoint — Paystack calls this directly. Signature verification
  // is mandatory before trusting the payload (see Section 10.3).
  fastify.post(
    "/webhook",
    { config: { rawBody: true } },
    async (request, reply) => {
      const signature = request.headers["x-paystack-signature"] as string | undefined;
      const rawBody = request.rawBody!.toString("utf8");

      if (!signature || !verifyPaystackSignature(fastify.config.PAYSTACK_SECRET_KEY, rawBody, signature)) {
        return reply.code(401).send({ error: "Invalid signature" });
      }

      const event = request.body as {
        event: string;
        data: {
          reference: string;
          status: string;
          amount: number;
          currency: string;
          metadata?: PaystackMetadata | string;
        };
      };
      if (event.event !== "charge.success") {
        return reply.send({ received: true });
      }

      // Which order this charge belongs to, when the reference alone cannot say.
      //
      // `/initiate` overwrites `paystackRef` on every call, so a student who
      // opens checkout, backs out, and taps Pay again leaves the FIRST Paystack
      // page live with a reference no longer on any row. Paying on it used to
      // land here, miss both lookups, and get a 404 — Paystack then retries and
      // eventually gives up, leaving a charged card and an order stuck at
      // `payment_pending` with nothing in Sentry to say so.
      //
      // `metadata.order_id` is set by both initiate routes and echoed back by
      // Paystack, so it survives the overwrite. It is safe to trust: this
      // payload's HMAC has already been verified, and the amount is asserted
      // against the order below either way.
      const meta = parsePaystackMetadata(event.data.metadata);

      // A goods charge is the second payment on a suggested-shop order and has
      // its own reference column. It is handled and returned here, before the
      // delivery-fee path below — that path issues a PIN and announces the order
      // to riders, neither of which must happen twice.
      const goodsSelect = {
        id: true,
        goodsPaidAt: true,
        studentId: true,
        goodsPaystackRef: true,
        itemPrice: true,
      } as const;
      let goodsOrder = await fastify.prisma.order.findUnique({
        where: { goodsPaystackRef: event.data.reference },
        select: goodsSelect,
      });
      let goodsByMetadata = false;
      if (!goodsOrder && meta?.kind === "goods" && meta.order_id) {
        goodsOrder = await fastify.prisma.order.findUnique({
          where: { id: meta.order_id },
          select: goodsSelect,
        });
        goodsByMetadata = !!goodsOrder;
      }
      // Re-check the reference on the row rather than trusting the lookup to
      // have been the only filter. Belt and braces on the money path: if this
      // branch ever claimed a delivery-fee webhook it would swallow the PIN
      // issue and the rider announcement, and the order would sit paid but
      // unconfirmed with nothing in the logs to say why.
      if (goodsOrder && (goodsByMetadata || goodsOrder.goodsPaystackRef === event.data.reference)) {
        if (goodsByMetadata) {
          reportStaleReference({
            log: request.log,
            phase: "webhook_goods",
            orderId: goodsOrder.id,
            reference: event.data.reference,
            storedReference: goodsOrder.goodsPaystackRef,
          });
        }
        const expectedGoods = Number(goodsOrder.itemPrice ?? 0);
        if (!paystackMatchesGhs(event.data, expectedGoods)) {
          request.log.error(
            { orderId: goodsOrder.id, reference: event.data.reference, expectedGhs: expectedGoods },
            "Paystack goods webhook amount mismatch — refusing to confirm",
          );
          capturePaymentIssue("Paystack goods webhook amount mismatch", {
            phase: "webhook_goods",
            orderId: goodsOrder.id,
            reference: event.data.reference,
            expectedGhs: expectedGoods,
          });
          return reply.code(400).send({ error: "Payment amount mismatch" });
        }
        const { alreadyProcessed } = await confirmGoodsPaid({
          fastify,
          log: request.log,
          orderId: goodsOrder.id,
          reference: event.data.reference,
        });
        return reply.send({ received: true, ...(alreadyProcessed ? { alreadyProcessed } : {}) });
      }

      const deliverySelect = { id: true, totalAmount: true, paystackRef: true } as const;
      let order = await fastify.prisma.order.findUnique({
        where: { paystackRef: event.data.reference },
        select: deliverySelect,
      });
      let deliveryByMetadata = false;
      if (!order && meta?.kind !== "goods" && meta?.order_id) {
        order = await fastify.prisma.order.findUnique({
          where: { id: meta.order_id },
          select: deliverySelect,
        });
        deliveryByMetadata = !!order;
      }
      if (!order) {
        // 200, not 404. A non-2xx makes Paystack retry a payload nothing here
        // will ever match, and after the last retry the event is simply gone.
        // Acknowledging it and raising an alert is the only version of this
        // where a human finds out a charge went unclaimed.
        request.log.error(
          { reference: event.data.reference, metadataOrderId: meta?.order_id },
          "Paystack charge.success matched no order — money taken with nothing to apply it to",
        );
        capturePaymentIssue("Paystack webhook matched no order", {
          phase: "webhook_unmatched",
          reference: event.data.reference,
          ...(meta?.order_id ? { orderId: meta.order_id } : {}),
        });
        return reply.send({ received: true, matched: false });
      }
      if (deliveryByMetadata) {
        reportStaleReference({
          log: request.log,
          phase: "webhook_delivery",
          orderId: order.id,
          reference: event.data.reference,
          storedReference: order.paystackRef,
        });
      }

      if (!paystackMatchesGhs(event.data, Number(order.totalAmount))) {
        request.log.error(
          { orderId: order.id, reference: event.data.reference, expectedGhs: Number(order.totalAmount) },
          "Paystack delivery webhook amount mismatch — refusing to confirm",
        );
        capturePaymentIssue("Paystack delivery webhook amount mismatch", {
          phase: "webhook_delivery",
          orderId: order.id,
          reference: event.data.reference,
          expectedGhs: Number(order.totalAmount),
        });
        return reply.code(400).send({ error: "Payment amount mismatch" });
      }

      // All the actual work lives in confirmDeliveryFeePaid, shared with the
      // pull path in GET /verify/:ref so the two can never drift. It is
      // idempotent, which is what makes Paystack's retries safe.
      const { alreadyProcessed } = await confirmDeliveryFeePaid({
        fastify,
        log: request.log,
        orderId: order.id,
        reference: event.data.reference,
      });

      return reply.send({ received: true, ...(alreadyProcessed ? { alreadyProcessed } : {}) });
    },
  );

  /**
   * Has this order been paid for?
   *
   * The app polls this throughout checkout. It used to read only our own
   * database, which meant it could answer "not paid" forever for a payment that
   * genuinely succeeded — because the ONLY thing that ever set `paidAt` was the
   * webhook. If that webhook never arrives, nothing else ever looks.
   *
   * It never arrives in local development at all: `APP_URL` is `localhost`, and
   * Paystack cannot call a laptop. In production it usually does, but "usually"
   * is not a property you want on the money path — deliveries get delayed,
   * retried past their limit, or dropped.
   *
   * So when our record says unpaid, this asks **Paystack** directly before
   * answering. That call is server-to-server with the secret key, so it is
   * exactly as trustworthy as the webhook; the client contributes nothing but a
   * reference it already had. On a confirmed success it runs the same
   * `confirmDeliveryFeePaid` the webhook runs — issuing the PIN, moving the
   * status, announcing to riders — and the idempotency guard inside means
   * whichever path arrives second is a no-op.
   */
  async function reconcileWithPaystack(args: {
    reference: string;
    isGoods: boolean;
    orderId: string;
    expectedGhs: number;
    log: typeof fastify.log;
  }): Promise<void> {
    await confirmIfAlreadyPaid(args);
  }

  /**
   * Asks Paystack whether one reference was actually paid, and confirms the
   * order if it was. Returns whether the charge is settled.
   *
   * Two callers, same question: the verify poll (which ignores the answer and
   * re-reads the order) and the initiate routes, which must not abandon a
   * reference that already took money.
   */
  async function confirmIfAlreadyPaid(args: {
    reference: string;
    isGoods: boolean;
    orderId: string;
    expectedGhs: number;
    log: typeof fastify.log;
  }): Promise<boolean> {
    let transaction;
    try {
      transaction = await fetchPaystackTransaction(fastify.config.PAYSTACK_SECRET_KEY, args.reference);
    } catch (err) {
      // Never fail the poll on a provider blip — the next one may succeed, and
      // the webhook may land in the meantime. On the initiate path this means
      // checkout proceeds; the webhook's metadata fallback is the net under it.
      args.log.warn({ err: (err as Error).message }, "Paystack verify lookup failed");
      return false;
    }
    if (transaction?.status !== "success") return false;
    if (!paystackMatchesGhs(transaction, args.expectedGhs)) {
      args.log.error(
        { orderId: args.orderId, reference: args.reference, expectedGhs: args.expectedGhs },
        "Paystack verify amount mismatch — refusing to confirm",
      );
      capturePaymentIssue("Paystack verify amount mismatch", {
        phase: args.isGoods ? "verify_goods" : "verify_delivery",
        orderId: args.orderId,
        reference: args.reference,
        expectedGhs: args.expectedGhs,
      });
      return false;
    }

    args.log.info(
      { orderId: args.orderId, reference: args.reference },
      "Payment confirmed by polling Paystack — webhook had not arrived",
    );
    if (args.isGoods) {
      await confirmGoodsPaid({
        fastify,
        log: args.log,
        orderId: args.orderId,
        reference: args.reference,
      });
    } else {
      await confirmDeliveryFeePaid({
        fastify,
        log: args.log,
        orderId: args.orderId,
        reference: args.reference,
      });
    }
    return true;
  }

  fastify.get("/verify/:ref", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { ref } = request.params as { ref: string };

    // Either charge on an order can be polled, so look the reference up in both
    // columns. A goods reference is only ever set on a shop_pickup.
    let order = await fastify.prisma.order.findUnique({ where: { paystackRef: ref } });
    let isGoods = false;
    if (!order) {
      order = await fastify.prisma.order.findUnique({ where: { goodsPaystackRef: ref } });
      isGoods = !!order;
    }

    // 404 rather than 403 on someone else's order: a distinguishable "exists but
    // not yours" would let anyone probe whether a reference is real.
    if (!order || order.studentId !== request.user!.id) {
      return reply.code(404).send({ error: "Order not found" });
    }

    const settled = isGoods ? !!order.goodsPaidAt : !!order.paidAt;
    if (!settled) {
      const expectedGhs = isGoods ? Number(order.itemPrice ?? 0) : Number(order.totalAmount);
      await reconcileWithPaystack({
        reference: ref,
        isGoods,
        orderId: order.id,
        expectedGhs,
        log: request.log,
      });
      const refreshed = await fastify.prisma.order.findUnique({ where: { id: order.id } });
      if (refreshed) order = refreshed;
    }

    return reply.send({
      status: order.status,
      paidAt: isGoods ? order.goodsPaidAt : order.paidAt,
    });
  });

  /**
   * Where Paystack sends the student's browser after checkout.
   *
   * Nothing here is trusted or acted on — the webhook is what confirms an order.
   * This exists purely so the in-app browser lands on a real page instead of a
   * 404, which is what it did before: `callback_url` pointed at a route that was
   * never implemented.
   */
  fastify.get("/callback", async (_request, reply) => {
    return reply.type("text/html; charset=utf-8").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Wave — payment received</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#F3F7EF; color:#10210B; font-family:system-ui,-apple-system,sans-serif; padding:24px; }
  .card { max-width:340px; text-align:center; background:#fff; border:1px solid #DCE8D3;
          border-radius:24px; padding:32px 24px; }
  .mark { width:56px; height:56px; border-radius:50%; background:#87ea5c; margin:0 auto 16px;
          display:flex; align-items:center; justify-content:center; }
  h1 { font-size:19px; margin:0 0 8px; letter-spacing:-0.01em; color:#083400; }
  p { font-size:14px; line-height:1.5; color:#6a6a6a; margin:0; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#083400" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h1>Payment received</h1>
    <p>You can close this and return to Wave. Your order updates automatically.</p>
  </div>
</body>
</html>`);
  });
}

/**
 * Where Paystack should send the browser after checkout.
 *
 * Web same-tab checkout passes the Expo origin so the student lands back in the
 * app (with `?wave_payment=1`); native WebView keeps the API HTML landing page.
 *
 * `returnOrigin` comes from the client, so this is an open-redirect surface: the
 * URL is handed to Paystack, which sends a student's browser to it moments after
 * they have typed a MoMo PIN. The previous condition ended in
 * `origin.startsWith("https://")`, which accepts every host on the internet —
 * directly beneath a comment promising it accepted none. It now matches against
 * `CORS_ORIGINS`, the same allowlist that decides who may call this API, so
 * there is one list to keep current instead of two.
 *
 * The Expo dev hosts stay, but only outside production, where `CORS_ORIGINS` is
 * required and a `.exp.direct` tunnel has no business appearing.
 */
function paystackCallbackUrl(env: Env, returnOrigin?: string): string {
  const fallback = `${env.APP_URL.replace(/\/$/, "")}/v1/payments/callback`;
  if (!returnOrigin) return fallback;
  try {
    const origin = new URL(returnOrigin).origin;
    const host = new URL(origin).hostname;

    const allowed = parseCorsOrigins(env);
    const inAllowlist =
      allowed === true ||
      (Array.isArray(allowed) &&
        allowed.some((entry) => {
          try {
            return new URL(entry).origin === origin;
          } catch {
            return false;
          }
        }));

    const isDevHost =
      env.NODE_ENV !== "production" &&
      (host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith(".exp.direct") ||
        host.endsWith(".expo.dev"));

    if (!inAllowlist && !isDevHost) return fallback;
    return `${origin}/?wave_payment=1`;
  } catch {
    return fallback;
  }
}
