import type { FastifyInstance } from "fastify";
import axios from "axios";
import {
  fetchPaystackTransaction,
  initiatePaystackPayment,
  verifyPaystackSignature,
} from "./paystack";
import { confirmDeliveryFeePaid, confirmGoodsPaid } from "./confirm";

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post("/initiate", { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as { orderId?: string; method?: "momo" | "card" };
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

    const profile = await fastify.prisma.profile.findUnique({ where: { id: order.studentId } });
    const reference = `WAVE-${order.id}-${Date.now()}`;

    let authorization_url: string;
    try {
      ({ authorization_url } = await initiatePaystackPayment(fastify.config.PAYSTACK_SECRET_KEY, {
        email: `${profile!.phone}@wave.app`, // students register by phone, not email
        amountGhs: Number(order.totalAmount),
        reference,
        callbackUrl: `${fastify.config.APP_URL}/v1/payments/callback`,
        metadata: { order_id: order.id, student_id: order.studentId },
        channels: channels ? [...channels] : undefined,
      }));
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      request.log.error(err, "Paystack initiate failed");
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
    const body = request.body as { orderId?: string; method?: "momo" | "card" };
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

    const profile = await fastify.prisma.profile.findUnique({ where: { id: order.studentId } });
    const reference = `WAVEGOODS-${order.id}-${Date.now()}`;

    let authorization_url: string;
    try {
      ({ authorization_url } = await initiatePaystackPayment(fastify.config.PAYSTACK_SECRET_KEY, {
        email: profile?.email ?? `${profile!.phone}@wave.app`,
        amountGhs: goodsAmount,
        reference,
        callbackUrl: `${fastify.config.APP_URL}/v1/payments/callback`,
        metadata: { order_id: order.id, student_id: order.studentId, kind: "goods" },
        channels: channels ? [...channels] : undefined,
      }));
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      request.log.error(err, "Paystack goods initiate failed");
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

      const event = request.body as { event: string; data: { reference: string; status: string } };
      if (event.event !== "charge.success") {
        return reply.send({ received: true });
      }

      // A goods charge is the second payment on a suggested-shop order and has
      // its own reference column. It is handled and returned here, before the
      // delivery-fee path below — that path issues a PIN and announces the order
      // to riders, neither of which must happen twice.
      const goodsOrder = await fastify.prisma.order.findUnique({
        where: { goodsPaystackRef: event.data.reference },
        select: { id: true, goodsPaidAt: true, studentId: true, goodsPaystackRef: true },
      });
      // Re-check the reference on the row rather than trusting the lookup to
      // have been the only filter. Belt and braces on the money path: if this
      // branch ever claimed a delivery-fee webhook it would swallow the PIN
      // issue and the rider announcement, and the order would sit paid but
      // unconfirmed with nothing in the logs to say why.
      if (goodsOrder && goodsOrder.goodsPaystackRef === event.data.reference) {
        const { alreadyProcessed } = await confirmGoodsPaid({
          fastify,
          log: request.log,
          orderId: goodsOrder.id,
        });
        return reply.send({ received: true, ...(alreadyProcessed ? { alreadyProcessed } : {}) });
      }

      const order = await fastify.prisma.order.findUnique({
        where: { paystackRef: event.data.reference },
        select: { id: true },
      });
      if (!order) return reply.code(404).send({ error: "Order not found for reference" });

      // All the actual work lives in confirmDeliveryFeePaid, shared with the
      // pull path in GET /verify/:ref so the two can never drift. It is
      // idempotent, which is what makes Paystack's retries safe.
      const { alreadyProcessed } = await confirmDeliveryFeePaid({
        fastify,
        log: request.log,
        orderId: order.id,
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
    log: typeof fastify.log;
  }): Promise<void> {
    let transaction;
    try {
      transaction = await fetchPaystackTransaction(fastify.config.PAYSTACK_SECRET_KEY, args.reference);
    } catch (err) {
      // Never fail the poll on a provider blip — the next one may succeed, and
      // the webhook may land in the meantime.
      args.log.warn({ err: (err as Error).message }, "Paystack verify lookup failed");
      return;
    }
    if (transaction?.status !== "success") return;

    args.log.info(
      { orderId: args.orderId, reference: args.reference },
      "Payment confirmed by polling Paystack — webhook had not arrived",
    );
    if (args.isGoods) {
      await confirmGoodsPaid({ fastify, log: args.log, orderId: args.orderId });
    } else {
      await confirmDeliveryFeePaid({ fastify, log: args.log, orderId: args.orderId });
    }
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
      await reconcileWithPaystack({
        reference: ref,
        isGoods,
        orderId: order.id,
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
  .mark { width:56px; height:56px; border-radius:50%; background:#009933; margin:0 auto 16px;
          display:flex; align-items:center; justify-content:center; }
  h1 { font-size:19px; margin:0 0 8px; letter-spacing:-0.01em; }
  p { font-size:14px; line-height:1.5; color:#6B7D63; margin:0; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" stroke-width="2.2"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h1>Payment received</h1>
    <p>You can close this window and return to Wave. Your order updates automatically.</p>
  </div>
</body>
</html>`);
  });
}
