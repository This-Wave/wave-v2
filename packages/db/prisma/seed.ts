import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const ashesi = await prisma.university.upsert({
    where: { slug: "ashesi" },
    update: {},
    create: {
      name: "Ashesi University",
      slug: "ashesi",
      city: "Berekuso",
      country: "Ghana",
    },
  });

  await prisma.platformConfig.createMany({
    data: [
      { key: "delivery_fee_base", value: "5.00", description: "Base delivery fee in GHS" },
      { key: "special_order_surcharge_pct", value: "30", description: "Special order surcharge %" },
      { key: "loyalty_discount_pct", value: "20", description: "Discount % after 6 deliveries" },
      { key: "loyalty_threshold", value: "6", description: "Deliveries needed for discount" },
      { key: "special_order_lead_hours", value: "24", description: "Minimum lead time for special orders" },
    ],
    skipDuplicates: true,
  });

  console.log(`Seeded university: ${ashesi.name} (${ashesi.slug})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
