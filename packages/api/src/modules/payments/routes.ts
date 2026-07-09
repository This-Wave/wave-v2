import type { FastifyInstance } from "fastify";
import { initiatePaystackPayment, verifyPaystackSignature } from "./paystack";
import { generateDeliveryPin } from "../orders/pin";

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.post("/initiate", { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = request.body as { orderId?: string };
    if (!body.orderId) return reply.code(400).send({ error: "orderId is required" });

    const order = await fastify.prisma.order.findUnique({ where: { id: body.orderId } });
    if (!order) return reply.code(404).send({ error: "Order not found" });

    const profile = await fastify.prisma.profile.findUnique({ where: { id: order.studentId } });
    const reference = `WAVE-${order.id}-${Date.now()}`;

    const { authorization_url } = await initiatePaystackPayment(fastify.config.PAYSTACK_SECRET_KEY, {
      email: `${profile!.phone}@wave.app`, // students register by phone, not email
      amountGhs: Number(order.totalAmount),
      reference,
      callbackUrl: `${fastify.config.APP_URL}/payment/callback`,
      metadata: { order_id: order.id, student_id: order.studentId },
    });

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
      const rawBody = JSON.stringify(request.body);

      if (!signature || !verifyPaystackSignature(fastify.config.PAYSTACK_SECRET_KEY, rawBody, signature)) {
        return reply.code(401).send({ error: "Invalid signature" });
      }

      const event = request.body as { event: string; data: { reference: string; status: string } };
      if (event.event !== "charge.success") {
        return reply.send({ received: true });
      }

      const order = await fastify.prisma.order.findUnique({ where: { paystackRef: event.data.reference } });
      if (!order) return reply.code(404).send({ error: "Order not found for reference" });

      const { hash } = await generateDeliveryPin();
      await fastify.prisma.order.update({
        where: { id: order.id },
        data: { status: "confirmed", paidAt: new Date(), deliveryPinHash: hash },
      });

      // TODO(Phase 3): push PIN to student via Expo Notifications, broadcast to riders via Supabase Realtime.
      return reply.send({ received: true });
    },
  );

  fastify.get("/verify/:ref", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { ref } = request.params as { ref: string };
    const order = await fastify.prisma.order.findUnique({ where: { paystackRef: ref } });
    if (!order) return reply.code(404).send({ error: "Order not found" });
    return reply.send({ status: order.status, paidAt: order.paidAt });
  });
}
