import type { FastifyInstance } from "fastify";
import {
  adminMessageSchema,
  businessLeadSchema,
  guestVisitSchema,
  normalizeGhanaLocalDigits,
  toGhanaE164,
} from "@wave/shared";
import { sendSms } from "../../lib/sms";
import { HAS_PUSH, pushToProfiles } from "../notifications/dispatch";

/** A guest name or a lead per IP is plenty; this keeps a script from filling the tables. */
const PUBLIC_FORM_RATE_LIMIT = { max: 20, timeWindow: "1 hour" as const };

/** Sends to Telegram when it is configured; never fails the request. */
function tell(fastify: FastifyInstance, who: string, text: string) {
  void fastify.activityWatch?.sendNow(who, text).catch(() => {});
}

function e164(phone: string): string {
  return toGhanaE164(normalizeGhanaLocalDigits(phone));
}

/**
 * Public growth endpoints: a guest's first name, a business owner's lead, and
 * the "opened from the home screen" ping. Everything here is also reported to
 * the Telegram chat, so the team sees interest as it happens.
 */
export async function growthRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/guest-visits",
    { config: { rateLimit: PUBLIC_FORM_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = guestVisitSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
      }
      const { firstName, universityId } = parsed.data;
      const university = universityId
        ? await fastify.prisma.university.findUnique({ where: { id: universityId }, select: { id: true, name: true } })
        : null;
      const visit = await fastify.prisma.guestVisit.create({
        data: {
          firstName,
          universityId: university?.id ?? null,
          userAgent: String(request.headers["user-agent"] ?? "").slice(0, 300) || null,
        },
        select: { id: true },
      });
      tell(fastify, `Guest: ${firstName}`, `Started looking around${university ? ` at ${university.name}` : ""}`);
      return reply.code(201).send({ id: visit.id });
    },
  );

  fastify.post(
    "/business-leads",
    { config: { rateLimit: PUBLIC_FORM_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = businessLeadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
      }
      const input = parsed.data;
      const university = input.universityId
        ? await fastify.prisma.university.findUnique({ where: { id: input.universityId }, select: { id: true, name: true } })
        : null;
      const lead = await fastify.prisma.businessLead.create({
        data: {
          fullName: input.fullName,
          phone: e164(input.phone),
          businessName: input.businessName,
          universityId: university?.id ?? null,
          kind: input.kind,
          details: input.details ?? null,
        },
        select: { id: true },
      });
      const what = input.kind === "bulk_pickup" ? "bulk stock pickups from Accra" : "a shop on Wave";
      tell(
        fastify,
        `Business lead: ${input.businessName}`,
        `${input.fullName} (${e164(input.phone)}) wants ${what}${university ? ` at ${university.name}` : ""}` +
          (input.details ? `\n${input.details}` : ""),
      );
      return reply.code(201).send({ id: lead.id });
    },
  );

  /** The app calls this once per device when it runs from a home-screen icon. */
  fastify.post("/profile/me/app-installed", { preHandler: fastify.authenticate }, async (request, reply) => {
    const profile = await fastify.prisma.profile.findUnique({
      where: { id: request.user!.id },
      select: { pwaInstalledAt: true, fullName: true },
    });
    if (profile && !profile.pwaInstalledAt) {
      await fastify.prisma.profile.update({ where: { id: request.user!.id }, data: { pwaInstalledAt: new Date() } });
      tell(fastify, profile.fullName, "Added Wave to their home screen");
    }
    return reply.code(204).send();
  });
}

/** Owner-only views and the Messages page. */
export async function adminGrowthRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  /** Who installed the app and who can be reached by push. */
  fastify.get("/engagement", { preHandler: fastify.requirePermission("growth.read") }, async (_request, reply) => {
    const people = await fastify.prisma.profile.findMany({
      where: { role: "student", isTest: false },
      orderBy: [{ pwaInstalledAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
      select: {
        id: true,
        fullName: true,
        phone: true,
        createdAt: true,
        pwaInstalledAt: true,
        pushToken: true,
        university: { select: { name: true } },
        _count: { select: { webPushSubscriptions: true } },
      },
      take: 1000,
    });
    const rows = people.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      phone: p.phone,
      campus: p.university?.name ?? null,
      joinedAt: p.createdAt,
      installedAt: p.pwaInstalledAt,
      notificationsOn: !!p.pushToken || p._count.webPushSubscriptions > 0,
    }));
    return reply.send({
      totals: {
        students: rows.length,
        installed: rows.filter((r) => r.installedAt).length,
        notificationsOn: rows.filter((r) => r.notificationsOn).length,
      },
      people: rows,
    });
  });

  fastify.get("/guest-visits", { preHandler: fastify.requirePermission("growth.read") }, async (_request, reply) => {
    const visits = await fastify.prisma.guestVisit.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    return reply.send({ visits });
  });

  fastify.get("/business-leads", { preHandler: fastify.requirePermission("growth.read") }, async (_request, reply) => {
    const leads = await fastify.prisma.businessLead.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    return reply.send({ leads });
  });

  fastify.get("/messages", { preHandler: fastify.requirePermission("messages.send") }, async (_request, reply) => {
    const messages = await fastify.prisma.adminMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return reply.send({ messages });
  });

  /**
   * Sends an SMS or a push message. Push reaches only people with a device or
   * browser registered; SMS reaches every number. Each send is logged with how
   * many it reached.
   */
  fastify.post("/messages", { preHandler: fastify.requirePermission("messages.send") }, async (request, reply) => {
    const parsed = adminMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const { channel, audience, title, body } = parsed.data;

    const where =
      audience.type === "phones"
        ? { phone: { in: audience.phones.map(e164) } }
        : {
            role: "student" as const,
            isActive: true,
            isTest: false,
            ...(audience.type === "campus" ? { universityId: audience.universityId } : {}),
          };
    const people = await fastify.prisma.profile.findMany({
      where: channel === "push" ? { AND: [where, HAS_PUSH] } : where,
      select: { id: true, phone: true },
    });

    let delivered = 0;
    let failed = 0;
    if (channel === "push") {
      const { sent } = await pushToProfiles({
        fastify,
        log: request.log,
        profileIds: people.map((p) => p.id),
        payload: { title: title!, body },
      });
      delivered = sent;
      failed = Math.max(0, people.length - sent);
    } else {
      const apiKey = fastify.config.MNOTIFY_API_KEY;
      const senderId = fastify.config.MNOTIFY_SENDER_ID;
      if (!apiKey || !senderId) return reply.code(503).send({ error: "SMS is not set up on this server" });
      // Phones typed by hand may not have an account; text them anyway.
      const phones =
        audience.type === "phones" ? [...new Set(audience.phones.map(e164))] : people.map((p) => p.phone);
      for (const phone of phones) {
        try {
          await sendSms({ apiKey, senderId, phone, message: body });
          delivered += 1;
        } catch (err) {
          failed += 1;
          request.log.warn({ err: (err as Error).message }, "admin SMS failed");
        }
      }
    }

    const audienceLabel =
      audience.type === "everyone" ? "everyone" : audience.type === "campus" ? `campus:${audience.universityId}` : "phones";
    const recipients = delivered + failed;
    const message = await fastify.prisma.adminMessage.create({
      data: {
        channel,
        audience: audienceLabel,
        title: title ?? null,
        body,
        recipients,
        delivered,
        failed,
        sentById: request.user!.id,
      },
    });
    await request.audit({
      action: "message.sent",
      category: "staff",
      entityType: "admin_message",
      entityId: message.id,
      metadata: { channel, audience: audienceLabel, recipients, delivered, failed },
    });
    return reply.code(201).send({ message });
  });
}
