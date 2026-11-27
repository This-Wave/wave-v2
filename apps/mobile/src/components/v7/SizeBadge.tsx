import { View } from "react-native";
import { BagIcon, EnvelopeIcon, ParcelIcon } from "../icons";
import { colors } from "../../theme/tokens";

const ICONS = { small: EnvelopeIcon, medium: BagIcon, large: ParcelIcon } as const;
// The picture gets bigger as the parcel does, so size reads at a glance.
const SCALE = { small: 20, medium: 24, large: 28 } as const;

/** A drawing of what fits the size (envelope, bag, parcel) in a wash circle. */
export function SizeBadge({ size, selected }: { size: string; selected?: boolean }) {
  const key = (size in ICONS ? size : "medium") as keyof typeof ICONS;
  const Icon = ICONS[key];
  return (
    <View
      className={`h-12 w-12 items-center justify-center rounded-pill ${selected ? "bg-lime" : "bg-wash"}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon size={SCALE[key]} color={selected ? colors.onLime : colors.ink} strokeWidth={1.8} />
    </View>
  );
}
