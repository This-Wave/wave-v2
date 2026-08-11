import { Pressable, Text, View } from "react-native";
import { SearchIcon } from "../icons";
import { colors, shadowFloating } from "../../theme/tokens";
import { useLayout } from "../../hooks/useLayout";

/**
 * The hero of the home screen.
 *
 * The reference's central claim is that Airbnb has no hero image and no
 * headline — the search bar IS the hero. Wave's equivalent has two variables a
 * student actually sets: what they need, and which Wave it goes on. So the
 * capsule is segmented into exactly those two fields.
 *
 * Putting the delivery window *inside* the search is the whole idea: v5 gave it
 * a 47-hour countdown occupying a third of the screen. It is a scheduling
 * detail, not an emergency.
 *
 * This is the only element in the system that carries a shadow.
 */
export function SearchCapsule({
  query,
  waveLabel,
  onPressQuery,
  onPressWave,
  onSubmit,
}: {
  /** Current search text, or undefined for the placeholder state. */
  query?: string;
  /** e.g. "Sunday 9 Aug" — the Wave this order would join. */
  waveLabel: string;
  onPressQuery?: () => void;
  onPressWave?: () => void;
  onSubmit?: () => void;
}) {
  const { isDesktop } = useLayout();
  return (
    <View
      style={[
        shadowFloating,
        isDesktop ? { width: "100%", alignSelf: "stretch" } : undefined,
      ]}
      className="h-16 flex-row items-center rounded-pill bg-surface pl-5 pr-2"
    >
      <Pressable onPress={onPressQuery} className="flex-1 justify-center" accessibilityRole="search">
        <Text className="font-sans-semibold text-meta text-ink">What do you need</Text>
        <Text
          className={`font-sans text-body ${query ? "text-ink" : "text-muted"}`}
          numberOfLines={1}
        >
          {query || "Jollof, printing, airtime…"}
        </Text>
      </Pressable>

      <View className="mx-3 h-7 w-px bg-hairline" />

      <Pressable onPress={onPressWave} className="justify-center" accessibilityRole="button">
        <Text className="font-sans-semibold text-meta text-ink">Wave</Text>
        <Text className="font-sans text-body text-muted">{waveLabel}</Text>
      </Pressable>

      <Pressable
        onPress={onSubmit}
        accessibilityRole="button"
        accessibilityLabel="Search"
        className="ml-3 h-12 w-12 items-center justify-center rounded-pill bg-lime active:bg-lime-600"
      >
        <SearchIcon size={20} color={colors.ink} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

/**
 * The collapsed form used on every screen that is not Home — a plain tappable
 * pill that routes to search. No shadow: away from Home it is a control, not
 * the hero.
 */
export function SearchPill({ placeholder, onPress }: { placeholder: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="search"
      className="h-12 flex-row items-center gap-3 rounded-pill border border-hairline bg-surface px-4"
    >
      <SearchIcon size={18} color={colors.muted} strokeWidth={1.8} />
      <Text className="font-sans text-body text-muted">{placeholder}</Text>
    </Pressable>
  );
}
