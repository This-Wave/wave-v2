import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { authRoutes } from "../routes";

const { mockCreateUser } = vi.hoisted(() => ({
  mockCreateUser: vi.fn(),
}));

vi.mock("../../lib/supabaseServer", () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: vi.fn(),
      },
      signInWithPassword: vi.fn(),
    },
  })),
}));

describe("POST /auth/register — negative authz (H9)", () => {
  it("rejects admin role before creating a Supabase user", async () => {
    mockCreateUser.mockClear();

    const app = await buildTestApp(authRoutes, {
      prisma: { profile: { create: vi.fn() } },
      prefix: "/auth",
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        fullName: "Bad Actor",
        phone: "+233241234567",
        password: "password123",
        role: "admin",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
    await app.close();
  });
});
