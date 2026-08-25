import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { authRoutes } from "../routes";

const { mockGetUser, mockUpdateUserById } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockUpdateUserById: vi.fn(),
}));

vi.mock("../../../lib/supabaseServer", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      admin: { updateUserById: mockUpdateUserById },
      signInWithPassword: vi.fn(),
    },
  })),
}));

/**
 * `POST /auth/register` must prove the caller owns the phone number before it
 * sets a password on it (review 01-cybersecurity, H1).
 *
 * The old route called `admin.createUser({ phone_confirm: true })` on an
 * unauthenticated request, which let anyone claim any number. That is account
 * takeover by pre-registration: the victim's later OTP sign-in resolves to the
 * attacker's Supabase user, whose password the attacker knows.
 */
const VALID_BODY = {
  fullName: "Ama Serwaa",
  phone: "+233241234567",
  password: "password123",
  role: "student" as const,
};

// Supabase stores phone without the leading `+`.
const SESSION_USER = { id: "user-1", phone: "233241234567" };

function makePrisma(existingProfile: unknown = null) {
  return {
    profile: {
      findUnique: vi.fn().mockResolvedValue(existingProfile),
      create: vi.fn().mockResolvedValue({ id: "user-1", fullName: VALID_BODY.fullName }),
    },
  };
}

async function register(
  prisma: unknown,
  opts: { token?: string; body?: Record<string, unknown> } = {},
) {
  const app = await buildTestApp(authRoutes, { prisma, prefix: "/auth" });
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: opts.token ? { authorization: `Bearer ${opts.token}` } : {},
    payload: { ...VALID_BODY, ...opts.body },
  });
  await app.close();
  return res;
}

beforeEach(() => {
  mockGetUser.mockReset().mockResolvedValue({ data: { user: SESSION_USER }, error: null });
  mockUpdateUserById.mockReset().mockResolvedValue({ data: { user: SESSION_USER }, error: null });
});

describe("POST /auth/register — phone ownership proof (H1)", () => {
  test("401s an unauthenticated caller and sets no password", async () => {
    const prisma = makePrisma();

    const res = await register(prisma);

    expect(res.statusCode).toBe(401);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });

  test("401s an invalid or expired token", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "bad jwt" } });
    const prisma = makePrisma();

    const res = await register(prisma, { token: "expired" });

    expect(res.statusCode).toBe(401);
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });

  test("403s when the session's phone is not the one being registered", async () => {
    // The core attack: verify your own number, register someone else's.
    const prisma = makePrisma();

    const res = await register(prisma, {
      token: "valid",
      body: { phone: "+233209999999" },
    });

    expect(res.statusCode).toBe(403);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });

  test("403s a session with no phone at all", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const prisma = makePrisma();

    const res = await register(prisma, { token: "valid" });

    expect(res.statusCode).toBe(403);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  test("accepts the verified number despite the +233 / 233 formatting difference", async () => {
    // Supabase returns `233…`, Wave sends E.164 `+233…`. A literal === here
    // would reject every legitimate caller.
    const prisma = makePrisma();

    const res = await register(prisma, { token: "valid" });

    expect(res.statusCode).toBe(201);
    expect(mockUpdateUserById).toHaveBeenCalledWith("user-1", { password: VALID_BODY.password });
  });

  test("creates the profile against the session's user id, not anything client-sent", async () => {
    const prisma = makePrisma();

    await register(prisma, { token: "valid", body: { id: "attacker-chosen" } });

    expect(prisma.profile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ id: "user-1", phone: VALID_BODY.phone }),
      }),
    );
  });

  test("409s when a profile already exists, without resetting the password", async () => {
    // Otherwise register doubles as an unauthenticated password reset for any
    // account whose owner's session you happen to hold.
    const prisma = makePrisma({ id: "user-1" });

    const res = await register(prisma, { token: "valid" });

    expect(res.statusCode).toBe(409);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });

  test("does not mark riders verified", async () => {
    const prisma = makePrisma();

    await register(prisma, { token: "valid", body: { role: "rider" } });

    expect(prisma.profile.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isVerified: false }) }),
    );
  });

  test("surfaces a Supabase password failure as a 400 and creates no profile", async () => {
    mockUpdateUserById.mockResolvedValue({ data: null, error: { message: "Password too weak" } });
    const prisma = makePrisma();

    const res = await register(prisma, { token: "valid" });

    expect(res.statusCode).toBe(400);
    expect(prisma.profile.create).not.toHaveBeenCalled();
  });
});
