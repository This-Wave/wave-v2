import { Image, View } from "react-native";
import type { ViewStyle } from "react-native";

interface ImagePlaceholderProps {
  uri?: string | null;
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Stand-in for the design's `image-slot` regions (shop logos, storefront photos,
 * onboarding art, the tracking map). Renders the real image when one exists and
 * a quiet canvas block otherwise — never a broken frame.
 */
export function ImagePlaceholder({ uri, width = "100%", height, radius = 24, style }: ImagePlaceholderProps) {
  return (
    <View
      className={uri ? "overflow-hidden" : "overflow-hidden border border-border bg-surface-skeleton"}
      style={[{ width, height, borderRadius: radius }, style]}
    >
      {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : null}
    </View>
  );
}
