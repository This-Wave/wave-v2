import { Pressable, ScrollView, Text } from "react-native";
import type { Shop } from "../../types";

interface ShopSwitcherProps {
  shops: Shop[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

/**
 * Horizontal chips for owners who hold more than one shop.
 *
 * Renders nothing for a single-shop owner — which is the common case — so the
 * screens stay exactly as they were rather than growing a control that only ever
 * has one option.
 *
 * A paused shop is marked here as well as in Settings: an owner switching
 * between storefronts should be able to see which are closed without opening
 * each one.
 */
export function ShopSwitcher({ shops, selectedId, onSelect }: ShopSwitcherProps) {
  if (shops.length < 2) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerStyle={{ gap: 8, paddingRight: 8 }}
    >
      {shops.map((shop) => {
        const active = shop.id === selectedId;
        return (
          <Pressable
            key={shop.id}
            onPress={() => onSelect(shop.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={`rounded-chip border px-3.5 py-2 ${
              active ? "border-wave-500 bg-wave-500" : "border-border bg-surface"
            }`}
          >
            <Text
              numberOfLines={1}
              className={`font-sans-semibold text-[12px] ${active ? "text-white" : "text-ink"}`}
            >
              {shop.name}
              {shop.isActive === false ? " · Closed" : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
