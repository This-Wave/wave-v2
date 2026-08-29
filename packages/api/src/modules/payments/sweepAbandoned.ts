import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { fetchPaystackTransaction } from "./paystack";
import { paystackMatchesGhs } from "./amounts";
import { confirmDeliveryFeePaid } from "./confirm";
import { capturePaymentIssue } from "../../lib/sentry";
import { notifyOrderStatus } from "../notifications/dispatch";

/**
 * How long an unpaid checkout may sit before the sweeper touches it.
 *
 * Long enough that it can never race a student who is genuinely still paying:
 * a Paystack checkout page expires well inside this, and MoMo — where the payer
 * has to leave the app, approve a USSD prompt and come back — is the slow case
 * that sets the floor. Short enough that a student is not left staring at an
 * order they abandoned an hour ago and cannot re-place.
 */
export const ABANDONED_CHECKOUT_TTL_MS = 45 * 60 * 1000;

/**
 * Orders examined per sweep. Each one with a reference costs a Paystack round
 * trip, and the sweep shares an event loop with live traffic, so this is capped
 * rather than unbounded — a backlog drains over several sweeps instead of
 * stalling the API for one long one.
 */
export const SWEEP_BATCH_SIZE = 50;

export interface SweepResult {
  /** Rows that were past the TTL and looked at. */
  examined: number;
  /** Paid all along — the webhook never landed. Confirmed by this sweep. */
  recovered: number;
  /** Genuinely unpaid and now `cancelled`. */
  cancelled: number;
  /** Deliberately left alone: a provider blip, or a paid-but-mismatched amount. */
  skipped: number;
}

/** The reason written to `Order.cancellationReason`, and shown to the student. */
export const ABANDONED_CANCELLATION_REASON =
  "Payment was never completed, so this order was closed automatically. You can place it again.";

/**
 * Closes out checkouts nobody ever paid for — and rescues the ones that were
 * paid but never heard about.
 *
 * **Why this exists.** `POST /orders` creates the order `payment_pending`, and
 * the *only* things that ever move it off that status are the Paystack webhook
 * and the verify poll. A student who opens checkout and walks away satisfies
 * neither, so the row sits `payment_pending` forever: it counts against nothing,
 * it is invisible to the admin revenue figure, and it clutters the student's
 * order list with something they can neither pay nor cancel.
 *
 * **The second, more valuable half.** The verify poll only runs while the app is
 * open. `render.yaml` spells out the surviving hole: the API is on a free plan
 * that sleeps, so a webhook arriving during a cold start can be dropped, and a
 * student who pays and immediately closes the app has no path left. This sweep
 * is that path — it asks Paystack about every stale reference, and a charge that
 * really succeeded is confirmed through exactly the same
 * `confirmDeliveryFeePaid` the webhook uses, PIN and rider announcement
 * included.
 *
 * **The invariant that matters: never cancel an order that took money.** So an
 * order is only ever cancelled after Paystack has been asked and has answered
 * something other than "success". Anything else — a network blip, a 500, an
 * amount that does not reconcile — leaves the row exactly as it was for the next
 * sweep to look at again. Skipping is always safe; cancelling a paid order is
 * not, and there is no rush.
 */
export async function sweepAbandonedCheckouts(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  /** Injected by the tests so a fixed clock can drive the TTL. */
  now?: Date;
  ttlMs?: number;
  limit?: number;
}): Promise<SweepResult> {
  const { fastify, log } = args;
  const now = args.now ?? new Date();
  const ttlMs = args.ttlMs ?? ABANDONED_CHECKOUT_TTL_MS;
  const cutoff = new Date(now.getTime() - ttlMs);

  const stale = await fastify.prisma.order.findMany({
    where: {
      // `pending` as well as `payment_pending`: both are legal predecessors of
      // `cancelled` in `orders/transitions.ts`, and an order that failed before
      // it ever reached Paystack strands just as permanently.
      status: { in: ["pending", "payment_pending"] },
      paidAt: null,
      createdAt: { lt: cutoff },
    },
    select: { id: true, paystackRef: true, totalAmount: true },
    orderBy: { createdAt: "asc" },
    take: args.limit ?? SWEEP_BATCH_SIZE,
  });

  const result: SweepResult = { examined: stale.length, recovered: 0, cancelled: 0, skipped: 0 };
  if (stale.length === 0) return result;

  for (const order of stale) {
    const outcome = await settleOne({ fastify, log, order });
    result[outcome] += 1;
  }

  log.info({ ...result, cutoff }, "Swept abandoned checkouts");
  return result;
}

async function settleOne(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  order: { id: string; paystackRef: string | null; totalAmount: unknown };
}): Promise<"recovered" | "cancelled" | "skipped"> {
  const { fastify, log, order } = args;

  // No reference at all means checkout was never even opened — there is nothing
  // for Paystack to know about, so there is nothing to ask.
  if (order.paystackRef) {
    const expectedGhs = Number(order.totalAmount);

    let transaction;
    try {
      transaction = await fetchPaystackTransaction(fastify.config.PAYSTACK_SECRET_KEY, order.paystackRef);
    } catch (err) {
      // The one case where we know nothing. Leave the row untouched and look
      // again next sweep — an order that lingers an extra hour costs nobody
      // anything, and cancelling a charge we could not verify costs a student
      // their money.
      log.warn(
        { orderId: order.id, reference: order.paystackRef, err: (err as Error).message },
        "Abandoned-checkout sweep could not reach Paystack — leaving the order for the next sweep",
      );
      return "skipped";
    }

    if (transaction?.status === "success") {
      if (!paystackMatchesGhs(transaction, expectedGhs)) {
        // Paid, but not for what we think this order costs. Never confirm it and
        // never cancel it — both are wrong, and only a human can say which.
        log.error(
          { orderId: order.id, reference: order.paystackRef, expectedGhs },
          "Abandoned-checkout sweep found a paid charge whose amount does not match the order — refusing to confirm or cancel",
        );
        capturePaymentIssue("Abandoned-checkout sweep amount mismatch", {
          phase: "sweep_abandoned",
          orderId: order.id,
          reference: order.paystackRef,
          expectedGhs,
        });
        return "skipped";
      }

      log.warn(
        { orderId: order.id, reference: order.paystackRef },
        "Abandoned-checkout sweep found a paid order that was never confirmed — the webhook never landed",
      );
      capturePaymentIssue("Order confirmed by the abandoned-checkout sweep", {
        phase: "sweep_abandoned",
        orderId: order.id,
        reference: order.paystackRef,
      });
      await confirmDeliveryFeePaid({
        fastify,
        log,
        orderId: order.id,
        reference: order.paystackRef,
      });
      return "recovered";
    }
  }

  // The claim, and the reason two API instances can both sweep safely. The
  // status and `paidAt: null` are predicates inside the same conditional UPDATE
  // that performs the write, so the database decides the winner: a webhook that
  // lands between the Paystack lookup above and this statement sets `paidAt`,
  // this matches zero rows, and the paid order is left confirmed rather than
  // cancelled out from under the student. Same shape as the claim in `confirm.ts`.
  const cancelled = await fastify.prisma.order.updateMany({
    where: { id: order.id, status: { in: ["pending", "payment_pending"] }, paidAt: null },
    data: { status: "cancelled", cancellationReason: ABANDONED_CANCELLATION_REASON },
  });
  if (cancelled.count === 0) return "skipped";

  // The order is cancelled either way. `notifyOrderStatus` is documented as
  // best-effort and swallowing its own errors, but the sweep must not *depend*
  // on that: a throw here would abandon the rest of the batch, so every order
  // after this one in the same pass would go unexamined until the next sweep.
  try {
    await notifyOrderStatus({ fastify, log, orderId: order.id, status: "cancelled" });
  } catch (err) {
    log.error(
      { orderId: order.id, err },
      "Abandoned-checkout sweep cancelled the order but could not notify the student",
    );
  }
  return "cancelled";
}
