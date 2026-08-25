import { describe, expect, test } from "vitest";
import {
  changePasswordSchema,
  completeProfileSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "../auth";
import { PROFILE_ROLES, SELF_SERVE_PROFILE_ROLES } from "../../constants/platform";

/**
 * The auth schemas are where privilege is decided, so the tests that matter
 * here are the negative ones: `admin` must be unreachable from every
 * self-serve entry point, and `updateProfileSchema` must refuse the
 * privilege-bearing columns outright rather than leaving it to the route to
 * remember not to copy them.
 *
 * (Review 02-qa-engineer, L1.)
 */
const UUID = "11111111-1111-4111-8111-111111111111";

describe("SELF_SERVE_PROFILE_ROLES", () => {
  test("is PROFILE_ROLES minus admin", () => {
    // Pins the relationship rather than the literal list, so adding a role in
    // one place and forgetting the other shows up here.
    expect([...SELF_SERVE_PROFILE_ROLES].sort()).toEqual(
      PROFILE_ROLES.filter((r) => r !== "admin").sort(),
    );
    expect(SELF_SERVE_PROFILE_ROLES).not.toContain("admin");
  });
});

describe("registerSchema", () => {
  const valid = {
    fullName: "Ama Serwaa",
    phone: "+233241234567",
    password: "password123",
    role: "student",
  };

  test("accepts a minimal registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects role admin", () => {
    expect(registerSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });

  test.each(SELF_SERVE_PROFILE_ROLES)("accepts self-serve role %s", (role) => {
    expect(registerSchema.safeParse({ ...valid, role }).success).toBe(true);
  });

  test("requires a role — an absent one must not default to anything", () => {
    const { role: _omitted, ...withoutRole } = valid;
    expect(registerSchema.safeParse(withoutRole).success).toBe(false);
  });

  test("rejects a password under 8 characters", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short12" }).success).toBe(false);
  });

  test.each(["", "12345678", "+2332412345678901234"])("rejects phone %s", (phone) => {
    expect(registerSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });

  test("treats email as optional but validates it when present", () => {
    expect(registerSchema.safeParse({ ...valid, email: undefined }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, email: "ama@ashesi.edu.gh" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  test("rejects a non-uuid universityId", () => {
    expect(registerSchema.safeParse({ ...valid, universityId: "ashesi" }).success).toBe(false);
  });
});

describe("completeProfileSchema", () => {
  const valid = { fullName: "Ama Serwaa", role: "student" };

  test("accepts a minimal profile", () => {
    expect(completeProfileSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects role admin — the other self-serve door", () => {
    expect(completeProfileSchema.safeParse({ ...valid, role: "admin" }).success).toBe(false);
  });

  test("rejects a one-character name", () => {
    expect(completeProfileSchema.safeParse({ ...valid, fullName: "A" }).success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  test("accepts an empty object — every field is optional", () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });

  test("accepts a valid partial update", () => {
    expect(
      updateProfileSchema.safeParse({
        fullName: "Ama Serwaa",
        avatarUrl: "https://cdn.example.com/a.png",
        email: null,
      }).success,
    ).toBe(true);
  });

  test.each(["role", "isVerified", "isActive", "universityId", "phone", "id"])(
    "rejects the privilege-bearing field %s",
    (field) => {
      // `.strict()` rather than relying on the route to copy fields one by one.
      expect(updateProfileSchema.safeParse({ [field]: "x" }).success).toBe(false);
    },
  );

  test("allows email null to clear it, unlike register", () => {
    expect(updateProfileSchema.safeParse({ email: null }).success).toBe(true);
    expect(registerSchema.safeParse({
      fullName: "Ama Serwaa",
      phone: "+233241234567",
      password: "password123",
      role: "student",
      email: null,
    }).success).toBe(false);
  });

  test.each([
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["file:", "file:///etc/passwd"],
    ["a bare host", "cdn.example.com/a.png"],
  ])("rejects an avatarUrl using %s", (_label, avatarUrl) => {
    // Zod's .url() accepts the first three. Stored and rendered as an avatar
    // src by the admin dashboard, they are stored XSS.
    expect(updateProfileSchema.safeParse({ avatarUrl }).success).toBe(false);
  });

  test.each(["http://cdn.example.com/a.png", "https://cdn.example.com/a.png"])(
    "accepts %s",
    (avatarUrl) => {
      expect(updateProfileSchema.safeParse({ avatarUrl }).success).toBe(true);
    },
  );

  test("caps avatarUrl length", () => {
    const long = `https://cdn.example.com/${"a".repeat(500)}.png`;
    expect(updateProfileSchema.safeParse({ avatarUrl: long }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  test("accepts a phone and password", () => {
    expect(loginSchema.safeParse({ phone: "+233241234567", password: "password123" }).success).toBe(
      true,
    );
  });

  test("rejects a missing password", () => {
    expect(loginSchema.safeParse({ phone: "+233241234567" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  test("requires both passwords at full length", () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: "password123", newPassword: "newpass456" })
        .success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "password123", newPassword: "short" })
        .success,
    ).toBe(false);
  });
});

describe("schema/constant drift", () => {
  test("UUID fields accept a real uuid", () => {
    expect(
      completeProfileSchema.safeParse({ fullName: "Ama", role: "student", universityId: UUID })
        .success,
    ).toBe(true);
  });
});
