/**
 * Delete the orders the harness created, so a run leaves the database as it
 * found it. The student journey places a real order every time it runs.
 *
 * Deliberately narrow: only orders from the last few hours that were never
 * paid and carry no Paystack reference. Run from the repo root.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

for (const line of readFileSync("packages/api/.env", "utf8").split("\n")) {
  const match = /^\s*(DATABASE_URL)\s*=\s*(.*)$/.exec(line);
  if (match) process.env.DATABASE_URL = match[2].trim().replace(/^["'](.*)["']$/, "$1");
}

const prisma = new PrismaClient();
const hours = Number(process.argv[2] ?? 6);
const where = {
  createdAt: { gte: new Date(Date.now() - hours * 60 * 60 * 1000) },
  status: "payment_pending",
  paystackRef: null,
  paidAt: null,
};

const doomed = await prisma.order.findMany({ where, select: { id: true, createdAt: true, totalAmount: true } });
console.log(`unpaid test orders in the last ${hours}h: ${doomed.length}`);
for (const o of doomed) console.log("  ", o.createdAt.toISOString(), String(o.totalAmount));

const ids = doomed.map((o) => o.id);
if (ids.length > 0) {
  await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  await prisma.orderStatusHistory.deleteMany({ where: { orderId: { in: ids } } });
  const { count } = await prisma.order.deleteMany({ where: { id: { in: ids } } });
  console.log(`deleted ${count}`);
}
console.log("orders remaining:", await prisma.order.count());
await prisma.$disconnect();
