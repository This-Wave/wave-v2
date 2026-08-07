// Order field selections.
//
// ⚠️ "Client-safe" is not a property of a field list — it depends on who is
// receiving it. There is deliberately more than one select here, because the
// same order is seen by four different audiences:
//
//   the student who placed it   — may see their own details and their runner's
//   the rider who claimed it    — may see the student, to coordinate handover
//   a rider browsing the feed   — has claimed nothing, so may see NEITHER
//   the shop fulfilling it      — may see the student, they are serving them
//
// Do not collapse these back into one object. A single shared select is exactly
// how `GET /orders/available` came to serve every waiting student's full name,
// phone number and student ID to every rider on campus.

/** Columns on the order row itself. Never includes `deliveryPinHash`. */
const orderScalars = {
  id: true,
  orderType: true,
  studentId: true,
  riderId: true,
  shopId: true,
  originCheckpointId: true,
  checkpointId: true,
  universityId: true,
  itemDescription: true,
  productId: true,
  itemPrice: true,
  deliveryFee: true,
  discountApplied: true,
  surchargeApplied: true,
  totalAmount: true,
  deliveryDay: true,
  scheduledDate: true,
  isSpecialOrder: true,
  status: true,
  paidAt: true,
  shopAcceptedAt: true,
  deliveredAt: true,
  notes: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

const shopSelect = {
  select: { id: true, name: true, locationText: true, category: true, logoUrl: true },
} as const;

const checkpointSelect = { select: { id: true, name: true, description: true } } as const;

const studentSelect = {
  select: { id: true, fullName: true, phone: true, studentId: true },
} as const;

const riderSelect = { select: { id: true, fullName: true, phone: true } } as const;

/**
 * The full view. For anyone with a legitimate relationship to this specific
 * order: the student who placed it, the rider who has claimed it, the shop
 * fulfilling it, and admins.
 *
 * `delivery_pin_hash` is NEVER selected here (see GOTCHA-003 in debug.md).
 */
export const clientSafeOrder = {
  ...orderScalars,
  shop: shopSelect,
  checkpoint: checkpointSelect,
  originCheckpoint: checkpointSelect,
  student: studentSelect,
  rider: riderSelect,
} as const;

/**
 * The rider feed. Unclaimed orders, shown to every verified rider on campus.
 *
 * **No `student` and no `rider`.** A rider deciding whether to take a job needs
 * the shop, the destination and the fee — nothing about the person. They get
 * the student's name and number the moment they accept, via `clientSafeOrder`
 * on `/my-deliveries` and `GET /orders/:id`.
 *
 * This matters more than it looks: the feed polls every 10 seconds, so a
 * shared select made it possible for someone to sign up as a rider, never
 * deliver anything, and harvest the contact details of every student ordering
 * on campus.
 */
export const feedOrder = {
  ...orderScalars,
  shop: shopSelect,
  checkpoint: checkpointSelect,
  // A pickup's origin is a public campus location, not personal information —
  // and a rider cannot judge the job without knowing where they are collecting.
  originCheckpoint: checkpointSelect,
} as const;
