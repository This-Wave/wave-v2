import { loadEnv } from "./config/env";
import { initSentry } from "./lib/sentry";
import { buildApp } from "./app";

initSentry(loadEnv());
const app = buildApp();

/**
 * How long to let in-flight requests finish before exiting anyway.
 *
 * Render sends SIGTERM and then SIGKILLs after ~30s, so this has to land well
 * inside that or the drain is theatre — the process dies mid-request regardless
 * and we have only delayed it.
 */
const SHUTDOWN_GRACE_MS = 10_000;

let shuttingDown = false;

/**
 * Graceful shutdown (review 06-devops, L1).
 *
 * Without this, SIGTERM kills the process instantly and every in-flight request
 * dies with it. On a delivery app that is not merely untidy: Render sends
 * SIGTERM on *every deploy*, and the request most likely to be in flight at any
 * moment is a Paystack webhook. Dropping one mid-write means Paystack gets no
 * 2xx and retries — which is survivable — but dropping it *after* the claim in
 * `confirm.ts` has committed and *before* the PIN is written strands the order
 * paid with no PIN, which is the one state the retry cannot repair.
 *
 * `app.close()` stops accepting new connections, waits for open ones, and runs
 * Fastify's onClose hooks — which is where `plugins/prisma.ts` disconnects the
 * pool, so the database connection is released rather than left for Neon to
 * time out.
 */
async function shutdown(signal: NodeJS.Signals) {
  // A second Ctrl-C, or SIGTERM followed by SIGINT, must not start a second
  // drain and race the first one's cleanup.
  if (shuttingDown) return;
  shuttingDown = true;

  app.log.info({ signal }, "Shutting down — draining in-flight requests");

  const forceExit = setTimeout(() => {
    app.log.error(
      { signal, graceMs: SHUTDOWN_GRACE_MS },
      "Drain did not finish in time — exiting anyway",
    );
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  // Do not let this timer be the only thing keeping the event loop alive: if
  // the drain finishes early we want the process free to exit immediately.
  forceExit.unref();

  try {
    await app.close();
    clearTimeout(forceExit);
    app.log.info({ signal }, "Shutdown complete");
    process.exit(0);
  } catch (err) {
    app.log.error({ err, signal }, "Error while shutting down");
    process.exit(1);
  }
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => void shutdown(signal));
}

app
  .listen({ port: app.config.PORT, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
