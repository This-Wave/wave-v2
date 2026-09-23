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
  children,
}: {
  name: string;
  avatarUrl?: string | null;
  /** Dot on the bell: something of theirs is in flight or unpaid. */
  alert?: boolean;
  onPressAvatar: () => void;
  onPressBell: () => void;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const firstName = name.trim().split(/\s+/)[0] ?? name;

  return (
    <View
      className="rounded-b-card bg-ink px-gutter pb-5"
      style={{ paddingTop: Math.max(insets.top, 12) + 12 }}
    >
      <View className="mb-5 flex-row items-center justify-between">
        <Pressable
          onPress={onPressAvatar}
          accessibilityRole="button"
          accessibilityLabel={`${name}. Open your profile`}
          className="h-11 w-11 items-center justify-center overflow-hidden rounded-pill bg-white/15 active:opacity-80"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44 }} resizeMode="cover" />
          ) : (
            <UserIcon size={22} color={colors.white} strokeWidth={1.8} />
          )}
        </Pressable>

        <Pressable
          onPress={onPressBell}
          accessibilityRole="button"
          accessibilityLabel={alert ? "Your orders. You have an order in progress" : "Your orders"}
          className="h-11 w-11 items-center justify-center rounded-pill bg-white/15 active:opacity-80"
        >
          <BellIcon size={20} color={colors.white} strokeWidth={1.8} />
          {alert ? (
            // Lime on ink is the one pairing that works at this size; a dot
            // carries no text, so the state is in the label above.
            <View className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-pill bg-lime" />
          ) : null}
        </Pressable>
      </View>

      <Text className="font-sans text-body text-white/70">Hello,</Text>
      <Text className="mb-5 font-sans-bold text-heading text-white">{firstName}</Text>

      {children}
    </View>
  );
}
