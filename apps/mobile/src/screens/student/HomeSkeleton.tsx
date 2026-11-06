import { View } from "react-native";
import { Skeleton } from "../../components/v6";

/**
 * Home's placeholder while `/orders/my` is in flight.
 *
 * Everything below the greeting panel is derived from that one request — the
 * unpaid-order card, the active deliveries, the repeat routes, and the
 * newcomer explainer, which is deliberately held back until the orders are
 * known so it cannot flash in front of someone who has sent plenty. The
 * consequence was that Home had nothing at all in that slot while it waited:
 * the panel, one card about shops, and roughly 900px of empty canvas. It read
 * as a broken screen rather than a loading one, and on Ghanaian mobile data it
 * is a state students will meet often.
 *
 * Sized to roughly the height of what usually replaces it, so the card below
 * barely moves when the answer lands.
 *
 * It stands in for a section whose *shape* is not yet known — one delivery, three
 * routes, or an explainer — so this is one calm block rather than a mimicry of
 * any particular one. No shimmer, per `Skeleton`.
 */
export function HomeSkeleton() {
  return (
    <View
      className="rounded-card bg-surface p-4"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading your orders"
    >
      <Skeleton height={20} radius={4} width="45%" />
      <View className="pt-4" style={{ gap: 12 }}>
        <Skeleton height={14} radius={4} width="88%" />
        <Skeleton height={14} radius={4} width="70%" />
        <Skeleton height={14} radius={4} width="78%" />
      </View>
    </View>
  );
}
