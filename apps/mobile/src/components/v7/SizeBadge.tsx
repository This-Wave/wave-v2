import { View } from "react-native";
import { BagIcon, CartonsIcon, EnvelopeIcon, ParcelIcon } from "../icons";
import { colors } from "../../theme/tokens";

const ICONS = { ripple: EnvelopeIcon, wave: BagIcon, swell: ParcelIcon, tide: CartonsIcon } as const;
// The picture gets bigger as the parcel does, so size reads at a glance.
const SCALE = { ripple: 20, wave: 23, swell: 26, tide: 29 } as const;

/** A drawing of what fits the size (envelope, bag, parcel, cartons) in a wash circle. */
export function SizeBadge({ size, selected }: { size: string; selected?: boolean }) {
  const key = (size in ICONS ? size : "wave") as keyof typeof ICONS;
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
