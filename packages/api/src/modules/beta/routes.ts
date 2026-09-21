import type { FastifyInstance } from "fastify";
import type { BetaStatus } from "@prisma/client";
import { applyForBetaSchema, betaFeedbackSchema, reviewBetaSchema } from "@wave/shared";
import { pushToProfiles } from "../notifications/dispatch";

/**
 * The beta programme, from the tester's side.
 *
 * Students and riders only: shop owners and staff see features when they ship.
 * Applying is idempotent — one row per person — so a second tap, or applying
 * again after a rejection, reopens the same application rather than stacking
 * duplicates in the review queue.
 */
export async function betaRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("student", "rider"));

  const SELF = { status: true, reason: true, reviewNote: true, createdAt: true, reviewedAt: true } as const;

  fastify.get("/me", async (request, reply) => {
    const application = await fastify.prisma.betaApplication.findUnique({
      where: { profileId: request.user!.id },
      select: SELF,
    });
    return reply.send({ application });
  });

  fastify.post("/apply", async (request, reply) => {
    const parsed = applyForBetaSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const existing = await fastify.prisma.betaApplication.findUnique({
      where: { profileId: request.user!.id },
      select: { status: true },
    });
    if (existing?.status === "approved") {
      return reply.code(409).send({ error: "You're already a beta tester" });
    }
    if (existing?.status === "pending") {
      return reply.code(409).send({ error: "Your application is already waiting for review" });
    }
    // A revoked tester can't simply re-apply: someone took access away on
    // purpose, and the way back is to talk to them.
    if (existing?.status === "revoked") {
      return reply.code(403).send({ error: "Your beta access was withdrawn. Contact support if you think that's a mistake." });
    }

    const reason = parsed.data.reason || null;
    const application = await fastify.prisma.betaApplication.upsert({
      where: { profileId: request.user!.id },
      create: { profileId: request.user!.id, reason },
      update: { status: "pending", reason, reviewNote: null, reviewedById: null, reviewedAt: null },
      select: SELF,
    });
    await request.audit({
      action: existing ? "beta.reapplied" : "beta.applied",
      category: "beta",
      entityType: "profile",
      entityId: request.user!.id,
      before: existing ? { status: existing.status } : null,
      after: { status: "pending" },
      metadata: { reason },
    });
    return reply.code(existing ? 200 : 201).send({ application });
  });

  fastify.post("/feedback", async (request, reply) => {
    const parsed = betaFeedbackSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const application = await fastify.prisma.betaApplication.findUnique({
      where: { profileId: request.user!.id },
      select: { status: true },
    });
    if (application?.status !== "approved") {
      return reply.code(403).send({ error: "Feedback is open to beta testers" });
    }
    const feedback = await fastify.prisma.betaFeedback.create({
      data: { profileId: request.user!.id, ...parsed.data },
      select: { id: true, createdAt: true },
    });
    await request.audit({
      action: "beta.feedback_sent",
      category: "beta",
      entityType: "beta_feedback",
      entityId: feedback.id,
      metadata: { screen: parsed.data.screen ?? null, length: parsed.data.message.length },
    });
    return reply.code(201).send({ feedback });
  });
}

const DECISION_TO_STATUS: Record<"approve" | "reject" | "revoke", BetaStatus> = {
  approve: "approved",
  reject: "rejected",
  revoke: "revoked",
};

/** Which decisions make sense from which state. Anything else is a stale screen. */
const ALLOWED_FROM: Record<"approve" | "reject" | "revoke", BetaStatus[]> = {
  approve: ["pending", "rejected", "revoked"],
  reject: ["pending"],
  revoke: ["approved"],
};

export async function adminBetaRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/beta", { preHandler: fastify.requirePermission("ops.read") }, async (request, reply) => {
    const { status } = request.query as { status?: string };
    const where = status && status !== "all" ? { status: status as BetaStatus } : {};
    const [applications, counts] = await Promise.all([
      fastify.prisma.betaApplication.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true,
          status: true,
          reason: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
          profile: { select: { id: true, fullName: true, role: true, riderType: true, createdAt: true } },
        },
      }),
      fastify.prisma.betaApplication.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    return reply.send({
      applications,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    });
  });

  fastify.post(
    "/beta/:id/review",
    { preHandler: fastify.requirePermission("beta.review") },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = reviewBetaSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: "Choose approve, reject or revoke" });
      const { decision, note } = parsed.data;

      const current = await fastify.prisma.betaApplication.findUnique({
        where: { id },
        select: { status: true, profileId: true, profile: { select: { fullName: true } } },
      });
      if (!current) return reply.code(404).send({ error: "Application not found" });
      if (!ALLOWED_FROM[decision].includes(current.status)) {
        return reply.code(409).send({ error: `This application is ${current.status} — refresh and try again` });
      }

      const status = DECISION_TO_STATUS[decision];
      const updated = await fastify.prisma.betaApplication.update({
        where: { id },
        data: { status, reviewNote: note || null, reviewedById: request.user!.id, reviewedAt: new Date() },
        select: { id: true, status: true, reviewNote: true, reviewedAt: true },
      });
      await request.audit({
        action: `beta.${status}`,
        category: "beta",
        entityType: "profile",
        entityId: current.profileId,
        before: { status: current.status },
        after: { status, note: note || null },
        metadata: { name: current.profile.fullName, applicationId: id },
      });

      if (status === "approved") {
        await pushToProfiles({
          fastify,
          log: request.log,
          profileIds: [current.profileId],
          payload: {
            title: "You're in the Wave beta",
            body: "New features will show up for you before anyone else. Tell us what breaks.",
            data: { type: "beta_approved" },
          },
        });
      }
      return reply.send({ application: updated });
    },
  );

  fastify.get(
    "/beta/feedback",
    { preHandler: fastify.requirePermission("ops.read") },
    async (_request, reply) => {
      const feedback = await fastify.prisma.betaFeedback.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          message: true,
          screen: true,
          appVersion: true,
          createdAt: true,
          profile: { select: { id: true, fullName: true, role: true } },
        },
      });
      return reply.send({ feedback });
    },
  );
}
