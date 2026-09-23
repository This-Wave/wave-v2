import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { sweepAbandonedCheckouts } from "../modules/payments/sweepAbandoned";
import { sweepReminders } from "../modules/notifications/reminders";
import { resumeExpiredPauses } from "../modules/switches/routes";
import { archiveAuditEvents } from "../modules/audit/archive";

/**
 * How often the abandoned-checkout sweep runs.
 *
 * Well under the 45-minute TTL so a stale order is picked up on the first sweep
 * after it qualifies rather than up to a full TTL later, and far enough apart
 * that the Paystack lookups stay a rounding error against real traffic.
 */
export const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

/**
 * How often the audit archive runs.
 *
 * Daily, not on the 10-minute sweep: it uploads and prunes, so it is the one
 * scheduled job here with a real cost, and nothing about a 180-day retention
 * window is urgent to the hour. It no-ops immediately when nothing is past the
 * window, which is most days.
 */
export const AUDIT_ARCHIVE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Runs the abandoned-checkout sweep on a timer.
 *
 * **Why in-process rather than a cron service.** Render's free plan has no cron,
 * and the sweep is not time-critical — it is a catch-up pass, and everything it
 * does is idempotent and guarded by conditional UPDATEs (see
 * `sweepAbandonedCheckouts`). Two instances sweeping at once is therefore safe,
 * which is the property that makes the cheap mechanism the right one. If the
 * API ever moves to a paid always-on plan with a cron service, point it at
 * `POST /v1/admin/payments/sweep-abandoned` and set `SWEEP_ENABLED=false`.
 *
 * **Consequence of the free plan, stated plainly:** a sleeping service runs no
 * timers. The sweep therefore only advances while the API is awake, which is
 * exactly when a webhook could have been dropped anyway. It is a net, not a
 * guarantee.
 */
export default fp(async function sweeperPlugin(fastify: FastifyInstance) {
  // Off in test: 515 unit tests should not each start a live timer, and a sweep
  // firing mid-assertion would mutate fixtures underneath it.
  if (!fastify.config.SWEEP_ENABLED || fastify.config.NODE_ENV === "test") {
    fastify.log.info("Abandoned-checkout sweep is disabled");
    return;
  }

  let running = false;

  async function tick() {
    // A sweep that outruns its own interval — a big backlog, a slow Paystack —
    // must not overlap itself and double the load it is already struggling with.
    if (running) return;
    running = true;
    try {
      await sweepAbandonedCheckouts({ fastify, log: fastify.log });
      // Rides the same timer: both are catch-up passes, both are idempotent,
      // and a second interval would double the wake-ups on a free tier that
      // pays for them in cold starts. Reminders are gated by their own feature
      // flags, so this does nothing at all until someone turns one on.
      await sweepReminders({ fastify, log: fastify.log });
      // A timed pause already reads as over once its time passes; this flips
      // the row and records who resumed ordering (nobody — the clock).
      await resumeExpiredPauses({ fastify, log: fastify.log });
    } catch (err) {
      // Never let a throw escape a timer callback: an unhandled rejection here
      // takes the whole API down, and a failed sweep is not worth an outage.
      fastify.log.error({ err }, "Scheduled sweep failed");
    } finally {
      running = false;
    }
  }

  let archiving = false;

  async function archiveTick() {
    // Same reason as the sweep: a long backlog drains in batches over several
    // runs, and two overlapping passes would upload the same rows twice.
    if (archiving) return;
    archiving = true;
    try {
      await archiveAuditEvents({ fastify, log: fastify.log });
    } catch (err) {
      // Deliberately swallowed after logging. The job deletes nothing unless the
      // upload was written and read back, so a failure leaves the table intact
      // and the next run retries — and an audit archive is never worth an
      // outage of the API it is archiving.
      fastify.log.error({ err }, "Audit archive failed — nothing pruned");
    } finally {
      archiving = false;
    }
  }

  const timer = setInterval(() => void tick(), SWEEP_INTERVAL_MS);
  const archiveTimer = setInterval(() => void archiveTick(), AUDIT_ARCHIVE_INTERVAL_MS);
  archiveTimer.unref();
  // Do not hold the event loop open: `index.ts` drains and exits on SIGTERM, and
  // a live interval would keep the process alive past the drain.
  timer.unref();

  fastify.addHook("onClose", async () => {
    clearInterval(timer);
    clearInterval(archiveTimer);
  });

  fastify.log.info({ intervalMs: SWEEP_INTERVAL_MS }, "Abandoned-checkout sweep scheduled");
  fastify.log.info(
    { intervalMs: AUDIT_ARCHIVE_INTERVAL_MS },
    "Audit archive scheduled",
  );
});
