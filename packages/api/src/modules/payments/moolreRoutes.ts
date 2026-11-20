import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ChargeState } from "./charges";
import {
  guessNetwork,
  isMoolreConfigured,
  isMoolreReference,
  mintedAtFromMoolreReference,
  MOOLRE_CHANNELS,
  MOOLRE_DELIVERY_PREFIX,
  MOOLRE_GOODS_PREFIX,
  moolreCollect,
  MoolreNotConfiguredError,
  normaliseGhanaMobile,
  orderIdFromMoolreReference,
  verifyMoolreSignature,
  type CollectOutcome,
  type MoolreChannel,
} from "./moolre";
import { capturePaymentError, capturePaymentIssue } from "../../lib/sentry";
import { PAYMENT_INITIATE_RATE_LIMIT, perAccount } from "../../plugins/rateLimit";

/**
 * How long a MoMo prompt is treated as still on the student's phone. Inside
 * this window a second "Pay" does not send a second prompt: two live prompts
 * for one order is how a student ends up charged twice.
 */
export const MOOLRE_PROMPT_WINDOW_MS = 2 * 60_000;

type CheckCharge = (args: {
  reference: string;
  isGoods: boolean;
  orderId: string;
  expectedGhs: number;
  log: FastifyInstance["log"];
}) => Promise<ChargeState | "unknown">;

export interface MoolreStartArgs {
  request: FastifyRequest;
  reply: FastifyReply;
  orderId: string;
  isGoods: boolean;
  amountGhs: number;
  /** The reference already on the row for this charge, if any. */
  previousRef: string | null;
  /** What the provider said about `previousRef` (already checked by the caller). */
  previousState: ChargeState | "unknown" | null;
  payerPhone?: string | null;
  network?: string;
}

function parseChannel(value: string | undefined): MoolreChannel | null {
  const upper = value?.trim().toUpperCase();
  if (upper === "VODAFONE") return "TELECEL";
  if (upper === "AIRTELTIGO") return "AT";
  return MOOLRE_CHANNELS.find((c) => c === upper) ?? null;
}

const NOT_READY = {
  error: "Mobile Money is not set up yet. Please pay by card or try again later.",
  code: "momo_not_ready",
};

export function registerMoolreRoutes(fastify: FastifyInstance, deps: { checkCharge: CheckCharge }) {
  /** Writes the reference and payer for one leg (delivery fee or goods). */
  async function saveCharge(orderId: string, isGoods: boolean, reference: string, payer: string, channel: MoolreChannel) {
    await fastify.prisma.order.update({
      where: { id: orderId },
      data: isGoods
        ? { goodsPaystackRef: reference, goodsMomoPayer: payer, goodsMomoNetwork: channel }
        : { paystackRef: reference, momoPayer: payer, momoNetwork: channel },
    });
  }

  /** Turns a collection answer into the reply the app acts on. */
  function replyFor(
    reply: FastifyReply,
    outcome: CollectOutcome,
    ctx: { reference: string; payer: string; channel: MoolreChannel },
  ) {
    const base = { provider: "moolre" as const, reference: ctx.reference, payer: ctx.payer, network: ctx.channel };
    // "unknown" means the prompt may well be on the phone. The app waits and
    // polls; the status lookup decides, never a resend.
    switch (outcome.kind) {
      case "prompt_sent":
      case "duplicate":
      case "unknown":
      case "otp_verified":
        return reply.send({ ...base, next: "approve" });
      case "otp_required":
        return reply.send({ ...base, next: "otp" });
      case "otp_wrong":
        return reply.code(400).send({ error: "That code is not right. Check the SMS and try again.", code: "otp_wrong" });
      case "rejected":
        return reply.code(502).send({ error: outcome.message, code: outcome.code });
    }
  }

  function failed(reply: FastifyReply, request: FastifyRequest, err: unknown, meta: { phase: string; orderId: string; reference: string }) {
    if (err instanceof MoolreNotConfiguredError) return reply.code(503).send(NOT_READY);
    request.log.error(err, "Moolre request failed");
    capturePaymentError(err, meta);
    return reply.code(502).send({
      error: "We couldn't reach Mobile Money just now. Check your phone in case a prompt arrived, then try again.",
    });
  }

  /**
   * Starts a Moolre MoMo charge for one leg of an order. Both initiate routes
   * call this once they have checked ownership, state and the amount.
   */
  async function start(args: MoolreStartArgs) {
    const { request, reply } = args;
    const payer = normaliseGhanaMobile(args.payerPhone ?? "");
    if (!payer) {
      return reply.code(400).send({ error: "Enter a Ghana Mobile Money number, like 024 123 4567.", code: "bad_number" });
    }
    const channel = parseChannel(args.network) ?? guessNetwork(payer);
    if (!channel) {
      return reply.code(400).send({ error: "Pick your Mobile Money network.", code: "pick_network" });
    }
    if (!isMoolreConfigured(fastify.config)) return reply.code(503).send(NOT_READY);

    // A prompt from a moment ago may still be on the phone. Point the app at
    // it instead of sending another.
    if (
      args.previousRef &&
      isMoolreReference(args.previousRef) &&
      (args.previousState === "pending" || args.previousState === "unknown")
    ) {
      const minted = mintedAtFromMoolreReference(args.previousRef);
      if (minted && Date.now() - minted.getTime() < MOOLRE_PROMPT_WINDOW_MS) {
        return reply.code(409).send({
          error: "A payment request is already on your phone. Approve it, or try again in a minute.",
          code: "prompt_pending",
          reference: args.previousRef,
        });
      }
    }

    const reference = `${args.isGoods ? MOOLRE_GOODS_PREFIX : MOOLRE_DELIVERY_PREFIX}${args.orderId}-${Date.now()}`;
    // Saved before Moolre is called, so a prompt that goes out while this
    // process dies is still findable by the verify poll and the sweep.
    await saveCharge(args.orderId, args.isGoods, reference, payer, channel);

    try {
      let outcome = await moolreCollect(fastify.config, {
        reference,
        amountGhs: args.amountGhs,
        payer,
        channel,
        idempotencyKey: `${reference}-start`,
      });
      if (outcome.kind === "otp_verified") {
        outcome = await moolreCollect(fastify.config, {
          reference,
          amountGhs: args.amountGhs,
          payer,
          channel,
          idempotencyKey: `${reference}-send`,
        });
      }
      return replyFor(reply, outcome, { reference, payer, channel });
    } catch (err) {
      return failed(reply, request, err, {
        phase: args.isGoods ? "initiate_goods_moolre" : "initiate_moolre",
        orderId: args.orderId,
        reference,
      });
    }
  }

  /** What the checkout screen should offer. Public: it reveals nothing about any account. */
  fastify.get("/options", async () => ({
    momo: {
      provider: fastify.config.MOMO_PROVIDER,
      ready: fastify.config.MOMO_PROVIDER === "paystack" || isMoolreConfigured(fastify.config),
    },
    card: fastify.config.CARD_PAYMENTS !== "off",
  }));

  /**
   * The SMS code Moolre sends the first time some numbers pay. Verifies it,
   * then fires the approval prompt on the same reference.
   */
  fastify.post(
    "/momo/otp",
    {
      preHandler: fastify.authenticate,
      config: { rateLimit: { ...PAYMENT_INITIATE_RATE_LIMIT, keyGenerator: perAccount("pay-momo-otp") } },
    },
    async (request, reply) => {
      const body = request.body as { reference?: string; code?: string };
      const reference = body.reference?.trim();
      const code = body.code?.replace(/\s/g, "");
      if (!reference || !isMoolreReference(reference)) {
        return reply.code(400).send({ error: "reference is required" });
      }
      if (!code || !/^\d{4,8}$/.test(code)) {
        return reply.code(400).send({ error: "Enter the code from the SMS.", code: "otp_format" });
      }

      const isGoods = reference.startsWith(MOOLRE_GOODS_PREFIX);
      const order = await fastify.prisma.order.findUnique({
        where: isGoods ? { goodsPaystackRef: reference } : { paystackRef: reference },
      });
      if (!order || order.studentId !== request.user!.id) {
        return reply.code(404).send({ error: "Order not found" });
      }
      if (isGoods ? order.goodsPaidAt : order.paidAt) {
        return reply.code(409).send({ error: "This has already been paid — pull down to refresh." });
      }
      const payer = isGoods ? order.goodsMomoPayer : order.momoPayer;
      const channel = parseChannel((isGoods ? order.goodsMomoNetwork : order.momoNetwork) ?? undefined);
      if (!payer || !channel) {
        return reply.code(409).send({ error: "Start the payment again.", code: "restart" });
      }
      const amountGhs = isGoods ? Number(order.itemPrice ?? 0) : Number(order.totalAmount);

      try {
        let outcome = await moolreCollect(fastify.config, {
          reference,
          amountGhs,
          payer,
          channel,
          otpCode: code,
          idempotencyKey: `${reference}-otp-${code}`,
        });
        if (outcome.kind === "otp_verified") {
          outcome = await moolreCollect(fastify.config, {
            reference,
            amountGhs,
            payer,
            channel,
            idempotencyKey: `${reference}-send`,
          });
        }
        return replyFor(reply, outcome, { reference, payer, channel });
      } catch (err) {
        return failed(reply, request, err, { phase: "otp_moolre", orderId: order.id, reference });
      }
    },
  );

  /**
   * Moolre's callback. Treated as a nudge, never as proof: whatever the body
   * says, the order is only confirmed after Moolre's status API, asked
   * server-to-server, says the reference was paid for the right amount. The
   * signature (when the secret is configured) keeps strangers from making us
   * ask.
   *
   * Always 2xx once authentic. Moolre retries anything else for three days,
   * and a payload we cannot match will not match on the eighth try either.
   */
  fastify.post("/webhook/moolre", { config: { rawBody: true } }, async (request, reply) => {
    const secret = fastify.config.MOOLRE_WEBHOOK_SECRET;
    if (secret) {
      const rawBody = request.rawBody!.toString("utf8");
      const header = request.headers["x-moolre-signature"] as string | undefined;
      if (!verifyMoolreSignature(secret, rawBody, header)) {
        return reply.code(401).send({ error: "Invalid signature" });
      }
    }

    const body = (request.body ?? {}) as { event?: string; data?: { externalref?: string } };
    const reference = body.data?.externalref;
    if (body.event === "webhook.test") return reply.send({ received: true });
    if (!reference || !isMoolreReference(reference)) {
      // Payout callbacks (our `RF-` refunds) and anything else we did not start.
      request.log.info({ event: body.event, reference }, "Moolre webhook for a non-collection reference");
      return reply.send({ received: true, matched: false });
    }

    const isGoods = reference.startsWith(MOOLRE_GOODS_PREFIX);
    let order = await fastify.prisma.order.findUnique({
      where: isGoods ? { goodsPaystackRef: reference } : { paystackRef: reference },
    });
    let stale = false;
    if (!order) {
      // A prompt approved after the student had already started another one:
      // the row now carries the newer reference. The order id is in ours.
      const orderId = orderIdFromMoolreReference(reference);
      if (orderId) order = await fastify.prisma.order.findUnique({ where: { id: orderId } });
      stale = !!order;
    }
    if (!order) {
      request.log.error({ reference, event: body.event }, "Moolre webhook matched no order");
      capturePaymentIssue("Moolre webhook matched no order", { phase: "webhook_moolre_unmatched", reference });
      return reply.send({ received: true, matched: false });
    }

    const expectedGhs = isGoods ? Number(order.itemPrice ?? 0) : Number(order.totalAmount);
    const alreadyPaid = isGoods ? !!order.goodsPaidAt : !!order.paidAt;

    if (alreadyPaid) {
      if (stale) {
        // Paid once already, and now a second reference says it took money too.
        // Nothing here may confirm it again; a human has to refund one.
        const state = await deps.checkCharge({ reference, isGoods, orderId: order.id, expectedGhs, log: request.log })
          .catch(() => "unknown" as const);
        if (state === "paid") {
          request.log.error({ orderId: order.id, reference }, "Moolre: second charge on an already-paid order");
          capturePaymentIssue("Moolre charged an order twice — refund the second payment", {
            phase: "webhook_moolre_double",
            orderId: order.id,
            reference,
          });
        }
      }
      return reply.send({ received: true, alreadyProcessed: true });
    }

    if (stale) {
      request.log.warn({ orderId: order.id, reference }, "Moolre charge on a superseded reference");
      capturePaymentIssue("Moolre charge paid on a superseded reference", {
        phase: isGoods ? "webhook_moolre_goods" : "webhook_moolre_delivery",
        orderId: order.id,
        reference,
      });
    }

    const state = await deps.checkCharge({ reference, isGoods, orderId: order.id, expectedGhs, log: request.log });
    return reply.send({ received: true, state });
  });

  return { start };
}
