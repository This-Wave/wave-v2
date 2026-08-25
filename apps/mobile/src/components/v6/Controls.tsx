import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";

/**
 * Circular icon button. The reference's 40px `#f7f7f7` disc — but our screens
 * sit ON the canvas, so the disc is white to read against it.
 */
export function IconCircle({
  children,
  onPress,
  size = 40,
  tone = "surface",
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  size?: number;
  tone?: "surface" | "lime" | "ink" | "transparent";
  accessibilityLabel?: string;
}) {
  const bg =
    tone === "lime"
      ? "bg-lime active:bg-lime-600"
      : tone === "ink"
        ? "bg-ink"
        : tone === "transparent"
          ? "bg-transparent"
          : "bg-surface active:bg-hairline";
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height: size }}
      className={`items-center justify-center rounded-pill ${bg}`}
    >
      {children}
    </Pressable>
  );
}

/**
 * Filter chip. Selected = ink fill with white label, NOT lime — lime is
 * reserved for actions, and a rail of six lime chips would spend the accent on
 * navigation. Unselected = white on canvas with a hairline.
 */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      className={`h-9 justify-center rounded-pill px-4 ${
        selected ? "bg-ink" : "border border-hairline bg-surface"
      }`}
    >
      <Text className={`font-sans-medium text-body ${selected ? "text-white" : "text-ink"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

type PillTone = "neutral" | "active" | "done" | "danger";

/**
 * Status pill. Deliberately quiet: three of the four tones are achromatic, and
 * only a live order earns the accent. If every status were coloured, none of
 * them would signal anything.
 */
export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: PillTone }) {
  const skin =
    tone === "active"
      ? "bg-lime"
      : tone === "done"
        ? "bg-lime-faint"
        : tone === "danger"
          ? "bg-danger-bg"
          : "bg-hairline";
  const ink = tone === "danger" ? "text-danger" : "text-ink";
  return (
    <View className={`self-start rounded-pill px-3 py-1 ${skin}`}>
      <Text className={`font-sans-semibold text-meta ${ink}`}>{label}</Text>
    </View>
  );
}

/**
 * Section heading with a trailing arrow. 22/500 at -0.44px tracking — the tight
 * negative tracking is the geometric-sans signature at this size, and the arrow
 * carries the affordance so the title needs no underline or link colour.
 */
export function SectionTitle({
  title,
  onPress,
  className = "",
}: {
  title: string;
  onPress?: () => void;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center gap-1 ${className}`}
    >
      <Text className="font-sans-medium text-heading-sm text-ink">{title}</Text>
      {onPress ? <ChevronRightIcon size={20} color={colors.ink} strokeWidth={2} /> : null}
    </Pressable>
  );
}

/** Page title, 28/700. One per screen, and never alongside a TopBar title. */
export function PageTitle({ children }: { children: ReactNode }) {
  return <Text className="font-sans-bold text-heading text-ink">{children}</Text>;
}

/** Hairline divider between list rows. */
export function Divider() {
  return <View className="h-px bg-hairline" />;
}
