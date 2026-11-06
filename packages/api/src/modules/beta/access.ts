import type { FastifyInstance } from "fastify";

/**
 * Whether this person is an approved beta tester right now.
 *
 * Read from `beta_application` on every check rather than cached on the
 * profile, so revoking someone takes effect on their very next request.
 */
export async function isBetaTester(fastify: FastifyInstance, profileId: string | null | undefined): Promise<boolean> {
  if (!profileId) return false;
  const application = await fastify.prisma.betaApplication.findUnique({
    where: { profileId },
    select: { status: true },
  });
  return application?.status === "approved";
}
