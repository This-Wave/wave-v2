import { describe, expect, it } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { maskPhone, redactForAudit } from "../audit";
import auditPlugin from "../../plugins/audit";

describe("redactForAudit", () => {
  it("never lets a secret through, at any depth", () => {
    const out = redactForAudit({
      deliveryPinHash: "$2b$10$abc",
      pin: "123456",
      nested: { pushToken: "ExponentPushToken[x]", authorization_code: "AUTH_x", password: "hunter2" },
      signature: "sha512=…",
    }) as Record<string, unknown>;
    expect(JSON.stringify(out)).not.toMatch(/abc|123456|ExponentPushToken|AUTH_x|hunter2|sha512/);
    expect(out.pin).toBe("[redacted]");
  });

  it("treats pin as a word, so ordinary keys containing it survive", () => {
    const out = redactForAudit({ shipping: "fast", spinner: true, pinAttempts: 3 }) as Record<string, unknown>;
    expect(out.shipping).toBe("fast");
    expect(out.spinner).toBe(true);
    expect(out.pinAttempts).toBe("[redacted]");
  });

  it("masks phone numbers instead of dropping them", () => {
    const out = redactForAudit({ phone: "+233241234589", student: { phone: "0241234589" } }) as {
      phone: string;
      student: { phone: string };
    };
    expect(out.phone).toMatch(/89$/);
    expect(out.phone).not.toContain("123");
    expect(out.student.phone).toMatch(/89$/);
  });

  it("keeps nulls as nulls, so 'was empty' and 'was hidden' stay distinguishable", () => {
    expect(redactForAudit({ pin: null })).toEqual({ pin: null });
  });

  it("serialises dates and money, and truncates long strings", () => {
    const out = redactForAudit({
      at: new Date("2026-09-21T10:00:00Z"),
      amount: { toFixed: () => "20.00", toString: () => "20.00" },
      note: "x".repeat(600),
    }) as Record<string, string>;
    expect(out.at).toBe("2026-09-21T10:00:00.000Z");
    expect(out.amount).toBe("20.00");
    expect(out.note!.length).toBeLessThan(560);
  });
});

describe("maskPhone", () => {
  it("keeps the country prefix and the last two digits", () => {
    expect(maskPhone("+233241234589")).toBe("+233•••••••89");
    expect(maskPhone("0241234589")).toBe("024•••••89");
  });
  it("hides very short values entirely", () => {
    expect(maskPhone("123")).toBe("•••");
  });
});

/**
 * The safety net, against a fake Prisma that captures what would be inserted.
 */
async function appWithAudit(): Promise<{ app: FastifyInstance; rows: Record<string, unknown>[] }> {
  const rows: Record<string, unknown>[] = [];
  const app = Fastify({ logger: false });
  app.decorate("prisma", {
    auditEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return data;
      },
    },
  } as never);
  await app.register(auditPlugin);
  await app.register(
    async (f) => {
      f.patch("/orders/:id/accept", async () => ({ ok: true }));
      f.post("/orders", async () => ({ order: { id: "new-order" } }));
      f.patch("/orders/:id/deliver", async (_req, reply) => reply.code(403).send({ error: "Forbidden" }));
      f.post("/orders/:id/cancel-described", async (req) => {
        await req.audit({ action: "order.custom", category: "order" });
        return { ok: true };
      });
      f.post("/orders/bad", async (_req, reply) => reply.code(400).send({ error: "bad" }));
      f.get("/orders/:id", async () => ({ ok: true }));
    },
    { prefix: "/v1" },
  );
  await app.ready();
  return { app, rows };
}

describe("audit plugin", () => {
  it("names a known route's action and entity from the route table", async () => {
    const { app, rows } = await appWithAudit();
    await app.inject({ method: "PATCH", url: "/v1/orders/abc/accept" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "order.accepted",
      category: "order",
      entityType: "order",
      entityId: "abc",
      outcome: "success",
      actorType: "anonymous",
    });
  });

  it("takes a new entity's id from the reply", async () => {
    const { app, rows } = await appWithAudit();
    await app.inject({ method: "POST", url: "/v1/orders", payload: { orderType: "buy_for_me" } });
    expect(rows[0]).toMatchObject({ action: "order.created", entityId: "new-order" });
    expect(rows[0]!.metadata).toMatchObject({ orderType: "buy_for_me" });
  });

  it("records a refusal as a denied security event", async () => {
    const { app, rows } = await appWithAudit();
    await app.inject({ method: "PATCH", url: "/v1/orders/abc/deliver" });
    expect(rows[0]).toMatchObject({ category: "security", action: "security.forbidden", outcome: "denied" });
  });

  it("does not double-log a request whose handler described itself", async () => {
    const { app, rows } = await appWithAudit();
    await app.inject({ method: "POST", url: "/v1/orders/x/cancel-described" });
    expect(rows.map((r) => r.action)).toEqual(["order.custom"]);
  });

  it("skips validation failures and plain reads", async () => {
    const { app, rows } = await appWithAudit();
    await app.inject({ method: "POST", url: "/v1/orders/bad" });
    await app.inject({ method: "GET", url: "/v1/orders/abc" });
    expect(rows).toHaveLength(0);
  });
});
