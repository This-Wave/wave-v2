import { Image, Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { useLayout } from "../../hooks/useLayout";

/**
 * The repeating content card — the workhorse of the whole redesign.
 *
 * Three rules from the reference, all of them load-bearing:
 *  1. No border and no shadow. Separation comes from the white image and text
 *     sitting on the #f7f7f7 canvas, nothing else.
 *  2. The image is full-bleed inside its own 12px frame — no padding, no inset,
 *     no decorative ring.
 *  3. Text sits directly beneath at a 12px gutter: title 14/500 ink, metadata
 *     14/400 muted, price with the numeral at 14/600.
 *
 * `width` is passed rather than inferred so a horizontal rail and a full-width
 * list can share one component without either guessing at the other's layout.
 */
export function PhotoCard({
  imageUrl,
  title,
  meta,
  priceLabel,
  priceValue,
  badge,
  overlay,
  width,
  aspect = 1,
  onPress,
}: {
  imageUrl?: string | null;
  title: string;
  /** Secondary line — location, hours, whatever identifies the thing. */
  meta?: string;
  /** Leading words of the price line, e.g. "from". */
  priceLabel?: string;
  /** The numeral itself, set at 600 so it carries the line. */
  priceValue?: string;
  /** White pill in the image's top-left, e.g. "Open now". */
  badge?: string;
  /** Top-right slot — the save control. */
  overlay?: ReactNode;
  width?: number;
  aspect?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={width ? { width } : undefined} accessibilityRole="button">
      <View
        style={{ aspectRatio: aspect }}
        className="w-full overflow-hidden rounded-card bg-surface-muted"
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="h-full w-full" resizeMode="cover" />
        ) : null}
      </View>

      {badge ? (
        <View className="absolute left-3 top-3 rounded-pill bg-surface px-3 py-1">
          <Text className="font-sans-semibold text-meta text-ink">{badge}</Text>
        </View>
      ) : null}
      {overlay ? <View className="absolute right-2 top-2">{overlay}</View> : null}

      <View className="pt-3">
        <Text className="font-sans-medium text-body text-ink" numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text className="font-sans text-body text-muted" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {priceValue ? (
          <Text className="font-sans text-body text-ink" numberOfLines={1}>
            {priceLabel ? `${priceLabel} ` : ""}
            <Text className="font-sans-semibold">{priceValue}</Text>
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * The horizontal-rail wrapper. The reference's rows scroll rather than wrap, and
 * the card is deliberately cut off at the right edge so the row reads as
 * continuing — that is what invites the swipe.
 */
export function CardRail({ children }: { children: ReactNode }) {
  const { gutter } = useLayout();
  return (
    <View className="flex-row gap-3" style={{ paddingLeft: gutter, paddingRight: 8 }}>
      {children}
    </View>
  );
}

/**
 * Wrapping shop grid for wide web — same PhotoCards as the rail, but columns
 * instead of a horizontal scroll so desktop doesn't look like a stretched phone.
 */
export function CardGrid({ children }: { children: ReactNode }) {
  const { gutter, isDesktop } = useLayout();
  return (
    <View
      className="flex-row flex-wrap"
      style={{
        paddingHorizontal: gutter,
        gap: isDesktop ? 16 : 12,
        rowGap: isDesktop ? 28 : 24,
      }}
    >
      {children}
    </View>
  );
}
