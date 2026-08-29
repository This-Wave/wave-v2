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
 *
 * **Accessibility (review 10-a11y, L2).** In entry mode the digit cells are
 * hidden from screen readers and the hidden input announces *how many* digits
 * have been entered, never which. Both things typed into this component are
 * secrets — a delivery PIN and a signup OTP — and a screen reader reads aloud.
 * A rider entering a PIN is standing at a checkpoint next to the student and
 * whoever else is waiting; speaking the digits would undo the point of having a
 * PIN at all.
 *
 * The distinction is entry vs display: a non-editable instance is showing
 * somebody their *own* code, and a blind user has to be able to hear it, so
 * those cells stay readable.
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
            // Purely visual while typing — the input below carries the
            // accessible state. Both props are needed: the first is iOS, the
            // second Android.
            accessibilityElementsHidden={editable}
            importantForAccessibility={editable ? "no-hide-descendants" : "auto"}
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
            accessibilityLabel={`${length}-digit code`}
            // Progress without disclosure: "3 of 6 digits entered" is what a
            // user needs to know, and says nothing an eavesdropper can use.
            accessibilityValue={{ text: `${value.length} of ${length} digits entered` }}
            accessibilityHint="Enter the code you were sent"
          />
        </Pressable>
      ) : null}
    </View>
  );
}
