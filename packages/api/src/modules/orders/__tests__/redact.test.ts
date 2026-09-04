import { describe, expect, test } from "vitest";
import { redactClosedOrderContacts, redactClosedOrderContactsAll, isClosed } from "../redact";

/**
 * Contact details that expire with the order.
 *
 * A student and the rider carrying their order need each other's numbers, and
 * both apps have a call button for it. What nobody granted is keeping those
 * numbers afterwards — a rider who has delivered to fifty students was holding
 * fifty phone numbers with no ongoing reason to have any of them.
 */
const live = {
  status: "at_checkpoint",
  student: { fullName: "Ama", phone: "233241234567" },
  rider: { fullName: "Kofi", phone: "233551234567" },
};
const closed = { ...live, status: "delivered" };

describe("while the order is live", () => {
  test("the student can still call the rider", () => {
    expect(redactClosedOrderContacts(live, "student").rider?.phone).toBe("233551234567");
  });

  test("the rider can still call the student", () => {
    expect(redactClosedOrderContacts(live, "rider").student?.phone).toBe("233241234567");
  });
});

describe("once the order is over", () => {
  test("the student loses the rider's number", () => {
    expect(redactClosedOrderContacts(closed, "student").rider?.phone).toBeNull();
  });

  test("the rider loses the student's number", () => {
    expect(redactClosedOrderContacts(closed, "rider").student?.phone).toBeNull();
  });

  test("each side keeps its own number", () => {
    // A student looking at their own order should still see their own details.
    expect(redactClosedOrderContacts(closed, "student").student?.phone).toBe("233241234567");
    expect(redactClosedOrderContacts(closed, "rider").rider?.phone).toBe("233551234567");
  });

  test("names survive", () => {
    // "Delivered by Kofi" is what makes a history readable, and a rider's own
    // delivery list is meaningless without who it went to.
    const forStudent = redactClosedOrderContacts(closed, "student");
    expect(forStudent.rider?.fullName).toBe("Kofi");
    expect(forStudent.student?.fullName).toBe("Ama");
  });
});

describe("cancelled and refunded count as over", () => {
  test.each(["cancelled", "refunded"])("%s hides the counterpart", (status) => {
    // Nobody is carrying anything, so there is nothing left to coordinate.
    expect(redactClosedOrderContacts({ ...live, status }, "student").rider?.phone).toBeNull();
  });

  test.each(["pending", "payment_pending", "confirmed", "rider_assigned", "en_route", "at_checkpoint"])(
    "%s is still live",
    (status) => {
      expect(redactClosedOrderContacts({ ...live, status }, "student").rider?.phone).toBe(
        "233551234567",
      );
    },
  );
});

describe("admins", () => {
  test("see everything, on any status", () => {
    // Disputes are worked after the fact. Support cannot resolve "the wrong
    // person took my order" against a redacted row.
    const forAdmin = redactClosedOrderContacts(closed, "admin");
    expect(forAdmin.rider?.phone).toBe("233551234567");
    expect(forAdmin.student?.phone).toBe("233241234567");
  });
});

describe("edges", () => {
  test("an order with no rider does not explode", () => {
    const noRider = { status: "delivered", student: { fullName: "Ama", phone: "233241234567" } };
    expect(() => redactClosedOrderContacts(noRider, "student")).not.toThrow();
  });

  test("an unknown status is treated as live, not closed", () => {
    // Failing open on contact is right: a new status that nobody remembered to
    // list should not silently cut off two people mid-delivery.
    expect(isClosed("some_new_status")).toBe(false);
  });

  test("the original object is not mutated", () => {
    // The same rows are handed to more than one caller in a list response.
    const order = { ...closed };
    redactClosedOrderContacts(order, "student");
    expect(order.rider.phone).toBe("233551234567");
  });

  test("the list form redacts every row", () => {
    const rows = redactClosedOrderContactsAll([closed, { ...closed }], "rider");
    expect(rows.every((r) => r.student?.phone === null)).toBe(true);
  });
});
