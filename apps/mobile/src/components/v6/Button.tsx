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
  /** v7 canvas `.btn.sm`: 44px tall, 13px label (in-card actions like Track). */
  small?: boolean;
  accessibilityLabel?: string;
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
 * Pill radius throughout, per the reference. 52px minimum: the reference's
 * desktop controls are shorter, but this is a thumb target on a phone. It is a
 * minimum rather than a fixed height so the label can still grow with the OS
 * text-size setting instead of clipping (1.4.4).
 */
export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  full = true,
  small,
  accessibilityLabel,
}: ButtonProps) {
  const inert = disabled || loading;

  // v7 (2026-11-26): sticker buttons. 12px corners, a 4px bottom edge that
  // presses down, uppercase bold label. Lime always carries `on-lime` text.
  const surface =
    variant === "primary"
      ? inert
        ? "bg-hairline border-b-4 border-line"
        : "bg-lime border-b-4 border-lime-edge active:border-b-2 active:translate-y-0.5"
      : variant === "inverse"
        ? inert
          ? "bg-hairline border-b-4 border-line"
          : "bg-ink border-b-4 border-ink-700 active:border-b-2 active:translate-y-0.5"
        : variant === "ghost"
          ? "border-2 border-b-4 border-line bg-surface active:border-b-2 active:translate-y-0.5"
          : "bg-transparent";

  const labelColor =
    variant === "inverse" ? (inert ? "text-subtle" : "text-white") : inert ? "text-muted" : variant === "primary" ? "text-on-lime" : "text-ink";

  return (
    <Pressable
      onPress={inert ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inert, busy: !!loading }}
      // Without this the spinner is silent — the label vanishes and a screen
      // reader has nothing to report while the request is in flight.
      accessibilityValue={loading ? { text: "Working" } : undefined}
      className={`${small ? "min-h-[44px] px-4 py-2" : "min-h-[56px] px-6 py-3"} flex-row items-center justify-center gap-2 rounded-input ${surface} ${
        full ? "w-full" : ""
      }`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "inverse" ? colors.white : colors.ink} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            className={`font-sans-bold ${small ? "text-meta" : "text-ui"} ${
              // v7 canvas: text-only actions ("Not now", "Cancel") stay in
              // sentence case; only keys with a surface shout.
              variant === "quiet" ? "text-ink-700" : `uppercase tracking-wider ${labelColor}`
            }`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
