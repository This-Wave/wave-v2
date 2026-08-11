import { Pressable, Text, TextInput, View } from "react-native";

interface CodeInputProps {
  length?: number;
  value: string;
  onChangeText?: (value: string) => void;
  state?: "default" | "error" | "dark";
  editable?: boolean;
  onPressCapture?: () => void;
}

/**
 * v5 screen 11 cell: 44x58, 18px radius, white with a hairline border; the
 * "current" cell flips to solid green with a lime numeral.
 */
export function CodeInput({
  length = 6,
  value,
  onChangeText,
  state = "default",
  editable = true,
  onPressCapture,
}: CodeInputProps) {
  const cells = Array.from({ length }, (_, i) => value[i] ?? "");

  return (
    <View className="relative flex-row gap-2.5">
      {cells.map((digit, index) => {
        const isActive = editable && index === value.length && state === "default";

        let cellClass = "border border-border bg-surface";
        let textClass = "text-ink";
        if (state === "error") {
          cellClass = "border border-danger-text bg-danger-bg";
          textClass = "text-danger-text";
        } else if (isActive) {
          cellClass = "bg-wave-500";
          textClass = "text-wave-lime";
        }

        return (
          <View
            key={index}
            className={`h-[58px] flex-1 items-center justify-center rounded-control ${cellClass}`}
          >
            <Text className={`font-sans-semibold text-[26px] ${textClass}`}>{digit}</Text>
          </View>
        );
      })}
      {editable ? (
        <Pressable className="absolute inset-0" onPress={onPressCapture}>
          <TextInput
            value={value}
            onChangeText={(text) => onChangeText?.(text.replace(/[^0-9]/g, "").slice(0, length))}
            keyboardType="number-pad"
            maxLength={length}
            className="h-full w-full opacity-0"
            autoFocus
          />
        </Pressable>
      ) : null}
    </View>
  );
}
