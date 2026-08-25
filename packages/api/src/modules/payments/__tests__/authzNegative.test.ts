import { describe, expect, it, vi } from "vitest";
import { buildTestApp } from "../../../test/harness";
import { paymentRoutes } from "../routes";

vi.mock("../confirm", () => ({
  confirmDeliveryFeePaid: vi.fn(),
  confirmGoodsPaid: vi.fn(),
}));

vi.mock("../paystack", () => ({
  initiatePaystackPayment: vi.fn(),
  fetchPaystackTransaction: vi.fn(),
  paystackCustomerEmail: vi.fn((phone: string) => `${phone.replace(/\D/g, "")}@wave.app`),
  paystackErrorMessage: vi.fn(),
  verifyPaystackSignature: vi.fn(),
}));

describe("POST /payments/initiate — negative authz (H9)", () => {
  it("returns 403 when a student tries to pay for another student's order", async () => {
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          studentId: "student-1",
          status: "payment_pending",
          paidAt: null,
          totalAmount: "45",
        }),
        update: vi.fn(),
      },
      profile: {
        findUnique: vi.fn().mockResolvedValue({ phone: "+233241234567" }),
      },
    };

    const app = await buildTestApp(paymentRoutes, {
      prisma,
      user: { id: "student-2", role: "student" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/initiate",
      payload: { orderId: "order-1", method: "card" },
    });

    expect(res.statusCode).toBe(403);
    await app.close();
  });
});
