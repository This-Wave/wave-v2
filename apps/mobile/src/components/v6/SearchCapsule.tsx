import { Pressable, Text, View } from "react-native";
import { SearchIcon } from "../icons";
import { colors, shadowFloating } from "../../theme/tokens";
import { useLayout } from "../../hooks/useLayout";

/**
 * The hero of the home screen.
 *
 * The reference's central claim is that Airbnb has no hero image and no
 * headline — the search bar IS the hero.
 *
 * It used to carry a second segment for the Wave. That went, for two reasons.
 * It duplicated the date the Wave banner states directly below, and duplicated
 * information is the thing to cut before a label is. And it made the capsule
 * three targets inside 64px, one of which — the action — was an unlabelled
 * lime disc. One field and one named action is the whole control now; the
 * banner owns the Wave and offers a better way to change it.
 *
 * The action is a labelled pill rather than an icon disc. "Search" costs a few
 * points of width and removes the guess, which is the trade worth making on
 * the primary action of the app's first screen.
 *
 * This and the floating tab bar are the only elements in the system carrying a
 * shadow.
 */
export function SearchCapsule({
  query,
  mode = "buy",
  onPressQuery,
  onSubmit,
}: {
  /** Current search text, or undefined for the placeholder state. */
  query?: string;
  /** Which service the student is on — changes what the capsule asks for. */
  mode?: "buy" | "pickup";
  onPressQuery?: () => void;
  onSubmit?: () => void;
}) {
  const { isDesktop } = useLayout();
  const copy =
    mode === "pickup"
      ? { label: "What are we moving", hint: "A bag, a parcel, a document…", cta: "Next" }
      : { label: "What do you need", hint: "Jollof, printing, airtime…", cta: "Search" };

  return (
    <View
      style={[
        shadowFloating,
        isDesktop ? { width: "100%", alignSelf: "stretch" } : undefined,
      ]}
      className="h-16 flex-row items-center rounded-pill bg-surface pl-5 pr-2"
    >
      <Pressable
        onPress={onPressQuery}
        className="flex-1 justify-center"
        accessibilityRole="search"
        accessibilityLabel={copy.label}
        accessibilityHint="Opens search"
      >
        <Text className="font-sans-semibold text-meta text-ink">{copy.label}</Text>
        <Text
          className={`font-sans text-body ${query ? "text-ink" : "text-muted"}`}
          numberOfLines={1}
        >
          {query || copy.hint}
        </Text>
      </Pressable>

      <Pressable
        onPress={onSubmit}
        accessibilityRole="button"
        accessibilityLabel={copy.cta}
        className="ml-3 h-12 flex-row items-center gap-2 rounded-pill bg-lime px-[18px] active:bg-lime-600"
      >
        <SearchIcon size={18} color={colors.ink} strokeWidth={2.2} />
        <Text className="font-sans-medium text-ui text-ink">{copy.cta}</Text>
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
