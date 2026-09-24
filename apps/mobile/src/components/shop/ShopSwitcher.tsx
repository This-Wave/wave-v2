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
            accessibilityLabel={`${shop.name}${shop.isActive === false ? ", closed" : ""}`}
            // 44 minimum: these are the only way to change which storefront
            // every other screen is talking about, and they sit in a
            // side-scrolling rail. 2.5.8.
            className={`min-h-[44px] justify-center rounded-pill border px-4 ${
              active ? "border-ink bg-ink" : "border-hairline bg-surface"
            }`}
          >
            <Text
              numberOfLines={1}
              className={`font-sans-semibold text-meta ${active ? "text-white" : "text-ink"}`}
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
