import { Text } from "react-native";

/** v5 field label: 12px semibold, uppercase, 0.05em tracking, muted green. */
export function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 font-sans-semibold text-[12px] uppercase tracking-[0.6px] text-muted">{children}</Text>
  );
}
