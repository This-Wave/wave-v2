/**
 * Demo data for screenshots and the walkthrough video.
 *
 * Fills every list a user can see — orders in each status, rider earnings,
 * shop orders, suggestions, refunds, beta applications, a rider awaiting
 * review — on top of `prisma/seed.ts`. Every row this script owns has an id
 * starting `de000000-`, so it can be removed without touching anything else:
 *
 *   npx tsx --env-file=.env scripts/seed-demo.ts          # write (idempotent)
 *   npx tsx --env-file=.env scripts/seed-demo.ts --clean  # remove it all
 *
 * The extra students and riders are database rows only — they have no
 * Supabase auth user and cannot sign in. Only the four seed-auth accounts can.
 *
 * Delivery PINs are real: bcrypt for the rider's check, AES-GCM ciphertext
 * (keyed off JWT_SECRET from packages/api/.env) so Ama can read hers in-app.
 */
import { PrismaClient, type OrderStatus, type OrderType } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();
const PREFIX = "de000000-0000-4000-8000-";
const id = (n: number) => `${PREFIX}${String(n).padStart(12, "0")}`;

const UNI = "f9e332e2-3e72-482e-96e1-2ebbecc8539b";
const AMA = "6a2f924d-256d-4599-a239-6b71ce9a7e25";
const KOFI = "4e45b6f3-0da4-446b-a547-2cf8138028e0";
const ADMIN = "f9aa5728-6af6-4d0b-9609-a079e1eea924";
const MAMA_PUT = "00000000-0000-0000-0000-000000000301";
const FRESH_MART = "00000000-0000-0000-0000-000000000302";
const PHARMACY = "00000000-0000-0000-0000-000000000303";
const CP = {
  quad: "00000000-0000-0000-0000-000000000101",
  hostelA: "00000000-0000-0000-0000-000000000102",
  gate: "00000000-0000-0000-0000-000000000103",
  library: "00000000-0000-0000-0000-000000000104",
  sports: "00000000-0000-0000-0000-000000000105",
  courtyard: "00000000-0000-0000-0000-000000000106",
};
const JOLLOF = "00000000-0000-0000-0000-000000000401";
const WATER = "00000000-0000-0000-0000-000000000411";
const BREAD = "00000000-0000-0000-0000-000000000412";
const MILO = "00000000-0000-0000-0000-000000000414";
const PARACETAMOL = "00000000-0000-0000-0000-000000000421";

function jwtSecret(): string {
  const env = readFileSync(resolve(__dirname, "../../api/.env"), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("JWT_SECRET="));
  if (!line) throw new Error("JWT_SECRET missing from packages/api/.env");
  return line.slice("JWT_SECRET=".length).trim().replace(/^["'](.*)["']$/, "$1");
}

/** Mirrors packages/api/src/modules/orders/pinCrypto.ts. */
function encryptPin(pin: string, secret: string): string {
  const key = crypto.createHash("sha256").update(`wave-delivery-pin:v1:${secret}`).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

/** The next Sunday or Wednesday on or after `from`. */
function nextWave(from = new Date()): Date {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  while (d.getUTCDay() !== 0 && d.getUTCDay() !== 3) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const dayOf = (d: Date) => (d.getUTCDay() === 3 ? "wednesday" : "sunday") as "sunday" | "wednesday";

async function clean(): Promise<void> {
  const like = { startsWith: PREFIX };
  await prisma.refundRequest.deleteMany({ where: { id: like } });
  await prisma.riderEarning.deleteMany({ where: { id: like } });
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: like } });
  await prisma.orderItem.deleteMany({ where: { orderId: like } });
  await prisma.order.deleteMany({ where: { id: like } });
  await prisma.shopSuggestion.deleteMany({ where: { id: like } });
  await prisma.betaFeedback.deleteMany({ where: { id: like } });
  await prisma.betaApplication.deleteMany({ where: { id: like } });
  await prisma.riderVerification.deleteMany({ where: { id: like } });
  await prisma.studentDeliveryStats.deleteMany({ where: { studentId: like } });
  await prisma.profile.deleteMany({ where: { id: like } });
  console.log("Removed all demo rows.");
}

interface DemoOrder {
  n: number;
  studentId: string;
  type: OrderType;
  status: OrderStatus;
  description: string;
  riderId?: string;
  shopId?: string;
  from?: string;
  to: string;
  items?: { productId: string | null; name: string; unitPrice: number | null; quantity: number }[];
  fee?: number;
  date: Date;
  pin?: string;
  shopAccepted?: boolean;
  suggestionId?: string;
  cancellationReason?: string;
  failureReason?: "abandoned_payment" | "student_cancelled" | "shop_rejected" | "admin_refunded" | "out_of_stock" | "no_rider";
  createdAt?: Date;
}

/** Status history a real order would have accumulated on its way to `status`. */
const PATH: OrderStatus[] = ["payment_pending", "confirmed", "rider_assigned", "en_route", "at_checkpoint", "delivered"];

async function writeOrder(o: DemoOrder, secret: string): Promise<void> {
  const itemTotal = (o.items ?? []).reduce((s, i) => s + (i.unitPrice ?? 0) * i.quantity, 0);
  const fee = o.fee ?? 20;
  const paid = !["payment_pending", "pending"].includes(o.status) && !(o.status === "cancelled" && o.failureReason === "abandoned_payment");
  const created = o.createdAt ?? daysAgo(1);
  const orderId = id(o.n);
  // Payment issues the PIN, so every paid order still in flight carries one.
  const inFlight = paid && ["confirmed", "rider_assigned", "en_route", "at_checkpoint"].includes(o.status);
  const pin = o.pin ?? (inFlight ? String(crypto.randomInt(100_000, 1_000_000)) : undefined);
  const pinFields = pin
    ? { deliveryPinHash: await bcrypt.hash(pin, 10), deliveryPinCiphertext: encryptPin(pin, secret) }
    : { deliveryPinHash: null, deliveryPinCiphertext: null };

  const data = {
    studentId: o.studentId,
    riderId: o.riderId ?? null,
    shopId: o.shopId ?? null,
    originCheckpointId: o.from ?? null,
    suggestionId: o.suggestionId ?? null,
    checkpointId: o.to,
    universityId: UNI,
    orderType: o.type,
    itemDescription: o.description,
    productId: o.items?.[0]?.productId ?? null,
    itemPrice: o.items && o.type !== "shop_pickup" ? itemTotal.toFixed(2) : null,
    deliveryFee: fee.toFixed(2),
    totalAmount: (itemTotal + fee).toFixed(2),
    deliveryDay: dayOf(o.date),
    scheduledDate: o.date,
    status: o.status,
    shopAcceptedAt: o.shopAccepted ? created : null,
    paidAt: paid ? created : null,
    deliveredAt: o.status === "delivered" ? o.date : null,
    cancellationReason: o.cancellationReason ?? null,
    failureReason: o.failureReason ?? null,
    createdAt: created,
    ...pinFields,
  };
  await prisma.order.upsert({ where: { id: orderId }, update: data, create: { id: orderId, ...data } });

  await prisma.orderItem.deleteMany({ where: { orderId } });
  for (const [i, item] of (o.items ?? []).entries()) {
    await prisma.orderItem.create({
      data: { id: id(o.n * 100 + i + 50_000), orderId, productId: item.productId, name: item.name, unitPrice: item.unitPrice === null ? null : item.unitPrice.toFixed(2), quantity: item.quantity },
    });
  }

  await prisma.orderStatusHistory.deleteMany({ where: { orderId } });
  const reached = PATH.indexOf(o.status);
  const steps: OrderStatus[] = reached >= 0 ? PATH.slice(0, reached + 1) : ["payment_pending", ...(paid ? (["confirmed"] as OrderStatus[]) : []), o.status];
  for (const [i, status] of steps.entries()) {
    await prisma.orderStatusHistory.create({
      data: {
        id: id(o.n * 100 + i + 90_000),
        orderId,
        status,
        changedBy: ["rider_assigned", "en_route", "at_checkpoint", "delivered"].includes(status) ? o.riderId ?? null : null,
        createdAt: new Date(created.getTime() + i * 25 * 60_000),
      },
    });
  }
}

async function main(): Promise<void> {
  if (process.argv.includes("--clean")) return clean();
  const secret = jwtSecret();
  const wave = nextWave();
  const lastWave = nextWave(daysAgo(7));

  // ── People ─────────────────────────────────────────────────────────────
  const students = [
    { n: 1, name: "Kwame Mensah", phone: "+233249990001", sid: "ASH0412" },
    { n: 2, name: "Efua Asante", phone: "+233249990002", sid: "ASH0377" },
    { n: 3, name: "Yaw Darko", phone: "+233249990003", sid: "ASH0508" },
    { n: 4, name: "Akosua Nyarko", phone: "+233249990004", sid: "ASH0199" },
    { n: 5, name: "Nana Adjei", phone: "+233249990005", sid: "ASH0621" },
    { n: 6, name: "Selasi Agbeko", phone: "+233249990006", sid: "ASH0433" },
  ];
  for (const s of students) {
    const data = { universityId: UNI, fullName: s.name, phone: s.phone, studentId: s.sid, role: "student" as const, isVerified: true, createdAt: daysAgo(40 - s.n * 5) };
    await prisma.profile.upsert({ where: { id: id(s.n) }, update: data, create: { id: id(s.n), ...data } });
  }
  const S = (n: number) => id(n);

  const riders = [
    { n: 11, name: "Esi Quaye", phone: "+233559990011", type: "student" as const, status: "approved" as const },
    { n: 12, name: "Kojo Appiah", phone: "+233559990012", type: "external" as const, status: "approved" as const },
    { n: 13, name: "Abena Ofori", phone: "+233559990013", type: "student" as const, status: "pending" as const },
    { n: 14, name: "Fiifi Sarpong", phone: "+233559990014", type: "external" as const, status: "pending" as const },
    { n: 15, name: "Dela Kpodo", phone: "+233559990015", type: "external" as const, status: "rejected" as const },
  ];
  for (const r of riders) {
    const data = { universityId: UNI, fullName: r.name, phone: r.phone, role: "rider" as const, riderType: r.type, isVerified: r.status === "approved", createdAt: daysAgo(20 - r.n + 10) };
    await prisma.profile.upsert({ where: { id: id(r.n) }, update: data, create: { id: id(r.n), ...data } });
    const v = {
      riderId: id(r.n),
      idType: "ghana_card" as const,
      idNumber: `GHA-7${r.n}004512-${r.n % 9}`,
      idImagePath: "https://placehold.co/600x400?text=Ghana+Card",
      selfiePath: "https://placehold.co/600x600?text=Selfie",
      guarantorName: r.type === "external" ? "Mr. Emmanuel Tetteh" : null,
      guarantorPhone: r.type === "external" ? "+233244551122" : null,
      status: r.status,
      reviewedBy: r.status === "pending" ? null : ADMIN,
      reviewedAt: r.status === "pending" ? null : daysAgo(5),
      rejectionReason: r.status === "rejected" ? "The selfie does not match the ID photo. Please retake it in good light." : null,
      createdAt: daysAgo(r.status === "pending" ? 1 : 8),
    };
    await prisma.riderVerification.upsert({ where: { id: id(r.n + 100) }, update: v, create: { id: id(r.n + 100), ...v } });
  }
  const ESI = id(11);
  const KOJO = id(12);

  // ── Suggestions (the demand signal for onboarding) ───────────────────────
  const suggestions = [
    { n: 201, by: S(1), name: "Auntie Akos Waakye", loc: "Berekuso junction, blue kiosk", cat: "food", ago: 2 },
    { n: 202, by: S(2), name: "Auntie Akos Waakye", loc: "Berekuso junction", cat: "food", ago: 3 },
    { n: 203, by: S(3), name: "Auntie Akos Waakye", loc: null, cat: "food", ago: 6 },
    { n: 204, by: S(4), name: "Melcom Plus Kwabenya", loc: "Kwabenya main road", cat: "shopping", ago: 4 },
    { n: 205, by: AMA, name: "Kofi Broke Man Stall", loc: "Opposite the Ashesi gate", cat: "food", ago: 1 },
    { n: 206, by: S(5), name: "Shalom Barbering Shop", loc: "Berekuso town", cat: "services", ago: 9 },
  ];
  for (const s of suggestions) {
    const data = { studentId: s.by, universityId: UNI, name: s.name, normalizedName: s.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), locationText: s.loc, category: s.cat, createdAt: daysAgo(s.ago) };
    await prisma.shopSuggestion.upsert({ where: { id: id(s.n) }, update: data, create: { id: id(s.n), ...data } });
  }

  // ── Orders ───────────────────────────────────────────────────────────────
  const orders: DemoOrder[] = [
    // Ama's live orders, one per stage, so every tracking state has a subject.
    { n: 301, studentId: AMA, type: "pickup", status: "payment_pending", description: "Laptop charger, in a black pouch", from: CP.hostelA, to: CP.library, date: wave, createdAt: daysAgo(0) },
    { n: 302, studentId: AMA, type: "pickup", status: "confirmed", description: "Two textbooks for Efua, tied with string", from: CP.library, to: CP.courtyard, date: wave, createdAt: daysAgo(0.2) },
    { n: 303, studentId: AMA, type: "buy_for_me", status: "rider_assigned", riderId: KOFI, shopId: FRESH_MART, to: CP.hostelA, description: "Voltic Water (1.5L) x2, Sliced Bread", items: [{ productId: WATER, name: "Voltic Water (1.5L)", unitPrice: 6, quantity: 2 }, { productId: BREAD, name: "Sliced Bread (Family Loaf)", unitPrice: 15, quantity: 1 }], date: wave, shopAccepted: true, createdAt: daysAgo(0.5) },
    { n: 304, studentId: AMA, type: "pickup", status: "en_route", riderId: KOFI, description: "Printed project report, A4 envelope", from: CP.gate, to: CP.hostelA, date: wave, pin: "482913", createdAt: daysAgo(0.6) },
    { n: 305, studentId: AMA, type: "buy_for_me", status: "at_checkpoint", riderId: KOFI, shopId: MAMA_PUT, to: CP.quad, description: "Jollof Rice + Chicken x2", items: [{ productId: JOLLOF, name: "Jollof Rice + Chicken", unitPrice: 35, quantity: 2 }], date: wave, pin: "730256", shopAccepted: true, createdAt: daysAgo(0.7) },
    // Ama's history.
    { n: 306, studentId: AMA, type: "pickup", status: "delivered", riderId: KOFI, description: "Sports kit bag", from: CP.sports, to: CP.hostelA, date: lastWave, createdAt: daysAgo(4) },
    { n: 307, studentId: AMA, type: "buy_for_me", status: "refunded", shopId: PHARMACY, to: CP.quad, description: "Paracetamol (500mg, 20 tabs)", items: [{ productId: PARACETAMOL, name: "Paracetamol (500mg, 20 tabs)", unitPrice: 12, quantity: 1 }], date: lastWave, cancellationReason: "The pharmacy was out of stock. Your money has been returned.", failureReason: "out_of_stock", createdAt: daysAgo(5) },
    { n: 308, studentId: AMA, type: "shop_pickup", status: "delivered", riderId: ESI, suggestionId: id(205), to: CP.library, description: "Kofi Broke Man: 2 plates, extra plantain", date: lastWave, createdAt: daysAgo(6) },

    // A suggested-shop run Kofi is at the till for — the goods-cost screen needs one.
    { n: 309, studentId: AMA, type: "shop_pickup", status: "rider_assigned", riderId: KOFI, suggestionId: id(205), to: CP.courtyard, description: "Kofi Broke Man: 2 plates, extra plantain", items: [{ productId: null, name: "Plate, extra plantain", unitPrice: null, quantity: 2 }, { productId: null, name: "Sobolo (bottle)", unitPrice: null, quantity: 1 }], date: wave, createdAt: daysAgo(0.4) },

    // The rider feed: paid, unclaimed, on the next Wave.
    { n: 311, studentId: S(1), type: "pickup", status: "confirmed", description: "Bag of laundry, blue Ghana-must-go", from: CP.hostelA, to: CP.gate, date: wave, createdAt: daysAgo(0.3) },
    { n: 312, studentId: S(2), type: "buy_for_me", status: "confirmed", shopId: MAMA_PUT, to: CP.courtyard, description: "Jollof Rice + Chicken", items: [{ productId: JOLLOF, name: "Jollof Rice + Chicken", unitPrice: 35, quantity: 1 }], date: wave, shopAccepted: true, createdAt: daysAgo(0.4) },
    { n: 313, studentId: S(3), type: "buy_for_me", status: "confirmed", shopId: MAMA_PUT, to: CP.sports, description: "Jollof Rice + Chicken x3", items: [{ productId: JOLLOF, name: "Jollof Rice + Chicken", unitPrice: 35, quantity: 3 }], date: wave, createdAt: daysAgo(0.1) },
    { n: 314, studentId: S(4), type: "buy_for_me", status: "confirmed", shopId: FRESH_MART, to: CP.library, description: "Milo Tin (400g), Sliced Bread", items: [{ productId: MILO, name: "Milo Tin (400g)", unitPrice: 48, quantity: 1 }, { productId: BREAD, name: "Sliced Bread (Family Loaf)", unitPrice: 15, quantity: 1 }], date: wave, createdAt: daysAgo(0.25) },
    // The walkthrough video's order: Kofi claims it, carries it and closes it with this PIN.
    { n: 315, studentId: AMA, type: "pickup", status: "confirmed", description: "Phone left at the library desk, grey case", from: CP.library, to: CP.quad, date: wave, pin: "615284", createdAt: daysAgo(0.05) },

    // Other riders' work, so the admin board is busy.
    { n: 321, studentId: S(5), type: "pickup", status: "en_route", riderId: ESI, description: "Box of snacks from home", from: CP.gate, to: CP.hostelA, date: wave, pin: "104857", createdAt: daysAgo(0.8) },
    { n: 322, studentId: S(6), type: "buy_for_me", status: "rider_assigned", riderId: KOJO, shopId: MAMA_PUT, to: CP.quad, description: "Jollof Rice + Chicken", items: [{ productId: JOLLOF, name: "Jollof Rice + Chicken", unitPrice: 35, quantity: 1 }], date: wave, shopAccepted: true, createdAt: daysAgo(0.9) },
    { n: 323, studentId: S(1), type: "pickup", status: "cancelled", description: "Umbrella", from: CP.quad, to: CP.gate, date: wave, cancellationReason: "Payment was not completed.", failureReason: "abandoned_payment", createdAt: daysAgo(1.5) },
    { n: 324, studentId: S(2), type: "buy_for_me", status: "cancelled", shopId: FRESH_MART, to: CP.hostelA, description: "Eggs (Crate of 30)", date: lastWave, cancellationReason: "I ordered by mistake.", failureReason: "student_cancelled", createdAt: daysAgo(6) },
  ];

  // Kofi's delivered history across recent Waves, for Earnings and admin payouts.
  const history = [
    [331, S(1), 3], [332, S(2), 3], [333, S(3), 7], [334, S(4), 7], [335, S(5), 10],
    [336, S(6), 14], [337, S(1), 14], [338, S(3), 17], [339, S(2), 21], [340, S(4), 24],
  ] as const;
  const checkpoints = Object.values(CP);
  for (const [i, [n, student, ago]] of history.entries()) {
    const food = i % 2 === 0;
    orders.push({
      n, studentId: student, riderId: KOFI, status: "delivered",
      type: food ? "buy_for_me" : "pickup",
      shopId: food ? MAMA_PUT : undefined,
      from: food ? undefined : checkpoints[(i + 2) % checkpoints.length],
      to: checkpoints[i % checkpoints.length]!,
      description: food ? "Jollof Rice + Chicken" : "Parcel from the main gate",
      items: food ? [{ productId: JOLLOF, name: "Jollof Rice + Chicken", unitPrice: 35, quantity: 1 + (i % 3) }] : undefined,
      date: nextWave(daysAgo(ago)), shopAccepted: food, createdAt: daysAgo(ago + 1),
    });
  }

  for (const o of orders) await writeOrder(o, secret);

  // Kofi's earnings: older weeks paid out, the last week still owed.
  for (const [n, , ago] of history) {
    const e = { riderId: KOFI, orderId: id(n), amount: "16.00", ratePct: "80.00", status: ago > 7 ? ("paid" as const) : ("pending" as const), paidAt: ago > 7 ? daysAgo(ago - 2) : null, createdAt: daysAgo(ago) };
    await prisma.riderEarning.upsert({ where: { id: id(n + 1000) }, update: e, create: { id: id(n + 1000), ...e } });
  }
  for (const n of [306, 308]) {
    const rider = n === 306 ? KOFI : ESI;
    const e = { riderId: rider, orderId: id(n), amount: "16.00", ratePct: "80.00", status: "pending" as const, createdAt: daysAgo(4) };
    await prisma.riderEarning.upsert({ where: { id: id(n + 1000) }, update: e, create: { id: id(n + 1000), ...e } });
  }

  // A campus complaint waiting on HQ.
  const refund = { orderId: id(333), universityId: UNI, requestedById: ADMIN, reason: "Student says one of the three plates was missing when they collected at the Library Steps.", status: "pending" as const, createdAt: daysAgo(1) };
  await prisma.refundRequest.upsert({ where: { id: id(401) }, update: refund, create: { id: id(401), ...refund } });

  // Beta programme.
  const beta = [
    { n: 501, who: S(1), status: "pending" as const, reason: "I order food every week and want to try group baskets first." },
    { n: 502, who: S(3), status: "pending" as const, reason: "Happy to report bugs, I study CS." },
    { n: 503, who: S(4), status: "approved" as const, reason: "I'm the class rep and can get feedback from my year." },
  ];
  for (const b of beta) {
    const data = { profileId: b.who, status: b.status, reason: b.reason, reviewedById: b.status === "pending" ? null : ADMIN, reviewedAt: b.status === "pending" ? null : daysAgo(2), createdAt: daysAgo(3) };
    await prisma.betaApplication.upsert({ where: { id: id(b.n) }, update: data, create: { id: id(b.n), ...data } });
  }
  const fb = { profileId: S(4), message: "The pickup form is really quick. I'd like to save my usual route.", screen: "PickupRequest", appVersion: "0.1.0", createdAt: daysAgo(1) };
  await prisma.betaFeedback.upsert({ where: { id: id(511) }, update: fb, create: { id: id(511), ...fb } });

  await prisma.studentDeliveryStats.upsert({ where: { studentId: S(4) }, update: { totalDeliveries: 2 }, create: { studentId: S(4), totalDeliveries: 2 } });

  console.log(`Demo data written: ${students.length} students, ${riders.length} riders, ${orders.length} orders, ${suggestions.length} suggestions. Next Wave ${wave.toISOString().slice(0, 10)}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
