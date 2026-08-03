import type { FastifyInstance } from "fastify";
import axios from "axios";
import { initiatePaystackPayment, verifyPaystackSignature } from "./paystack";
import { issueDeliveryPin } from "../orders/issuePin";
import { announceNewOrderToRiders, notifyOrderStatus } from "../notifications/dispatch";

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

      const order = await fastify.prisma.order.findUnique({
        where: { paystackRef: event.data.reference },
        include: { student: { select: { phone: true } }, shop: { select: { name: true } } },
      });
      if (!order) return reply.code(404).send({ error: "Order not found for reference" });

      // Paystack retries webhooks until it gets a 2xx. Re-issuing on a retry
      // would overwrite the hash and silently invalidate the PIN already texted
      // to the student, so an already-confirmed order is a no-op.
      if (order.paidAt && order.deliveryPinHash) {
        return reply.send({ received: true, alreadyProcessed: true });
      }

      const { smsSent } = await issueDeliveryPin({
        fastify,
        log: request.log,
        phone: order.student.phone,
        persistHash: (hash) =>
          fastify.prisma.order
            .update({
              where: { id: order.id },
              data: { status: "confirmed", paidAt: new Date(), deliveryPinHash: hash },
            })
            .then(() => undefined),
      });

      if (!smsSent) {
        // The order is paid and confirmed either way — do not fail the webhook,
        // or Paystack will retry and the no-op guard above will strand it. The
        // student recovers via POST /orders/:id/resend-pin.
        request.log.error(
          { orderId: order.id },
          "Order confirmed but the delivery PIN SMS did not send — student must request a resend",
        );
      }

      // Both are best-effort and never throw, so a push outage cannot stop the
      // webhook returning 2xx — a non-2xx here makes Paystack retry, and the
      // idempotency guard above would then strand the retry as a no-op.
      await notifyOrderStatus({ fastify, log: request.log, orderId: order.id, status: "confirmed" });
      await announceNewOrderToRiders({
        fastify,
        log: request.log,
        orderId: order.id,
        universityId: order.universityId,
        shopName: order.shop?.name ?? "a nearby shop",
      });

      return reply.send({ received: true });
    },
  );

  fastify.get("/verify/:ref", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const order = await fastify.prisma.order.findUnique({ where: { paystackRef: ref } });
    // 404 rather than 403 on someone else's order: a distinguishable "exists but
    // not yours" would let anyone probe whether a reference is real.
    if (!order || order.studentId !== request.user!.id) {
      return reply.code(404).send({ error: "Order not found" });
    }
    return reply.send({ status: order.status, paidAt: order.paidAt });
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
