import { Text, View } from "react-native";
import { recentPickupRoutes, type RecentRoute } from "@wave/shared";
import { useMyOrders } from "../../lib/orders";
import { Row, RowGroup } from "./List";

/** "today", "yesterday", "3 days ago", then a date once it stops being useful. */
function lastSent(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "sent today";
  if (days === 1) return "sent yesterday";
  if (days < 14) return `sent ${days} days ago`;
  return `sent ${new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

/**
 * The routes this student has sent a package along before, as one tap each.
 *
 * Choosing two checkpoints from a list is the fiddly part of a pickup, and
 * campus routes repeat — the same room to the same gate, most weeks. Tapping a
 * route opens the pickup form with both ends already chosen; it never orders
 * anything, because what is in the parcel changes even when the route doesn't.
 *
 * Rendered from the orders the app already has, so it costs no request, and it
 * is absent for anyone who has not sent a package yet.
 */
export function MoveItAgain({ onPick }: { onPick: (route: RecentRoute) => void }) {
  const { data: orders } = useMyOrders();
  const routes = recentPickupRoutes(orders ?? []);

  if (routes.length === 0) return null;

  return (
    <View>
      <Text className="mb-3 font-sans-medium text-heading-sm text-ink">Move it again</Text>
      <RowGroup>
        {routes.map((route) => (
          <Row
            key={route.key}
            title={`${route.originName} → ${route.destinationName}`}
            meta={route.timesUsed > 1 ? `${lastSent(route.lastUsedAt)} · ${route.timesUsed} times` : lastSent(route.lastUsedAt)}
            // The arrow is decoration; the label has to carry the direction.
            accessibilityLabel={`Send another package from ${route.originName} to ${route.destinationName}. ${
              route.timesUsed > 1 ? `Sent ${route.timesUsed} times, most recently ${lastSent(route.lastUsedAt)}` : lastSent(route.lastUsedAt)
            }`}
            onPress={() => onPick(route)}
          />
        ))}
      </RowGroup>
    </View>
  );
}
