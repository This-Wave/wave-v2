import { Text, View } from "react-native";
import type { ProductStatus } from "@wave/shared";
import { Sheet } from "../v6/Sheet";
import { Row } from "../v6/List";
import { CheckIcon } from "../icons";
import { colors } from "../../theme/tokens";

const OPTIONS: { status: ProductStatus; label: string; hint: string }[] = [
  { status: "active", label: "On menu", hint: "Students can order this" },
  { status: "out_of_stock", label: "Out of stock", hint: "Visible but not orderable today" },
  { status: "not_serving", label: "Off menu", hint: "Hidden from students" },
];

export function ProductStatusSheet({
  visible,
  productName,
  current,
  onClose,
  onSelect,
}: {
  visible: boolean;
  productName: string;
  current: ProductStatus;
  onClose: () => void;
  onSelect: (status: ProductStatus) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Item status">
      <Text className="mb-4 font-sans text-body text-muted">{productName}</Text>
      <View className="gap-1">
        {OPTIONS.map((opt) => (
          <Row
            key={opt.status}
            title={opt.label}
            meta={opt.hint}
            chevron={false}
            trailing={
              current === opt.status ? (
                <CheckIcon size={18} color={colors.ink} strokeWidth={2.2} />
              ) : null
            }
            onPress={() => {
              onSelect(opt.status);
              onClose();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
