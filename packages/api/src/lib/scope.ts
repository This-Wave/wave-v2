import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Which university a staff member's actions are confined to.
 *
 * `null` means HQ: every university. A campus admin gets their
 * `admin_university_id`. Routes ask this rather than looking at the role, so
 * a future campus-scoped role is one line in the auth plugin, not a sweep of
 * every handler.
 */
export function campusOf(request: FastifyRequest): string | null {
  return request.user?.campusId ?? null;
}

/** Prisma `where` fragment restricting to the caller's campus, or nothing for HQ. */
export function campusWhere(request: FastifyRequest): { universityId?: string } {
  const campus = campusOf(request);
  return campus ? { universityId: campus } : {};
}

/** Whether a row belonging to `universityId` is inside the caller's reach. */
export function inCampus(request: FastifyRequest, universityId: string | null | undefined): boolean {
  const campus = campusOf(request);
  return campus === null || universityId === campus;
}

/**
 * The refusal for a row in another campus. A 404, not a 403: a campus admin
 * probing ids should learn nothing about whether another campus has that order.
 */
export function outsideCampus(reply: FastifyReply, what = "Not found") {
  return reply.code(404).send({ error: what });
}
