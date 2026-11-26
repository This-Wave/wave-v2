import type { ReactNode } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BellIcon, UserIcon } from "../icons";
import { colors } from "../../theme/tokens";

/**
 * The ink panel at the top of Home: who you are, and the one thing to do next.
 *
 * An inverse surface rather than the accent — `ink` is the palette's inverse
 * ground, and a screen of stacked white cards needs one anchor at the top or
 * everything floats at the same weight. The accent stays on the action inside
 * it, which is the thing worth pressing.
 *
 * Corners follow the card radius; the panel is square at the top because it
 * runs under the status bar.
 */
export function GreetingHeader({
  name,
  avatarUrl,
  alert,
  onPressAvatar,
  onPressBell,
  note,
  title,
  children,
  wholeName,
}: {
  name: string;
  /** Shops are called by their whole name; people by their first. */
  wholeName?: boolean;
  avatarUrl?: string | null;
  /** Dot on the bell: something of theirs is in flight or unpaid. */
  alert?: boolean;
  onPressAvatar: () => void;
  onPressBell: () => void;
  /**
   * A line between the greeting and the action — on Home, the next Wave and how
   * long is left to join it. It sits inside the panel because the deadline is
   * context for the action directly below it, and a standalone card for one
   * line of text was a card Home did not need.
   */
  note?: ReactNode;
  /** v7: the screen's one-line status in Nunito, e.g. "1 parcel on the way". */
  title?: string;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const shown = wholeName ? name.trim() : (name.trim().split(/\s+/)[0] ?? name);

  return (
    <View
      className="bg-canvas px-gutter pb-3"
      style={{ paddingTop: Math.max(insets.top, 12) + 12 }}
    >
      {/* The greeting rides the avatar row rather than sitting under it. On its
          own line, at display size, it took a third of the panel to tell
          someone their own name — and left a band of empty ink above it. Beside
          the avatar it is the same information at a glance, and the panel is
          ~90pt shorter. */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={onPressAvatar}
          accessibilityRole="button"
          accessibilityLabel={`${name}. Open your profile`}
          className="h-11 w-11 items-center justify-center overflow-hidden rounded-pill bg-wash active:opacity-80"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44 }} resizeMode="cover" />
          ) : shown.trim() && shown !== "there" ? (
            // v7 canvas: the initial on wash.
            <Text className="font-display text-subheading text-ink">{shown.trim()[0]!.toUpperCase()}</Text>
          ) : (
            <UserIcon size={22} color={colors.ink} strokeWidth={1.8} />
          )}
        </Pressable>

        <View className="min-w-0 flex-1 px-3">
          <Text className="font-sans text-meta text-muted">{greeting()}</Text>
          <Text className="font-sans-bold text-subheading text-ink" numberOfLines={1}>
            {shown}
          </Text>
        </View>

        <Pressable
          onPress={onPressBell}
          accessibilityRole="button"
          accessibilityLabel={alert ? "Your orders. You have an order in progress" : "Your orders"}
          className="h-11 w-11 items-center justify-center rounded-input border-2 border-hairline bg-surface active:opacity-80"
        >
          <BellIcon size={20} color={colors.ink} strokeWidth={1.8} />
          {alert ? (
            // Lime on ink is the one pairing that works at this size; a dot
            // carries no text, so the state is in the label above.
            <View className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-pill bg-lime" />
          ) : null}
        </Pressable>
      </View>

      {title ? (
        <Text accessibilityRole="header" className="mt-5 font-display text-heading text-ink">
          {title}
        </Text>
      ) : null}

      {note ? <View className="mt-5">{note}</View> : null}

      {children ? <View className="mt-5">{children}</View> : null}
    </View>
  );
}

/** "Good morning" / "Good afternoon" / "Good evening", by the phone's clock. */
function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
