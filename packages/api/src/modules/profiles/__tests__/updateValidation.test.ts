import { describe, expect, test, vi } from "vitest";
import type { LightMyRequestResponse } from "fastify";
import { buildTestApp } from "../../../test/harness";
import { profileRoutes } from "../routes";

/**
 * `PUT /profiles/me` used to cast `request.body` and hand-roll an email regex
 * (review 01-cybersecurity, M7). These pin the Zod contract that replaced it —
 * in particular that privilege-bearing columns are rejected rather than
 * silently ignored, so the guarantee survives someone later switching to a
 * spread into Prisma.
 */
function makePrisma() {
  return {
    profile: {
      update: vi.fn().mockResolvedValue({ id: "user-1", fullName: "Ama" }),
    },
  };
}

async function put(
  prisma: unknown,
  payload: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  const app = await buildTestApp(profileRoutes, {
    prisma,
    user: { id: "user-1", role: "student" },
  });
  const res = await app.inject({ method: "PUT", url: "/me", payload });
  await app.close();
  return res;
}

describe("PUT /profiles/me — payload validation (M7)", () => {
  test("rejects a role escalation attempt instead of ignoring it", async () => {
    const prisma = makePrisma();
    const res = await put(prisma, { fullName: "Ama", role: "admin" });

    expect(res.statusCode).toBe(400);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  test.each(["isVerified", "isActive", "universityId", "phone"])(
    "rejects an unknown/privileged field: %s",
    async (field) => {
      const prisma = makePrisma();
      const res = await put(prisma, { fullName: "Ama", [field]: "x" });

      expect(res.statusCode).toBe(400);
      expect(prisma.profile.update).not.toHaveBeenCalled();
    },
  );

  test("rejects a malformed email", async () => {
    const prisma = makePrisma();
    const res = await put(prisma, { email: "not-an-email" });

    expect(res.statusCode).toBe(400);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  test.each([
    ["not a URL at all", "shop.example.com/a.png"],
    // Zod's .url() accepts these; only the scheme refinement rejects them.
    // Stored and rendered as an avatar src, they are stored XSS.
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
  ])("rejects an avatarUrl that is %s", async (_label, avatarUrl) => {
    const prisma = makePrisma();
    const res = await put(prisma, { avatarUrl });

    expect(res.statusCode).toBe(400);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  test("accepts an https avatarUrl", async () => {
    const prisma = makePrisma();
    const url = "https://cdn.example.com/avatars/user-1.png";
    const res = await put(prisma, { avatarUrl: url });

    expect(res.statusCode).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { avatarUrl: url },
    });
  });

  test("rejects a fullName below the minimum length", async () => {
    const prisma = makePrisma();
    const res = await put(prisma, { fullName: "A" });

    expect(res.statusCode).toBe(400);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  test("accepts a valid partial update and writes only what was sent", async () => {
    const prisma = makePrisma();
    const res = await put(prisma, { fullName: "Ama Serwaa" });

    expect(res.statusCode).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { fullName: "Ama Serwaa" },
    });
  });

  test("accepts null to clear the email", async () => {
    // Distinct from omitting it: null is a deliberate erase, and the schema
    // allows it here even though register/complete-profile do not.
    const prisma = makePrisma();
    const res = await put(prisma, { email: null });

    expect(res.statusCode).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { email: null },
    });
  });

  test("writes nothing but the id predicate for an empty body", async () => {
    const prisma = makePrisma();
    const res = await put(prisma, {});

    expect(res.statusCode).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {},
    });
  });
});
