import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { ChevronLeftIcon, WaveMarkIcon } from "../icons";
import { colors } from "../../theme/tokens";
import { useLayout } from "../../hooks/useLayout";

/**
 * The mark and the wordmark, side by side.
 *
 * The wordmark is the one place the accent appears as a mark rather than an
 * action — the reference allows the logo exactly this exemption, and the lime
 * lives inside the badge where it is a fill with ink behind it, never text.
 *
 * `accessible` with one label, because a screen reader announcing "image, wave"
 * twice for a logo is noise. It is not a button: tapping a logo does nothing
 * here, and a control that looks like a control but is not is worse than none.
 */
export function BrandLockup({ size = 26 }: { size?: number }) {
  return (
    <View className="flex-row items-center gap-2" accessible accessibilityLabel="Wave">
      <View className="overflow-hidden rounded-input">
        <WaveMarkIcon size={size} />
      </View>
      <Text className="font-sans-bold text-subheading text-ink">wave</Text>
    </View>
  );
}

/**
 * Stack header. A back disc, an optional centred title, and an optional trailing
 * slot. Sits on the canvas with no border and no shadow — the reference keeps
 * chrome off the header entirely and lets the content below carry the page.
 */
export function TopBar({
  title,
  onBack,
  trailing,
}: {
  title?: string;
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  const { gutter } = useLayout();
  return (
    <View
      className="h-16 flex-row items-center justify-between"
      style={{ paddingHorizontal: gutter }}
    >
      <View className="w-11">
        {onBack ? (
          // v7: square back key with a 2px edge (canvas .iconbtn).
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={6}
            className="h-11 w-11 items-center justify-center rounded-input border-2 border-hairline bg-surface active:bg-canvas"
          >
            <ChevronLeftIcon size={20} color={colors.ink} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <Text
          accessibilityRole="header"
          className="flex-1 text-center font-sans-bold text-ui text-ink"
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : (
        <View className="flex-1" />
      )}
      <View className="w-11 items-end">{trailing}</View>
    </View>
  );
}

/**
 * The header every tab page carries except the one with the greeting panel:
 * mark left, actions right.
 *
 * The tab pages had no header at all — they opened straight onto a heading, so
 * Orders, Checkpoints and Profile were the only screens in the app carrying no
 * sign of what app they belonged to. Each role's first tab is the exception,
 * because its ink greeting panel is already the top of the screen and a mark
 * above it would be a second header.
 */
export function BrandBar({ trailing }: { trailing?: ReactNode }) {
  const { gutter, isDesktop } = useLayout();
  // Web chrome already shows the wordmark in the side nav — don't duplicate it.
  // With nothing in the trailing slot there is no row left to draw either, and
  // rendering one anyway put an empty 56px band above every desktop tab page.
  if (isDesktop) {
    if (!trailing) return null;
    return (
      <View
        className="h-14 flex-row items-center justify-end"
        style={{ paddingHorizontal: gutter }}
      >
        <View className="flex-row items-center gap-2">{trailing}</View>
      </View>
    );
  }
  return (
    <View
      className="h-16 flex-row items-center justify-between"
      style={{ paddingHorizontal: gutter }}
    >
      <BrandLockup />
      <View className="flex-row items-center gap-2">{trailing}</View>
    </View>
  );
}
