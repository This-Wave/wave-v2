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

/** Columns on the order row itself. Never includes PIN hash or ciphertext. */
const orderScalars = {
  id: true,
  orderType: true,
  studentId: true,
  riderId: true,
  shopId: true,
  originCheckpointId: true,
  checkpointId: true,
  universityId: true,
  suggestionId: true,
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
  goodsPaidAt: true,
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

// `latitude`/`longitude` are included so a rider can be navigated to an exact
// pin rather than a name search (review 11-campus, H3). Admins have been able to
// record coordinates since the checkpoint model was written, but they were never
// selected here — so the data could be entered and was silently never used.
//
// A checkpoint is a public campus location, not personal information, which is
// why this is also safe to carry into the unclaimed rider feed.
const checkpointSelect = {
  select: { id: true, name: true, description: true, latitude: true, longitude: true },
} as const;

/**
 * The basket. Safe for every audience — it describes goods, never a person.
 *
 * Ordered by creation so the list a student built is the list a rider reads,
 * top to bottom; without it Postgres is free to return the rows in any order,
 * and a shopping list that reshuffles between two screens is one a runner
 * stops trusting.
 */
const itemsSelect = {
  select: {
    id: true,
    productId: true,
    name: true,
    unitPrice: true,
    quantity: true,
    actualUnitPrice: true,
  },
  orderBy: { createdAt: "asc" },
} as const;

/**
 * The suggested shop a `shop_pickup` buys from. Name and location only — this
 * is a place, not a person, and `studentId` on the suggestion must not travel
 * with it into the rider feed.
 */
const suggestionSelect = {
  select: { id: true, name: true, locationText: true, category: true, status: true },
} as const;

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
  suggestion: suggestionSelect,
  items: itemsSelect,
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
  // Same reasoning for a shop_pickup: the suggested shop's name and location are
  // the job. `suggestionSelect` deliberately omits the suggestion's `studentId`.
  suggestion: suggestionSelect,
  // A rider deciding whether to take a job needs to know they are being asked to
  // carry twelve crates rather than one envelope. Items are goods, not people.
  items: itemsSelect,
} as const;
