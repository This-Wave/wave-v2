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

  const quad = await prisma.checkpoint.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      universityId: ashesi.id,
      name: "Ashesi Quad",
      description: "Main quad, next to the flagpole",
    },
  });

  const shopOwner = await prisma.profile.upsert({
    where: { id: "00000000-0000-0000-0000-000000000201" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000201",
      universityId: ashesi.id,
      fullName: "Mama Put Kitchen (Owner)",
      phone: "+233201234567",
      role: "shop_owner",
      isVerified: true,
    },
  });

  const shop = await prisma.shop.upsert({
    where: { id: "00000000-0000-0000-0000-000000000301" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000301",
      ownerId: shopOwner.id,
      universityId: ashesi.id,
      name: "Mama Put Kitchen",
      description: "Home-style Ghanaian dishes, off-campus in Berekuso town",
      category: "food",
      locationText: "Berekuso Town Center",
      isVerified: true,
    },
  });

  const jollof = await prisma.product.upsert({
    where: { id: "00000000-0000-0000-0000-000000000401" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000401",
      shopId: shop.id,
      name: "Jollof Rice + Chicken",
      description: "Large portion, extra shito on the side",
      price: "35.00",
      category: "main",
      status: "active",
    },
  });

  // Real Supabase Auth user, created via the admin API for local dev/testing
  // (password sign-in, no SMS provider needed): phone +233241234567 / WaveDev123!
  const frequentUserId = "6a2f924d-256d-4599-a239-6b71ce9a7e25";
  const frequentUser = await prisma.profile.upsert({
    where: { id: frequentUserId },
    update: {},
    create: {
      id: frequentUserId,
      universityId: ashesi.id,
      fullName: "Ama Owusu",
      phone: "+233241234567",
      studentId: "ASH0231",
      role: "student",
      isVerified: true,
    },
  });

  // Seven past Sunday deliveries — enough to have already cleared the
  // 6-delivery loyalty threshold, so HomeScreen/ProfileScreen render the
  // "discount unlocked" state instead of an in-progress counter.
  const pastSundays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (i + 1) * 7);
    return d;
  });

  for (const [i, scheduledDate] of pastSundays.entries()) {
    await prisma.order.upsert({
      where: { id: `00000000-0000-0000-0000-0000000005${String(i).padStart(2, "0")}` },
      update: {},
      create: {
        id: `00000000-0000-0000-0000-0000000005${String(i).padStart(2, "0")}`,
        studentId: frequentUser.id,
        shopId: shop.id,
        checkpointId: quad.id,
        universityId: ashesi.id,
        itemDescription: "Jollof Rice + Chicken, large, extra shito",
        productId: jollof.id,
        itemPrice: "35.00",
        deliveryFee: "5.00",
        discountApplied: i === 0 ? "20" : "0",
        totalAmount: i === 0 ? "36.00" : "40.00",
        deliveryDay: "sunday",
        scheduledDate,
        status: "delivered",
        paidAt: scheduledDate,
        deliveredAt: scheduledDate,
      },
    });
  }

  await prisma.studentDeliveryStats.upsert({
    where: { studentId: frequentUser.id },
    update: { totalDeliveries: 7, discountEligible: true },
    create: { studentId: frequentUser.id, totalDeliveries: 7, discountEligible: true },
  });

  console.log(`Seeded frequent user: ${frequentUser.fullName} (${frequentUser.phone}) — 7 delivered orders`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
