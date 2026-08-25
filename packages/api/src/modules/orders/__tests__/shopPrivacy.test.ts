import { describe, expect, test, vi } from "vitest";
import { redactStudentContactForShop, type OrderAccessUser } from "../access";
import { buildTestApp } from "../../../test/harness";
import { orderRoutes } from "../routes";

vi.mock("../../notifications/dispatch", () => ({
  notifyOrderStatus: vi.fn(),
  notifyGoodsCostRecorded: vi.fn(),
}));
vi.mock("../../payments/refund", () => ({ endOrderWithRefund: vi.fn() }));

/**
 * A shop owner must not receive the student's contact details (review
 * 07-privacy, H3).
 *
 * `feedOrder` already exists because a rider could otherwise sign up, never
 * deliver, and harvest the phone number of every student ordering on campus.
 * The same attack works one step later through a shop: get verified, and every
 * order handed to you carries a phone number and an Ashesi ID. Nothing in the
 * shop UI reads either field.
 */
const SHOP_OWNER: OrderAccessUser = { id: "owner-1", role: "shop_owner" };
const RIDER: OrderAccessUser = { id: "rider-1", role: "rider" };
const ADMIN: OrderAccessUser = { id: "admin-1", role: "admin" };
const STUDENT: OrderAccessUser = { id: "student-1", role: "student" };

const order = (overrides: Record<string, unknown> = {}) => ({
  id: "order-1",
  // The FK column. Distinct from `student.studentId`, which is the Ashesi ID.
  studentId: "student-1",
  riderId: "rider-1",
  shopId: "shop-1",
  totalAmount: "40.00",
  student: {
    id: "student-1",
    fullName: "Ama Serwaa",
    phone: "+233241234567",
    studentId: "ASH-2027-0142",
  },
  ...overrides,
});

describe("redactStudentContactForShop", () => {
  test("strips phone and Ashesi ID for a shop owner", () => {
    const result = redactStudentContactForShop(order(), SHOP_OWNER);

    expect(result.student).not.toHaveProperty("phone");
    expect(result.student).not.toHaveProperty("studentId");
  });

  test("keeps the student's name — a shop sees whose order they are packing", () => {
    const result = redactStudentContactForShop(order(), SHOP_OWNER);

    expect(result.student).toMatchObject({ id: "student-1", fullName: "Ama Serwaa" });
  });

  test("leaves the rest of the order untouched", () => {
    const result = redactStudentContactForShop(order(), SHOP_OWNER);

    expect(result).toMatchObject({ id: "order-1", totalAmount: "40.00", shopId: "shop-1" });
  });

  test("no phone number survives anywhere in the serialised payload", () => {
    // Catches a future select that reintroduces the phone somewhere other than
    // `student` — on the rider relation, say, or a nested history entry.
    const result = redactStudentContactForShop(order(), SHOP_OWNER);

    expect(JSON.stringify(result)).not.toContain("+233241234567");
    expect(JSON.stringify(result)).not.toContain("ASH-2027-0142");
  });

  test("the assigned rider still gets the phone — they coordinate the handover", () => {
    const result = redactStudentContactForShop(order(), RIDER);

    expect(result.student).toMatchObject({ phone: "+233241234567" });
  });

  test("admins are unaffected", () => {
    const result = redactStudentContactForShop(order(), ADMIN);

    expect(result.student).toMatchObject({ phone: "+233241234567" });
  });

  test("the student sees their own details", () => {
    const result = redactStudentContactForShop(order(), STUDENT);

    expect(result.student).toMatchObject({ phone: "+233241234567" });
  });

  test("a shop owner who placed the order sees their own details", () => {
    // Access here derives from being the student, not from owning the shop.
    const owner = { id: "owner-1", role: "shop_owner" as const };
    const result = redactStudentContactForShop(order({ studentId: "owner-1" }), owner);

    expect(result.student).toMatchObject({ phone: "+233241234567" });
  });

  test("does not throw when the order carries no student relation", () => {
    const result = redactStudentContactForShop(order({ student: null }), SHOP_OWNER);

    expect(result.student).toBeNull();
  });

  test("does not mutate the input", () => {
    // The caller may still hold the original — notably `.map()` over a list.
    const input = order();
    redactStudentContactForShop(input, SHOP_OWNER);

    expect(input.student.phone).toBe("+233241234567");
  });
});

describe("GET /orders/shop — the route, not just the helper", () => {
  test("the shop order list carries no student phone or Ashesi ID", async () => {
    // The larger of the two exposures: one response containing every order the
    // shop has ever had is a standing export of their customers' contact
    // details.
    const prisma = {
      order: {
        findMany: vi.fn().mockResolvedValue([order(), order({ id: "order-2" })]),
      },
    };
    const app = await buildTestApp(orderRoutes, {
      prisma,
      user: { id: "owner-1", role: "shop_owner" },
    });

    const res = await app.inject({ method: "GET", url: "/shop" });

    expect(res.statusCode).toBe(200);
    expect(res.payload).not.toContain("+233241234567");
    expect(res.payload).not.toContain("ASH-2027-0142");
    // Still a usable list, not an empty one.
    expect(res.json().orders).toHaveLength(2);
    expect(res.json().orders[0].student.fullName).toBe("Ama Serwaa");
    await app.close();
  });
});
