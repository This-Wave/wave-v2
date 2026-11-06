import type { FastifyInstance } from "fastify";
import {
  DEFAULT_HUB_ADDRESS,
  HUB_ADDRESS_KEY,
  DELIVERY_COMPANY_KEY,
  DELIVERY_MODE_KEY,
  addCompanyMemberSchema,
  companyPayFor,
  createCompanySchema,
  setDeliveryModeSchema,
  statementQuerySchema,
  toGhanaE164,
  updateCompanySchema,
} from "@wave/shared";
import { activeDelivery } from "./mode";
import { hashListToken, newListToken } from "../companyList/token";

const COMPANY_SELECT = {
  id: true,
  name: true,
  contactName: true,
  contactPhone: true,
  isActive: true,
  rateType: true,
  rateValue: true,
  createdAt: true,
  members: {
    select: { id: true, fullName: true, phone: true, role: true, isActive: true },
    orderBy: { fullName: "asc" as const },
  },
} as const;

/**
 * Admin: delivery companies, their rosters and rates, and the switch between
 * company and independent riders (`companies.manage` — Owner, Logistics head).
 *
 * Adding someone to a roster is by the phone number they signed up with, the
 * same as adding staff. A company rider is vouched for by the company, so they
 * are marked verified here and skip Wave's own ID check; that vouching is part
 * of the contract (PLAN-DELIVERY-COMPANY.md §4).
 */
export async function companyRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requirePermission("companies.manage"));

  async function hubAddress(): Promise<string> {
    const row = await fastify.prisma.platformConfig.findUnique({ where: { key: HUB_ADDRESS_KEY } });
    return row?.value?.trim() || DEFAULT_HUB_ADDRESS;
  }

  fastify.get("/delivery-mode", async (_request, reply) => {
    return reply.send({ ...(await activeDelivery(fastify)), hubAddress: await hubAddress() });
  });

  fastify.put("/delivery-mode", async (request, reply) => {
    const parsed = setDeliveryModeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const { mode, companyId, hubAddress: newHub } = parsed.data;
    if (mode === "company") {
      // No rider accounts needed: the company works from its list link.
      const company = await fastify.prisma.deliveryCompany.findUnique({
        where: { id: companyId! },
        select: { isActive: true },
      });
      if (!company?.isActive) return reply.code(400).send({ error: "That company is not active" });
    }
    const before = await activeDelivery(fastify);
    await fastify.prisma.$transaction([
      fastify.prisma.platformConfig.upsert({
        where: { key: DELIVERY_MODE_KEY },
        create: { key: DELIVERY_MODE_KEY, value: mode, description: "Who runs deliveries: independent | company" },
        update: { value: mode },
      }),
      ...(mode === "company"
        ? [
            fastify.prisma.platformConfig.upsert({
              where: { key: DELIVERY_COMPANY_KEY },
              create: { key: DELIVERY_COMPANY_KEY, value: companyId!, description: "The delivery company in company mode" },
              update: { value: companyId! },
            }),
          ]
        : []),
      ...(newHub
        ? [
            fastify.prisma.platformConfig.upsert({
              where: { key: HUB_ADDRESS_KEY },
              create: { key: HUB_ADDRESS_KEY, value: newHub, description: "Where the delivery company brings orders" },
              update: { value: newHub },
            }),
          ]
        : []),
    ]);
    const after = await activeDelivery(fastify);
    await request.audit({
      action: "delivery_mode.changed",
      category: "config",
      entityType: "platform_config",
      entityId: DELIVERY_MODE_KEY,
      before: { mode: before.mode, company: before.company?.name ?? null },
      after: { mode: after.mode, company: after.company?.name ?? null, hubAddress: newHub ?? undefined },
    });
    return reply.send({ ...after, hubAddress: await hubAddress() });
  });

  fastify.get("/companies", async (_request, reply) => {
    const rows = await fastify.prisma.deliveryCompany.findMany({
      select: { ...COMPANY_SELECT, listTokenHash: true },
      orderBy: { name: "asc" },
    });
    // Never the hash itself: only whether a list link is live.
    const companies = rows.map(({ listTokenHash, ...c }) => ({ ...c, hasListLink: !!listTokenHash }));
    return reply.send({ companies, ...(await activeDelivery(fastify)), hubAddress: await hubAddress() });
  });

  fastify.post("/companies", async (request, reply) => {
    const parsed = createCompanySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const company = await fastify.prisma.deliveryCompany.create({
      data: {
        name: parsed.data.name,
        contactName: parsed.data.contactName,
        contactPhone: parsed.data.contactPhone ? toGhanaE164(parsed.data.contactPhone) : undefined,
      },
      select: COMPANY_SELECT,
    });
    await request.audit({
      action: "company.created",
      category: "rider",
      entityType: "delivery_company",
      entityId: company.id,
      after: { name: company.name },
    });
    return reply.code(201).send({ company });
  });

  fastify.patch("/companies/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateCompanySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const existing = await fastify.prisma.deliveryCompany.findUnique({
      where: { id },
      select: { name: true, isActive: true, rateType: true, rateValue: true },
    });
    if (!existing) return reply.code(404).send({ error: "Company not found" });
    const { contactPhone, ...rest } = parsed.data;
    const company = await fastify.prisma.deliveryCompany.update({
      where: { id },
      data: {
        ...rest,
        ...(contactPhone !== undefined
          ? { contactPhone: contactPhone ? toGhanaE164(contactPhone) : null }
          : {}),
        // Clearing the type clears the value, so the two can never disagree.
        ...(parsed.data.rateType === null ? { rateValue: null } : {}),
      },
      select: COMPANY_SELECT,
    });
    await request.audit({
      action: "company.updated",
      category: "rider",
      entityType: "delivery_company",
      entityId: id,
      before: { ...existing, rateValue: existing.rateValue?.toString() ?? null },
      after: {
        name: company.name,
        isActive: company.isActive,
        rateType: company.rateType,
        rateValue: company.rateValue?.toString() ?? null,
      },
    });
    return reply.send({ company });
  });

  fastify.post("/companies/:id/members", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = addCompanyMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid payload" });
    }
    const company = await fastify.prisma.deliveryCompany.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!company) return reply.code(404).send({ error: "Company not found" });

    const person = await fastify.prisma.profile.findUnique({
      where: { phone: toGhanaE164(parsed.data.phone) },
      select: { id: true, role: true, fullName: true, isActive: true, companyId: true },
    });
    if (!person) {
      return reply.code(404).send({
        error: "Nobody has signed up with that number. Ask them to open Wave and create an account first.",
      });
    }
    if (!person.isActive) return reply.code(409).send({ error: "That account is banned" });
    if (person.role === "admin") return reply.code(409).send({ error: `${person.fullName} is Wave staff` });
    if (person.role === "shop_owner") {
      return reply.code(409).send({ error: `${person.fullName} runs a shop on Wave and can't also deliver` });
    }
    if (person.companyId && person.companyId !== id) {
      return reply.code(409).send({ error: `${person.fullName} already works for another company` });
    }

    const member = await fastify.prisma.profile.update({
      where: { id: person.id },
      data: {
        role: parsed.data.as,
        companyId: id,
        // Riders: the company vouches for them, so they can take jobs now.
        ...(parsed.data.as === "rider" ? { isVerified: true, riderType: "external" as const } : {}),
      },
      select: { id: true, fullName: true, phone: true, role: true, isActive: true },
    });
    await request.audit({
      action: "company.member_added",
      category: "rider",
      entityType: "profile",
      entityId: person.id,
      before: { role: person.role, companyId: person.companyId },
      after: { role: parsed.data.as, company: company.name },
      metadata: { name: person.fullName },
    });
    return reply.code(201).send({ member });
  });

  /**
   * Take someone off a roster. They become a student account again: a former
   * company rider must not keep a verified rider account Wave never checked.
   */
  fastify.delete("/companies/:id/members/:profileId", async (request, reply) => {
    const { id, profileId } = request.params as { id: string; profileId: string };
    const person = await fastify.prisma.profile.findUnique({
      where: { id: profileId },
      select: { id: true, role: true, companyId: true, fullName: true },
    });
    if (!person || person.companyId !== id) return reply.code(404).send({ error: "Not on this company's roster" });

    const open = await fastify.prisma.order.count({
      where: { riderId: profileId, status: { in: ["rider_assigned", "en_route", "at_checkpoint"] } },
    });
    if (open > 0) {
      return reply.code(409).send({ error: `${person.fullName} has ${open} job(s) in progress. Move them first.` });
    }
    await fastify.prisma.profile.update({
      where: { id: profileId },
      data: { role: "student", companyId: null, isVerified: false, riderType: null },
    });
    await request.audit({
      action: "company.member_removed",
      category: "rider",
      entityType: "profile",
      entityId: profileId,
      before: { role: person.role, companyId: id },
      after: { role: "student", companyId: null },
      metadata: { name: person.fullName },
    });
    return reply.send({ ok: true });
  });

  /**
   * What the company is owed for delivered orders in a date range. Amounts are
   * null until a rate is set — the contract is not signed yet — and the
   * statement then still shows the count and the fees collected.
   */
  fastify.get("/companies/:id/statement", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = statementQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "Give from and to dates" });
    const company = await fastify.prisma.deliveryCompany.findUnique({
      where: { id },
      select: { id: true, name: true, rateType: true, rateValue: true },
    });
    if (!company) return reply.code(404).send({ error: "Company not found" });

    const orders = await fastify.prisma.order.findMany({
      where: {
        companyId: id,
        isTest: false,
        status: "delivered",
        scheduledDate: { gte: new Date(parsed.data.from), lte: new Date(parsed.data.to) },
      },
      select: { id: true, scheduledDate: true, deliveryFee: true, deliveredAt: true, rider: { select: { fullName: true } } },
      orderBy: { scheduledDate: "asc" },
    });
    const rate = {
      rateType: company.rateType,
      rateValue: company.rateValue === null ? null : Number(company.rateValue),
    };
    const lines = orders.map((o) => ({
      orderId: o.id,
      date: o.scheduledDate,
      rider: o.rider?.fullName ?? null,
      deliveryFee: Number(o.deliveryFee),
      owed: companyPayFor(Number(o.deliveryFee), rate),
    }));
    const feesTotal = Math.round(lines.reduce((s, l) => s + l.deliveryFee, 0) * 100) / 100;
    const owedTotal = rate.rateType
      ? Math.round(lines.reduce((s, l) => s + (l.owed ?? 0), 0) * 100) / 100
      : null;
    return reply.send({ company, from: parsed.data.from, to: parsed.data.to, delivered: lines.length, feesTotal, owedTotal, lines });
  });

  /**
   * Make (or replace) the company's private list link. The token is returned
   * once and only its hash is kept, so making a new one is also how a leaked
   * link is retired: the old one stops working immediately.
   */
  fastify.post("/companies/:id/list-link", async (request, reply) => {
    const { id } = request.params as { id: string };
    const company = await fastify.prisma.deliveryCompany.findUnique({ where: { id }, select: { id: true, name: true, listTokenHash: true } });
    if (!company) return reply.code(404).send({ error: "Company not found" });
    const token = newListToken();
    await fastify.prisma.deliveryCompany.update({ where: { id }, data: { listTokenHash: hashListToken(token) } });
    await request.audit({
      action: company.listTokenHash ? "company.list_link_replaced" : "company.list_link_created",
      category: "rider",
      entityType: "delivery_company",
      entityId: id,
      metadata: { company: company.name },
    });
    return reply.code(201).send({ token, path: `/list/${token}` });
  });

  /** Turn the link off. Anyone holding it sees "this link doesn't work". */
  fastify.delete("/companies/:id/list-link", async (request, reply) => {
    const { id } = request.params as { id: string };
    const company = await fastify.prisma.deliveryCompany.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!company) return reply.code(404).send({ error: "Company not found" });
    await fastify.prisma.deliveryCompany.update({ where: { id }, data: { listTokenHash: null } });
    await request.audit({
      action: "company.list_link_disabled",
      category: "rider",
      entityType: "delivery_company",
      entityId: id,
      metadata: { company: company.name },
    });
    return reply.send({ ok: true });
  });
}
