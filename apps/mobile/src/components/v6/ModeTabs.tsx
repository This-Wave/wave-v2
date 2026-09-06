import { Pressable, Text, View } from "react-native";

export type ServiceMode = "buy" | "pickup";

const TABS: { key: ServiceMode; label: string; hint: string }[] = [
  { key: "buy", label: "Buy for me", hint: "Browse shops and we buy for you" },
  { key: "pickup", label: "Pickup", hint: "Move something between campus checkpoints" },
];

/**
 * The two things Wave does, as tabs.
 *
 * Pickup used to be one line of muted text under the search bar — half the
 * product, offered as an aside — while `ChooseServiceScreen`, which explains
 * both properly, was never reached from Home at all.
 *
 * Tabs rather than a filled segmented control, and the distinction matters:
 * Home already carries a shadowed search capsule and a Wave card, and a third
 * filled container on top of those is what made the screen feel crowded. An
 * underline costs no container at all. It is also the shape Airbnb uses for
 * Homes / Experiences / Services, which is the reference this whole system was
 * derived from — so it is the arrangement students have already learned
 * somewhere else.
 *
 * Ink underline, not lime: this is navigation, and the accent belongs to
 * actions.
 */
export function ModeTabs({
  mode,
  onChange,
}: {
  mode: ServiceMode;
  onChange: (mode: ServiceMode) => void;
}) {
  return (
    <View className="flex-row border-b border-hairline" accessibilityRole="tablist">
      {TABS.map((tab) => {
        const active = tab.key === mode;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            accessibilityHint={active ? undefined : tab.hint}
            className="mr-7 items-center pb-2.5 pt-1"
          >
            <Text
              className={`text-ui ${
                active ? "font-sans-semibold text-ink" : "font-sans text-muted"
              }`}
            >
              {tab.label}
            </Text>
            {/* Sits on the container's own hairline, so the active tab reads as
                joined to the content below it rather than merely coloured. */}
            <View
              className={`mt-2 h-0.5 w-full rounded-pill ${active ? "bg-ink" : "bg-transparent"}`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
