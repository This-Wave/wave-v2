/**
 * Where a rider is in a delivery, read from the order's status.
 *
 * `ActiveDeliveryScreen` used to keep this in local state that always started
 * at "go and collect it", so reopening a job already on its way sent the rider
 * back to step one.
 */
export type Step = "at_shop" | "en_route" | "at_checkpoint";

export const STEP_RANK: Record<Step, number> = { at_shop: 0, en_route: 1, at_checkpoint: 2 };

/** Anything before pickup — including a status not loaded yet — is "go and collect". */
export function stepFor(status: string | undefined): Step {
  if (status === "at_checkpoint") return "at_checkpoint";
  if (status === "en_route") return "en_route";
  return "at_shop";
}
