import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "@wave/db";

declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}

export default fp(async function prismaPlugin(fastify: FastifyInstance) {
  fastify.decorate("prisma", prisma);
  fastify.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
});
