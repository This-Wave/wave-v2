import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { colors } from "../../theme/tokens";

type Variant = "primary" | "inverse" | "ghost" | "quiet";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading glyph, rendered at the label's ink colour. */
  icon?: ReactNode;
  full?: boolean;
}

/**
 * v6 buttons. Three shapes only, and the accent rule drives all of them:
 *
 * - `primary`  lime fill, INK label. #87ea5c is far too bright for white text
 *              (~1.8:1), so the accent is never a background for white. This is
 *              the inversion of v5, where every CTA was white-on-green.
 * - `inverse`  ink fill, white label. For the second action on a surface where
 *              two primaries would fight, and for destructive confirmations.
 * - `ghost`    hairline ink border, transparent. Secondary actions.
 * - `quiet`    text only. Tertiary — "Not now", "Skip".
 *
 * Pill radius throughout, per the reference. 52px tall: the reference's desktop
 * controls are shorter, but this is a thumb target on a phone.
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  full = true,
}: ButtonProps) {
  const inert = disabled || loading;

  const surface =
    variant === "primary"
      ? inert
        ? "bg-surface-muted"
        : "bg-lime active:bg-lime-600"
      : variant === "inverse"
        ? inert
          ? "bg-surface-muted"
          : "bg-ink"
        : variant === "ghost"
          ? "border border-ink bg-transparent active:bg-hairline"
          : "bg-transparent";

  const labelColor =
    variant === "inverse" ? (inert ? "text-subtle" : "text-white") : inert ? "text-subtle" : "text-ink";

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inert }}
      className={`h-[52px] flex-row items-center justify-center gap-2 rounded-pill px-6 ${surface} ${
        full ? "w-full" : ""
      }`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "inverse" ? colors.white : colors.ink} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text className={`font-sans-medium text-ui ${labelColor}`}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
