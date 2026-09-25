import type { Order } from "../types";

type JobFields = Pick<Order, "orderType" | "shop" | "originCheckpoint" | "suggestion" | "deliveryFee" | "estimatedEarning">;

/**
 * How a rider's job is named, where it starts, and what it pays.
 *
 * Only a Buy for me order has a Wave shop. A package pickup starts at a campus
 * checkpoint and a suggested-shop run at a shop that is not on Wave yet — the
 * feed used to title all three "Shop", sending riders to the wrong place.
 */
export function jobOrigin(order: JobFields) {
  if (order.orderType === "pickup") {
    return { title: "Package pickup", from: order.originCheckpoint?.name ?? "A checkpoint", logoUrl: null };
  }
  if (order.orderType === "shop_pickup") {
    return {
      title: order.suggestion?.name ?? "Shop",
      from: order.suggestion?.locationText ?? "Off-campus",
      logoUrl: null,
    };
  }
  return { title: order.shop?.name ?? "Shop", from: order.shop?.locationText ?? "Off-campus", logoUrl: order.shop?.logoUrl ?? null };
}

/**
 * What a job pays the rider, when the server quotes it (`rider_earnings_preview`),
 * otherwise the delivery fee — labelled as a fee, because it is not their share.
 */
export function jobPay(order: JobFields): { amount: number; isEarning: boolean } {
  return order.estimatedEarning
    ? { amount: Number(order.estimatedEarning), isEarning: true }
    : { amount: Number(order.deliveryFee), isEarning: false };
}
