import { describe, expect, test } from "vitest";
import { completeProfileSchema } from "../auth";
import { submitVerificationSchema } from "../rider";
import { ALLOWED_ID_TYPES_BY_RIDER_TYPE, RIDER_EARNING_PCT_KEY } from "../../constants/platform";

/**
 * Student riders and riders hired from outside the university.
 *
 * The distinction decides which documents someone must produce, what share of
 * the delivery fee they earn, and which checkpoints they may deliver to — so
 * the ways it can be got wrong are all quiet ones. These cover the boundaries
 * that are cheap to state and expensive to discover in production.
 */
const base = { fullName: "Yaw Darko", universityId: "3f1a5b2c-4d5e-6f70-8192-a3b4c5d6e7f8" };

describe("riderType on signup", () => {
  test("a rider must say which kind they are", () => {
    const result = completeProfileSchema.safeParse({ ...base, role: "rider" });
    expect(result.success).toBe(false);
  });

  test("both kinds of rider are accepted", () => {
    for (const riderType of ["student", "external"] as const) {
      expect(completeProfileSchema.safeParse({ ...base, role: "rider", riderType }).success).toBe(true);
    }
  });

  test("a non-rider carrying a rider type is rejected, not quietly ignored", () => {
    // Dropping it silently would leave a shop owner with a value that anything
    // later reading the column for pay or access would act on.
    for (const role of ["student", "shop_owner"] as const) {
      const result = completeProfileSchema.safeParse({ ...base, role, riderType: "external" });
      expect(result.success, `${role} should not carry a riderType`).toBe(false);
    }
  });

  test("students and shop owners still sign up with no rider type", () => {
    expect(completeProfileSchema.safeParse({ ...base, role: "student" }).success).toBe(true);
    expect(completeProfileSchema.safeParse({ ...base, role: "shop_owner" }).success).toBe(true);
  });

  test("admin can never be chosen", () => {
    expect(completeProfileSchema.safeParse({ ...base, role: "admin" }).success).toBe(false);
  });
});

describe("which ID each kind of rider may use", () => {
  test("a student rider must prove it with a student ID", () => {
    // Without the document, "I'm a student" sets their own pay and access.
    expect(ALLOWED_ID_TYPES_BY_RIDER_TYPE.student).toEqual(["student_id"]);
  });

  test("an external rider may not use a student ID", () => {
    // A student ID belonging to a non-student identifies nobody.
    expect(ALLOWED_ID_TYPES_BY_RIDER_TYPE.external).not.toContain("student_id");
    expect(ALLOWED_ID_TYPES_BY_RIDER_TYPE.external).toEqual(["ghana_card", "passport"]);
  });
});

describe("the external rider's extra evidence", () => {
  const paths = {
    idImagePath: "rider-1/id-1.jpg",
    selfiePath: "rider-1/selfie-1.jpg",
  };

  test("a plain submission is still valid — the API decides what is required", () => {
    // The schema cannot know the submitter's type; only the server can read it
    // from the profile. Requiring the fields here would mean trusting the
    // client's word for which kind of rider it is.
    const result = submitVerificationSchema.safeParse({
      idType: "ghana_card",
      idNumber: "GHA-1",
      ...paths,
    });
    expect(result.success).toBe(true);
  });

  test("the second ID must be a different document from the first", () => {
    // Otherwise "two forms of ID" is one form of ID entered twice.
    const result = submitVerificationSchema.safeParse({
      idType: "ghana_card",
      idNumber: "GHA-1",
      secondIdType: "ghana_card",
      secondIdNumber: "GHA-2",
      ...paths,
    });
    expect(result.success).toBe(false);
  });

  test("a genuinely second document is accepted", () => {
    const result = submitVerificationSchema.safeParse({
      idType: "ghana_card",
      idNumber: "GHA-1",
      secondIdType: "passport",
      secondIdNumber: "G0123456",
      ...paths,
    });
    expect(result.success).toBe(true);
  });
});

describe("pay", () => {
  test("each kind of rider reads its own config key", () => {
    // One shared key would mean changing a student's rate silently changed an
    // external rider's too.
    expect(RIDER_EARNING_PCT_KEY.student).toBe("rider_earning_pct_student");
    expect(RIDER_EARNING_PCT_KEY.external).toBe("rider_earning_pct_external");
    expect(RIDER_EARNING_PCT_KEY.student).not.toBe(RIDER_EARNING_PCT_KEY.external);
  });
});
