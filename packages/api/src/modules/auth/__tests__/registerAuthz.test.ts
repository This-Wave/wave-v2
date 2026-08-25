import { describe, expect, it, vi } from "vitest";
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

describe("POST /auth/register — negative authz (H9)", () => {
  it("rejects admin role before touching Supabase at all", async () => {
    mockGetUser.mockClear();
    mockUpdateUserById.mockClear();

    const app = await buildTestApp(authRoutes, {
      prisma: { profile: { create: vi.fn(), findUnique: vi.fn() } },
      prefix: "/auth",
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      // A verified session for this very number — the escalation must fail on
      // the role alone, not because the caller was unauthenticated.
      headers: { authorization: "Bearer valid-token" },
      payload: {
        fullName: "Bad Actor",
        phone: "+233241234567",
        password: "password123",
        role: "admin",
      },
    });

    expect(res.statusCode).toBe(400);
    // Schema rejection comes first, so no password is ever set.
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpdateUserById).not.toHaveBeenCalled();
    await app.close();
  });
});
