import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { sweepAbandonedCheckouts } from "../modules/payments/sweepAbandoned";

/**
 * How often the abandoned-checkout sweep runs.
 *
 * Well under the 45-minute TTL so a stale order is picked up on the first sweep
 * after it qualifies rather than up to a full TTL later, and far enough apart
 * that the Paystack lookups stay a rounding error against real traffic.
 */
export const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

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
    } catch (err) {
      // Never let a throw escape a timer callback: an unhandled rejection here
      // takes the whole API down, and a failed sweep is not worth an outage.
      fastify.log.error({ err }, "Abandoned-checkout sweep failed");
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => void tick(), SWEEP_INTERVAL_MS);
  // Do not hold the event loop open: `index.ts` drains and exits on SIGTERM, and
  // a live interval would keep the process alive past the drain.
  timer.unref();

  fastify.addHook("onClose", async () => {
    clearInterval(timer);
  });

  fastify.log.info({ intervalMs: SWEEP_INTERVAL_MS }, "Abandoned-checkout sweep scheduled");
});
