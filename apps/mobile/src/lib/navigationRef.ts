import { createNavigationContainerRef } from "@react-navigation/native";

/**
 * The routes reachable from outside the tree, across all three role stacks.
 * Typed loosely on purpose: the ref is created before any one navigator is
 * mounted, so it cannot be bound to a single stack's param list.
 */
type OrderRoutes = {
  OrderTracking: { orderId: string };
  ActiveDelivery: { orderId: string };
};

/**
 * A navigation handle usable from outside the React tree.
 *
 * Exists because a push notification arrives at a listener registered in a
 * provider, not at a screen — so there is no `useNavigation` in scope. Tapping
 * "Your order has arrived" used to only drop the orders cache and leave the
 * student wherever they were, which is the least useful thing a tapped
 * notification can do.
 */
export const navigationRef = createNavigationContainerRef<OrderRoutes>();

/**
 * Opens an order, whichever role is signed in.
 *
 * Each role's stack has a different screen for "this order": a student tracks
 * it, a rider carries it. Both stacks name the route the same way from the
 * root, so the caller does not have to know who is looking.
 */
export function openOrder(orderId: string, role: "student" | "rider" | "other") {
  if (!navigationRef.isReady()) return;
  if (role === "rider") {
    navigationRef.navigate("ActiveDelivery", { orderId });
    return;
  }
  if (role === "student") {
    navigationRef.navigate("OrderTracking", { orderId });
  }
  // Shop owners have no per-order tracking screen; the dashboard already lists
  // what needs them, and the cache invalidation refreshes it.
}
