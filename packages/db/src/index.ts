import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __wavePrisma__: PrismaClient | undefined;
}

// Reuse a single client across hot reloads in dev to avoid exhausting
// Neon's connection limit on the free tier.
export const prisma = global.__wavePrisma__ ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__wavePrisma__ = prisma;
}

export * from "@prisma/client";
