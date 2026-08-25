/**
 * The message the API meant the user to see, or a fallback.
 *
 * Every Fastify route answers failures as `{ error: string }`, and those
 * strings are written for the person reading them — "This order has already
 * been accepted by another rider" tells a rider exactly what happened, where a
 * generic "Something went wrong" leaves them tapping the button again.
 *
 * This cast was copy-pasted into five screens, and the screens that forgot it
 * showed nothing at all on failure (review 08-mobile, H4). Having one function
 * means a route that changes its error shape is fixed in one place.
 *
 * Deliberately does not surface `details` from Zod failures: those name field
 * paths and are for developers, not for a rider standing at a checkpoint.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}
