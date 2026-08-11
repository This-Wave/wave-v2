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
      { key: "delivery_fee_base", value: "20.00", description: "Base delivery fee in GHS" },
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

  // Real Supabase Auth user for shop-owner dev/testing (password sign-in, no
  // SMS needed): phone +233201234567 / WaveShop123!
  const shopOwner = await prisma.profile.upsert({
    where: { id: "54b6d4ba-bbdf-4d1b-a17a-6aeecea01633" },
    update: {},
    create: {
      id: "54b6d4ba-bbdf-4d1b-a17a-6aeecea01633",
      universityId: ashesi.id,
      fullName: "Mama Put Kitchen (Owner)",
      phone: "+233201234567",
      role: "shop_owner",
      isVerified: true,
      isActive: true,
    },
  });

  const shop = await prisma.shop.upsert({
    where: { id: "00000000-0000-0000-0000-000000000301" },
    update: { ownerId: shopOwner.id },
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

  // Real Supabase Auth user for rider dev/testing (password sign-in, no SMS
  // needed): phone +233551234567 / WaveRider123!
  const riderUserId = "4e45b6f3-0da4-446b-a547-2cf8138028e0";
  const rider = await prisma.profile.upsert({
    where: { id: riderUserId },
    update: {},
    create: {
      id: riderUserId,
      universityId: ashesi.id,
      fullName: "Kofi Boateng",
      phone: "+233551234567",
      role: "rider",
      isVerified: true,
      isActive: true,
    },
  });

  await prisma.riderVerification.upsert({
    where: { id: "00000000-0000-0000-0000-000000000601" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000601",
      riderId: rider.id,
      idType: "ghana_card",
      idNumber: "GHA-000000000-0",
      // Absolute URLs rather than bucket paths: nothing has been uploaded to
      // Storage for the seeded rider, and the read path passes legacy absolute
      // URLs through unsigned, so these still render in admin review.
      idImagePath: "https://placehold.co/600x400?text=Ghana+Card",
      selfiePath: "https://placehold.co/600x600?text=Selfie",
      status: "approved",
      reviewedAt: new Date(),
    },
  });

  // Two unclaimed, confirmed orders sitting in the rider's Order Feed.
  const feedShops = [
    { id: "00000000-0000-0000-0000-000000000701", item: "2x Waakye, extra egg + gari" },
    { id: "00000000-0000-0000-0000-000000000702", item: "Kelewele + roasted groundnuts" },
  ];

  for (const [i, order] of feedShops.entries()) {
    await prisma.order.upsert({
      where: { id: order.id },
      update: {},
      create: {
        id: order.id,
        studentId: frequentUser.id,
        shopId: shop.id,
        checkpointId: quad.id,
        universityId: ashesi.id,
        itemDescription: order.item,
        itemPrice: "20.00",
        deliveryFee: i === 0 ? "5.00" : "6.50",
        totalAmount: i === 0 ? "25.00" : "26.50",
        deliveryDay: "sunday",
        scheduledDate: new Date(),
        status: "confirmed",
        paidAt: new Date(),
      },
    });
  }

  console.log(`Seeded rider: ${rider.fullName} (${rider.phone}) — 2 orders available in feed`);

  // Real Supabase Auth user for admin dev/testing (password sign-in, no SMS
  // needed): phone +233271234567 / WaveAdmin123!
  const admin = await prisma.profile.upsert({
    where: { id: "f9aa5728-6af6-4d0b-9609-a079e1eea924" },
    update: {},
    create: {
      id: "f9aa5728-6af6-4d0b-9609-a079e1eea924",
      universityId: ashesi.id,
      fullName: "Wave Platform Admin",
      phone: "+233271234567",
      role: "admin",
      isVerified: true,
      isActive: true,
    },
  });

  console.log(`Seeded admin: ${admin.fullName} (${admin.phone})`);

  // ---------------------------------------------------------------------------
  // Campus fill-out: more checkpoints, shops and products.
  //
  // Why this exists: with a single shop, a single product and a single
  // checkpoint, most of the app renders an empty or one-item list — the shop
  // filter rail has one chip, checkpoint selection has nothing to choose, and
  // the storefront grids look broken rather than sparse. This seeds enough for
  // every screen to look like a real campus.
  //
  // Images are `loremflickr` topical photos with a fixed `lock`, so each row
  // gets a stable, real photograph rather than a grey block. They are stand-ins
  // for real photography, not final assets — swap them when the pilot has its
  // own. Every URL here was verified to return HTTP 200 image/jpeg.
  //
  // NOTE: `shop.category` is free text, and the mobile filter rail is derived
  // from the distinct values present in the data (see handoff.md). The
  // categories below are therefore load-bearing: they *are* the filter rail.
  // ---------------------------------------------------------------------------

  const img = (keywords: string, lock: number, w = 600, h = 400) =>
    `https://loremflickr.com/${w}/${h}/${keywords}?lock=${lock}`;

  // Give the original shop the logo it never had.
  await prisma.shop.update({
    where: { id: shop.id },
    data: { logoUrl: img("food,ghana", 11, 400, 400) },
  });
  await prisma.product.update({
    where: { id: jollof.id },
    data: { imageUrl: img("jollof,rice", 21) },
  });

  const checkpointData = [
    { id: "00000000-0000-0000-0000-000000000102", name: "Hostel Block A", description: "Ground-floor common room entrance" },
    { id: "00000000-0000-0000-0000-000000000103", name: "Main Gate", description: "Security post, outside the barrier" },
    { id: "00000000-0000-0000-0000-000000000104", name: "Library Steps", description: "Front steps of the Nathan Quao library" },
    { id: "00000000-0000-0000-0000-000000000105", name: "Sports Complex", description: "By the basketball court gate" },
    { id: "00000000-0000-0000-0000-000000000106", name: "Archer Cornfield Courtyard", description: "Under the walkway, near the benches" },
  ];

  for (const c of checkpointData) {
    await prisma.checkpoint.upsert({
      where: { id: c.id },
      update: {},
      create: { id: c.id, universityId: ashesi.id, name: c.name, description: c.description },
    });
  }

  console.log(`Seeded ${checkpointData.length} extra checkpoints (${checkpointData.length + 1} total with ${quad.name})`);

  // All extra shops belong to the same seeded shop owner. That is deliberate:
  // it keeps the shop-owner test account useful (its Menu/Orders screens have
  // real variety) without inventing more auth users than Supabase actually has.
  const shopData: {
    id: string;
    name: string;
    description: string;
    category: string;
    locationText: string;
    logo: [string, number];
    products: { id: string; name: string; description: string; price: string; category: string; img: [string, number] }[];
  }[] = [
    {
      id: "00000000-0000-0000-0000-000000000302",
      name: "Berekuso Fresh Mart",
      description: "Groceries, household basics and cold drinks",
      category: "groceries",
      locationText: "Berekuso Main Road, opposite the junction",
      logo: ["grocery,store", 12],
      products: [
        { id: "00000000-0000-0000-0000-000000000411", name: "Voltic Water (1.5L)", description: "Chilled", price: "6.00", category: "drinks", img: ["water,bottle", 22] },
        { id: "00000000-0000-0000-0000-000000000412", name: "Sliced Bread (Family Loaf)", description: "Baked same morning", price: "15.00", category: "bakery", img: ["bread,bakery", 23] },
        { id: "00000000-0000-0000-0000-000000000413", name: "Eggs (Crate of 30)", description: "Farm fresh", price: "55.00", category: "staples", img: ["eggs,carton", 24] },
        { id: "00000000-0000-0000-0000-000000000414", name: "Milo Tin (400g)", description: "", price: "48.00", category: "staples", img: ["chocolate,drink", 25] },
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000303",
      name: "Berekuso Community Pharmacy",
      description: "Over-the-counter medicine and first aid",
      category: "pharmacy",
      locationText: "Next to the clinic, Berekuso",
      logo: ["pharmacy", 13],
      products: [
        { id: "00000000-0000-0000-0000-000000000421", name: "Paracetamol (500mg, 20 tabs)", description: "", price: "12.00", category: "medicine", img: ["pills,medicine", 26] },
        { id: "00000000-0000-0000-0000-000000000422", name: "Antiseptic Wipes", description: "Pack of 20", price: "18.00", category: "first aid", img: ["bandage,firstaid", 27] },
        { id: "00000000-0000-0000-0000-000000000423", name: "Vitamin C (30 tabs)", description: "", price: "35.00", category: "medicine", img: ["vitamins", 28] },
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000304",
      name: "Sunrise Print & Copy",
      description: "Printing, binding and stationery runs",
      category: "stationery",
      locationText: "Berekuso Town Center, first floor",
      logo: ["printing,office", 14],
      products: [
        { id: "00000000-0000-0000-0000-000000000431", name: "A4 Printing (per page, B/W)", description: "Bring or send the file", price: "0.50", category: "printing", img: ["printer,paper", 29] },
        { id: "00000000-0000-0000-0000-000000000432", name: "Spiral Binding", description: "Up to 100 pages", price: "20.00", category: "printing", img: ["notebook,binding", 30] },
        { id: "00000000-0000-0000-0000-000000000433", name: "A4 Notebook (Ruled, 200pg)", description: "", price: "22.00", category: "stationery", img: ["notebook,stationery", 31] },
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000305",
      name: "Kofi Electronics & Accessories",
      description: "Chargers, cables, adapters and power banks",
      category: "electronics",
      locationText: "Berekuso Junction",
      logo: ["electronics,shop", 15],
      products: [
        { id: "00000000-0000-0000-0000-000000000441", name: "USB-C Cable (2m)", description: "Fast charge", price: "45.00", category: "cables", img: ["usb,cable", 32] },
        { id: "00000000-0000-0000-0000-000000000442", name: "Extension Cable (4 socket)", description: "With surge protection", price: "85.00", category: "power", img: ["power,socket", 33] },
        { id: "00000000-0000-0000-0000-000000000443", name: "Power Bank (10000mAh)", description: "", price: "180.00", category: "power", img: ["powerbank,battery", 34] },
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000306",
      name: "The Coffee Hut",
      description: "Coffee, smoothies and pastries",
      category: "drinks",
      locationText: "Berekuso Main Road",
      logo: ["coffee,shop", 16],
      products: [
        { id: "00000000-0000-0000-0000-000000000451", name: "Iced Coffee (Large)", description: "", price: "28.00", category: "drinks", img: ["iced,coffee", 35] },
        { id: "00000000-0000-0000-0000-000000000452", name: "Meat Pie", description: "Served warm", price: "12.00", category: "snacks", img: ["pie,pastry", 36] },
        { id: "00000000-0000-0000-0000-000000000453", name: "Mango Smoothie", description: "No added sugar", price: "30.00", category: "drinks", img: ["mango,smoothie", 37] },
      ],
    },
    {
      id: "00000000-0000-0000-0000-000000000307",
      name: "Akosua Beauty Supply",
      description: "Skincare, haircare and personal care",
      category: "beauty",
      locationText: "Berekuso Town Center",
      logo: ["cosmetics", 17],
      products: [
        { id: "00000000-0000-0000-0000-000000000461", name: "Shea Butter (250g)", description: "Unrefined, northern Ghana", price: "25.00", category: "skincare", img: ["shea,butter", 38] },
        { id: "00000000-0000-0000-0000-000000000462", name: "Hair Oil (100ml)", description: "", price: "40.00", category: "haircare", img: ["hair,oil", 39] },
      ],
    },
  ];

  for (const s of shopData) {
    await prisma.shop.upsert({
      where: { id: s.id },
      update: { ownerId: shopOwner.id, logoUrl: img(s.logo[0], s.logo[1], 400, 400) },
      create: {
        id: s.id,
        ownerId: shopOwner.id,
        universityId: ashesi.id,
        name: s.name,
        description: s.description,
        category: s.category,
        locationText: s.locationText,
        logoUrl: img(s.logo[0], s.logo[1], 400, 400),
        isVerified: true,
        isActive: true,
      },
    });

    for (const p of s.products) {
      await prisma.product.upsert({
        where: { id: p.id },
        update: { imageUrl: img(p.img[0], p.img[1]) },
        create: {
          id: p.id,
          shopId: s.id,
          name: p.name,
          description: p.description || null,
          price: p.price,
          category: p.category,
          imageUrl: img(p.img[0], p.img[1]),
          status: "active",
        },
      });
    }
  }

  const productTotal = shopData.reduce((n, s) => n + s.products.length, 0) + 1;
  console.log(
    `Seeded ${shopData.length + 1} shops / ${productTotal} products across ` +
      `${new Set([shop.category, ...shopData.map((s) => s.category)]).size} categories, all with images`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
