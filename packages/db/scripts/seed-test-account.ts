/**
 * Creates (or resets) a reviewer's test student account with a few weeks of
 * sample order history, so a payment provider's compliance team sees the app
 * as a student who has used it would.
 *
 * Everything here is `isTest`: the profile and each order. That keeps it out of
 * every count, every payout and every shop, rider and dispatch screen, and with
 * TELEGRAM_* set on the API, everything the reviewer does is reported live.
 * The history is sample data; say so when you hand the account over.
 *
 * Sign-in is by phone OTP with no SMS: add the number and a fixed code under
 * Supabase → Authentication → Sign In / Providers → Phone → Test phone numbers.
 *
 * Usage (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env):
 *   npx tsx scripts/seed-test-account.ts --phone +233249990417 --name "Abena Mensah"
 * Re-running resets that account's sample orders; nothing else is touched.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Prisma, PrismaClient, type DeliveryDay } from "@prisma/client";

const ASHESI = "ashesi";
const DELIVERY_FEE = 20;

const SHOP = {
  mamaPut: "00000000-0000-0000-0000-000000000301",
  freshMart: "00000000-0000-0000-0000-000000000302",
  pharmacy: "00000000-0000-0000-0000-000000000303",
  print: "00000000-0000-0000-0000-000000000304",
  coffee: "00000000-0000-0000-0000-000000000306",
};
const CHECKPOINT = {
  hostelA: "00000000-0000-0000-0000-000000000102",
  library: "00000000-0000-0000-0000-000000000104",
};

/**
 * Oldest first. `dayBack` counts back through past Sunday/Wednesday delivery
 * days, so the history always ends shortly before the day the script runs.
 * `picks` are [product index in the shop's menu, quantity].
 */
const PLAN: { dayBack: number; shop: string; checkpoint: string; picks: [number, number][]; cancelled?: string }[] = [
  { dayBack: 13, shop: SHOP.mamaPut, checkpoint: CHECKPOINT.hostelA, picks: [[0, 2]] },
  { dayBack: 10, shop: SHOP.freshMart, checkpoint: CHECKPOINT.hostelA, picks: [[0, 1], [1, 2], [2, 1]] },
  { dayBack: 8, shop: SHOP.print, checkpoint: CHECKPOINT.library, picks: [[0, 24]], cancelled: "Printed it on campus instead" },
  { dayBack: 6, shop: SHOP.coffee, checkpoint: CHECKPOINT.library, picks: [[0, 1], [1, 1]] },
  { dayBack: 4, shop: SHOP.pharmacy, checkpoint: CHECKPOINT.hostelA, picks: [[0, 1]] },
  { dayBack: 1, shop: SHOP.mamaPut, checkpoint: CHECKPOINT.hostelA, picks: [[0, 1]] },
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Past Sundays and Wednesdays, most recent first, starting before today. */
function pastDeliveryDays(count: number): Date[] {
  const days: Date[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  while (days.length < count) {
    d.setUTCDate(d.getUTCDate() - 1);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 3) days.push(new Date(d));
  }
  return days;
}

function at(day: Date, offsetDays: number, hour: number, minute: number): Date {
  const t = new Date(day);
  t.setUTCDate(t.getUTCDate() + offsetDays);
  t.setUTCHours(hour, minute, 0, 0);
  return t;
}

async function findAuthUserByPhone(
  admin: ReturnType<typeof createClient>["auth"]["admin"],
  phone: string,
): Promise<string | null> {
  const digits = phone.replace(/\D/g, "");
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => (u.phone ?? "").replace(/\D/g, "") === digits);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main(): Promise<void> {
  const phone = arg("phone");
  const fullName = arg("name");
  const studentNumber = arg("student-id") ?? null;
  if (!phone || !/^\+233\d{9}$/.test(phone) || !fullName) {
    throw new Error('Usage: --phone +233XXXXXXXXX --name "Full Name" [--student-id 12342027]');
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).auth.admin;
  let userId = await findAuthUserByPhone(admin, phone);
  if (!userId) {
    const { data, error } = await admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { full_name: fullName, test_account: true },
    });
    if (error || !data.user) throw new Error(`createUser: ${error?.message ?? "no user returned"}`);
    userId = data.user.id;
  }

  const prisma = new PrismaClient();
  try {
    const university = await prisma.university.findUniqueOrThrow({ where: { slug: ASHESI } });
    const days = pastDeliveryDays(Math.max(...PLAN.map((p) => p.dayBack)) + 1);
    const joined = at(days[days.length - 1]!, -5, 18, 42);

    const clash = await prisma.profile.findUnique({ where: { phone }, select: { id: true } });
    if (clash && clash.id !== userId) {
      throw new Error(`Phone ${phone} already belongs to profile ${clash.id}; pick another test number.`);
    }
    await prisma.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        phone,
        fullName,
        studentId: studentNumber,
        role: "student",
        universityId: university.id,
        isVerified: true,
        isTest: true,
        createdAt: joined,
      },
      update: { fullName, studentId: studentNumber, universityId: university.id, isTest: true, isActive: true },
    });

    const old = await prisma.order.findMany({ where: { studentId: userId, isTest: true }, select: { id: true } });
    const oldIds = old.map((o) => o.id);
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: oldIds } } });
    await prisma.order.deleteMany({ where: { id: { in: oldIds } } });

    let delivered = 0;
    for (const plan of PLAN) {
      const menu = await prisma.product.findMany({
        where: { shopId: plan.shop, status: "active" },
        orderBy: { createdAt: "asc" },
      });
      const lines = plan.picks
        .map(([index, quantity]) => ({ product: menu[index % Math.max(menu.length, 1)], quantity }))
        .filter((l): l is { product: (typeof menu)[number]; quantity: number } => Boolean(l.product));
      if (lines.length === 0) {
        console.warn(`  skipped an order: shop ${plan.shop} has no active products`);
        continue;
      }

      const itemsTotal = lines.reduce((sum, l) => sum + Number(l.product.price) * l.quantity, 0);
      const day = days[plan.dayBack]!;
      const placed = at(day, -1, 19, 10 + plan.dayBack);
      const paid = new Date(placed.getTime() + 2 * 60_000);
      const deliveredAt = at(day, 0, 13, 20 + plan.dayBack);
      const history: { status: string; createdAt: Date; note?: string }[] = plan.cancelled
        ? [
            { status: "payment_pending", createdAt: placed },
            { status: "cancelled", createdAt: new Date(placed.getTime() + 6 * 60_000), note: plan.cancelled },
          ]
        : [
            { status: "payment_pending", createdAt: placed },
            { status: "confirmed", createdAt: paid },
            { status: "rider_assigned", createdAt: at(day, 0, 10, 5) },
            { status: "en_route", createdAt: at(day, 0, 12, 30) },
            { status: "at_checkpoint", createdAt: at(day, 0, 13, 12) },
            { status: "delivered", createdAt: deliveredAt },
          ];

      await prisma.order.create({
        data: {
          studentId: userId,
          shopId: plan.shop,
          checkpointId: plan.checkpoint,
          universityId: university.id,
          orderType: "buy_for_me",
          productId: lines[0]!.product.id,
          itemDescription: lines.map((l) => `${l.quantity}x ${l.product.name}`).join(", "),
          itemPrice: new Prisma.Decimal(itemsTotal.toFixed(2)),
          deliveryFee: new Prisma.Decimal(DELIVERY_FEE),
          totalAmount: new Prisma.Decimal((itemsTotal + DELIVERY_FEE).toFixed(2)),
          deliveryDay: (day.getUTCDay() === 0 ? "sunday" : "wednesday") as DeliveryDay,
          scheduledDate: day,
          status: plan.cancelled ? "cancelled" : "delivered",
          cancellationReason: plan.cancelled ?? null,
          paystackRef: plan.cancelled ? null : `wave_${randomBytes(8).toString("hex")}`,
          paidAt: plan.cancelled ? null : paid,
          shopAcceptedAt: plan.cancelled ? null : at(day, 0, 8, 40),
          deliveredAt: plan.cancelled ? null : deliveredAt,
          isTest: true,
          createdAt: placed,
          items: {
            create: lines.map((l) => ({
              productId: l.product.id,
              name: l.product.name,
              unitPrice: l.product.price,
              quantity: l.quantity,
              createdAt: placed,
            })),
          },
          statusHistory: { create: history },
        },
      });
      if (!plan.cancelled) delivered += 1;
    }

    await prisma.studentDeliveryStats.upsert({
      where: { studentId: userId },
      create: { studentId: userId, totalDeliveries: delivered, rewardStamps: delivered },
      update: { totalDeliveries: delivered, rewardStamps: delivered, discountEligible: false },
    });

    console.log(`Test account ready: ${fullName} (${phone}), profile ${userId}`);
    console.log(`  ${delivered} delivered and ${PLAN.length - delivered} cancelled sample orders, joined ${joined.toISOString().slice(0, 10)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
