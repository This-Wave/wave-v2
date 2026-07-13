import type { FastifyInstance } from "fastify";
import { createClient } from "@supabase/supabase-js";
import {
  setAvailabilitySchema,
  submitVerificationSchema,
  reviewVerificationSchema,
  uploadVerificationImageSchema,
} from "@wave/shared";

const VERIFICATION_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function riderRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/verification",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const parsed = submitVerificationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const verification = await fastify.prisma.riderVerification.create({
        data: { ...parsed.data, riderId: request.user!.id },
      });
      return reply.code(201).send({ verification });
    },
  );

  // Uploads a rider ID or selfie photo to the private "verifications" Storage
  // bucket using the service-role key (bypasses Storage RLS entirely, so no
  // client-side Storage policy is needed), then returns a signed URL for the
  // client to submit via POST /verification. The signed URL expires after
  // VERIFICATION_SIGNED_URL_TTL_SECONDS — see GOTCHA note in debug.md about
  // regenerating it for long-term admin review.
  fastify.post(
    "/verification/upload",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const parsed = uploadVerificationImageSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const { kind, imageBase64, contentType } = parsed.data;
      const ext = contentType.split("/")[1];
      const path = `${request.user!.id}/${kind}-${Date.now()}.${ext}`;
      const buffer = Buffer.from(imageBase64, "base64");

      const supabase = createClient(fastify.config.SUPABASE_URL, fastify.config.SUPABASE_SERVICE_ROLE_KEY);
      const { error: uploadError } = await supabase.storage
        .from("verifications")
        .upload(path, buffer, { contentType, upsert: true });
      if (uploadError) {
        request.log.error(uploadError, "verification image upload failed");
        return reply.code(502).send({ error: "Upload failed" });
      }

      const { data: signed, error: signError } = await supabase.storage
        .from("verifications")
        .createSignedUrl(path, VERIFICATION_SIGNED_URL_TTL_SECONDS);
      if (signError || !signed) {
        request.log.error(signError, "failed to sign verification image URL");
        return reply.code(502).send({ error: "Failed to generate image URL" });
      }

      return reply.send({ url: signed.signedUrl });
    },
  );

  fastify.get(
    "/verification/status",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const verification = await fastify.prisma.riderVerification.findFirst({
        where: { riderId: request.user!.id },
        orderBy: { createdAt: "desc" },
      });
      return reply.send({ verification });
    },
  );

  fastify.get(
    "/earnings",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const earnings = await fastify.prisma.riderEarning.findMany({
        where: { riderId: request.user!.id },
        orderBy: { createdAt: "desc" },
        include: { order: { select: { id: true, createdAt: true, shop: { select: { name: true } } } } },
      });
      return reply.send({ earnings });
    },
  );

  fastify.patch(
    "/availability",
    { preHandler: [fastify.authenticate, fastify.requireRole("rider")] },
    async (request, reply) => {
      const parsed = setAvailabilitySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const profile = await fastify.prisma.profile.update({
        where: { id: request.user!.id },
        data: { isActive: parsed.data.isActive },
      });
      return reply.send({ profile });
    },
  );

  fastify.get(
    "/admin/riders",
    { preHandler: [fastify.authenticate, fastify.requireRole("admin")] },
    async (request, reply) => {
      const { status } = request.query as { status?: "pending" | "approved" | "rejected" };
      const verifications = await fastify.prisma.riderVerification.findMany({
        where: { status: status ?? "pending" },
        orderBy: { createdAt: "desc" },
        include: { rider: { select: { id: true, fullName: true, phone: true } } },
      });
      return reply.send({ verifications });
    },
  );

  fastify.patch(
    "/admin/riders/:id/verify",
    { preHandler: [fastify.authenticate, fastify.requireRole("admin")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = reviewVerificationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
      }
      const verification = await fastify.prisma.riderVerification.update({
        where: { id },
        data: {
          status: parsed.data.status,
          rejectionReason: parsed.data.rejectionReason,
          reviewedBy: request.user!.id,
          reviewedAt: new Date(),
        },
      });
      if (parsed.data.status === "approved") {
        await fastify.prisma.profile.update({ where: { id: verification.riderId }, data: { isVerified: true } });
      }
      return reply.send({ verification });
    },
  );
}
