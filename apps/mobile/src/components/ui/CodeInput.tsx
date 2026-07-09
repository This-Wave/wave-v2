import { Pressable, Text, TextInput, View } from "react-native";

interface CodeInputProps {
  length?: number;
  value: string;
  onChangeText?: (value: string) => void;
  state?: "default" | "error" | "dark";
  editable?: boolean;
  onPressCapture?: () => void;
}

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
    <View className="relative flex-row gap-2">
      {cells.map((digit, index) => {
        const isActive = editable && index === value.length && state === "default";
        const isFilled = digit !== "";

        let cellClass = "border-[1.5px] border-border bg-surface-muted";
        let textClass = "text-ink";
        if (state === "error") {
          cellClass = "border-[1.5px] border-danger-text bg-danger-bg";
          textClass = "text-danger-text";
        } else if (state === "dark") {
          cellClass = "bg-dark-cell";
          textClass = "text-white";
        } else if (isActive) {
          cellClass = "border-2 border-wave-500 bg-surface-muted";
        } else if (isFilled) {
          cellClass = "border-[1.5px] border-wave-500 bg-surface-muted";
        }

        return (
          <View
            key={index}
            className={`h-[54px] flex-1 items-center justify-center rounded-well ${cellClass}`}
            style={isActive ? { shadowColor: "#2EA64E", shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } } : undefined}
          >
            <Text className={`font-mono-semibold text-[22px] ${textClass}`}>{digit}</Text>
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
