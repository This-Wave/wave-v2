import { isBetaTester } from "../beta/access";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import {
  inCutoffReminderWindow,
  isQuietHour,
  msUntilCutoff,
  nextRunCutoff,
  reminderBlockedReason,
  resolveFeature,
  underDailyCap,
  MAX_REMINDERS_PER_DAY,
  type FeatureKey,
} from "@wave/shared";
import { HAS_PUSH, pushToProfiles } from "./dispatch";

/**
 * The reminder sweep: cutoff reminders and abandoned-order nudges.
 *
 * **Idempotent by insert.** `reminder_log` has a unique on
 * (profile, kind, dedupeKey), and the row is written *before* the push. Two
 * instances sweeping at once, or one sweeping twice, cannot double-send: the
 * loser's insert violates the constraint and it moves on. Writing the row first
 * means a crash between insert and send costs one missed reminder rather than a
 * loop that pushes on every tick — which is the right way round.
 *
 * **Nothing here is time-critical.** Every reminder is an accelerator for
 * something already visible in the app, so a sleeping free-tier service that
 * misses a window has cost a nudge, not an order.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

type Ctx = { fastify: FastifyInstance; log: FastifyBaseLogger; now?: Date };

async function flagFor(
  fastify: FastifyInstance,
  key: FeatureKey,
  universityId: string | null,
  profileId: string,
) {
  const rows = await fastify.prisma.featureFlag.findMany({
    where: { key },
    select: { key: true, universityId: true, state: true },
  });
  // A reminder in beta goes to beta testers only, like any other beta feature.
  const needsBeta = rows.some((r) => r.state === "beta");
  return resolveFeature(key, universityId, rows, {
    isBetaTester: needsBeta ? await isBetaTester(fastify, profileId) : false,
  });
}

/** How many reminders this person has already had in the last rolling day. */
async function sentInLastDay(fastify: FastifyInstance, profileId: string, now: Date) {
  // Only the nudges count; a "your rider is waiting" must not use up the day's
  // allowance for them.
  return fastify.prisma.reminderLog.count({
    where: { profileId, kind: { in: ["cutoff", "abandoned"] }, sentAt: { gte: new Date(now.getTime() - DAY_MS) } },
  });
}

/**
 * Claim the right to send. Returns false when the row already exists, which is
 * exactly the "someone else got there first" case.
 */
async function claim(
  fastify: FastifyInstance,
  profileId: string,
  kind: string,
  dedupeKey: string,
): Promise<boolean> {
  try {
    await fastify.prisma.reminderLog.create({ data: { profileId, kind, dedupeKey } });
    return true;
  } catch {
    return false;
  }
}

/**
 * "Sunday's Wave closes in 2 hours."
 *
 * Only to students who have ordered before — a reminder is a nudge to repeat
 * something, and someone who has never ordered has nothing to be reminded of.
 * Skips anyone already on this Wave: they have done the thing.
 */
export async function sweepCutoffReminders(ctx: Ctx): Promise<{ sent: number }> {
  const { fastify, log } = ctx;
  const now = ctx.now ?? new Date();

  if (!inCutoffReminderWindow(msUntilCutoff(now))) return { sent: 0 };
  if (isQuietHour(now)) {
    log.info("Cutoff reminder skipped: quiet hours");
    return { sent: 0 };
  }

  const cutoff = nextRunCutoff(now);
  const dedupeKey = cutoff.toISOString().slice(0, 10);

  const candidates = await fastify.prisma.profile.findMany({
    where: {
      role: "student",
      ...HAS_PUSH,
      // Has ordered before…
      studentOrders: { some: { status: "delivered" } },
      // …but not onto the Wave this reminder is about.
      NOT: { studentOrders: { some: { scheduledDate: { gte: startOfDay(cutoff) } } } },
    },
    select: { id: true, universityId: true },
    take: 500,
  });

  let sent = 0;
  for (const profile of candidates) {
    const enabled = await flagFor(fastify, "cutoff_reminder", profile.universityId, profile.id);
    const blocked = reminderBlockedReason({
      now,
      enabled,
      sentInLastDay: await sentInLastDay(fastify, profile.id, now),
      alreadySent: false,
    });
    if (blocked) continue;
    if (!(await claim(fastify, profile.id, "cutoff", dedupeKey))) continue;

    await pushToProfiles({
      fastify,
      log,
      profileIds: [profile.id],
      payload: {
        title: "Ordering closes in 2 hours",
        body: "Get your order in before noon and it rides on this Wave.",
        data: { kind: "cutoff_reminder" },
      },
    });
    sent += 1;
  }

  if (sent > 0) log.info({ sent, dedupeKey }, "Cutoff reminders sent");
  return { sent };
}

/**
 * "You left an order at payment."
 *
 * One per order, ever — `dedupeKey` is the order id. Someone who ignored the
 * nudge does not want a second one, and the resume card on Home is there
 * whenever they come back.
 */
export async function sweepAbandonedNudges(ctx: Ctx): Promise<{ sent: number }> {
  const { fastify, log } = ctx;
  const now = ctx.now ?? new Date();

  if (isQuietHour(now)) return { sent: 0 };

  // Old enough that they have plainly stopped, recent enough to still matter.
  const stale = await fastify.prisma.order.findMany({
    where: {
      status: "payment_pending",
      createdAt: { lte: new Date(now.getTime() - 60 * 60 * 1000), gte: new Date(now.getTime() - 3 * DAY_MS) },
    },
    select: { id: true, studentId: true, student: { select: { universityId: true } } },
    take: 200,
  });

  let sent = 0;
  for (const order of stale) {
    const enabled = await flagFor(fastify, "abandoned_nudge", order.student?.universityId ?? null, order.studentId);
    if (!enabled) continue;
    if (!underDailyCap(await sentInLastDay(fastify, order.studentId, now))) continue;
    if (!(await claim(fastify, order.studentId, "abandoned", order.id))) continue;

    await pushToProfiles({
      fastify,
      log,
      profileIds: [order.studentId],
      payload: {
        title: "Your order is waiting",
        body: "You left it at the payment step. Finish paying and it's on the next Wave.",
        data: { kind: "abandoned_nudge", orderId: order.id },
      },
    });
    sent += 1;
  }

  if (sent > 0) log.info({ sent }, "Abandoned-order nudges sent");
  return { sent };
}

/** How long a rider stands at the checkpoint before the student is chased. */
export const RIDER_WAITING_AFTER_MS = 5 * 60 * 1000;

/**
 * "Your rider is still waiting."
 *
 * The arrival push goes out the moment the rider marks the checkpoint; this is
 * the one follow-up, a few minutes on, if the handover still hasn't happened.
 * Not a reminder in the marketing sense: no feature flag, no daily cap, no
 * quiet hours — someone is physically standing there with the student's order.
 * Once per order (`dedupeKey` is the order id).
 */
export async function sweepRiderWaiting(ctx: Ctx): Promise<{ sent: number }> {
  const { fastify, log } = ctx;
  const now = ctx.now ?? new Date();

  const waiting = await fastify.prisma.order.findMany({
    where: {
      status: "at_checkpoint",
      statusHistory: {
        some: {
          status: "at_checkpoint",
          // The lower bound keeps an order that has been stuck for hours from
          // being "discovered" and pushed long after anyone was waiting.
          createdAt: { lte: new Date(now.getTime() - RIDER_WAITING_AFTER_MS), gte: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
        },
      },
    },
    select: { id: true, studentId: true, checkpoint: { select: { name: true } }, rider: { select: { fullName: true } } },
    take: 100,
  });

  let sent = 0;
  for (const order of waiting) {
    if (!(await claim(fastify, order.studentId, "rider_waiting", order.id))) continue;
    await pushToProfiles({
      fastify,
      log,
      profileIds: [order.studentId],
      payload: {
        title: "Your rider is waiting",
        body: `${order.rider?.fullName ?? "Your rider"} is still at ${order.checkpoint?.name ?? "the checkpoint"} with your order. Head over with your delivery PIN.`,
        data: { kind: "rider_waiting", orderId: order.id },
      },
    });
    sent += 1;
  }

  if (sent > 0) log.info({ sent }, "Rider-waiting reminders sent");
  return { sent };
}

export async function sweepReminders(ctx: Ctx): Promise<{ cutoff: number; abandoned: number }> {
  const cutoff = await sweepCutoffReminders(ctx);
  const abandoned = await sweepAbandonedNudges(ctx);
  return { cutoff: cutoff.sent, abandoned: abandoned.sent };
}

/** Local midnight, matching how `scheduledDate` is stored. */
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export { MAX_REMINDERS_PER_DAY };
