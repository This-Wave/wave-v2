import { Pressable, Text, TextInput, View } from "react-native";

interface CodeInputProps {
  length?: number;
  value: string;
  onChangeText?: (value: string) => void;
  state?: "default" | "error";
  editable?: boolean;
  onPressCapture?: () => void;
  /** What the code is for. Entry mode needs it; a PIN and an OTP are different
   *  things and "6-digit code" alone does not say which you are being asked for. */
  accessibilityLabel?: string;
}

/**
 * Six cells for a delivery PIN or a signup code.
 *
 * **The accessibility design here is deliberate and should not be "fixed".**
 * In entry mode the digit cells are hidden from screen readers and the hidden
 * input announces *how many* digits have been entered, never which. Both things
 * typed into this component are secrets, and a screen reader reads aloud: a
 * rider entering a PIN is standing at a checkpoint beside the student and
 * whoever else is waiting, so speaking the digits would defeat the point of
 * having a PIN. Progress without disclosure — "3 of 6 digits entered" — is what
 * the user needs and says nothing an eavesdropper can use.
 *
 * The distinction is entry vs display: a non-editable instance is showing
 * somebody their *own* code, and a blind user has to be able to hear it, so
 * those cells stay readable.
 *
 * v6 pass: the active cell was a solid green fill with a lime numeral, which
 * put lime on text — the one thing the palette forbids. It is now an ink ring
 * on white, which marks position by border weight rather than by fill.
 * `min-h` rather than a fixed height so a large OS text size grows the cell
 * instead of clipping the digit (1.4.4).
 */
export function CodeInput({
  length = 6,
  value,
  onChangeText,
  state = "default",
  editable = true,
  onPressCapture,
  accessibilityLabel,
}: CodeInputProps) {
  const cells = Array.from({ length }, (_, i) => value[i] ?? "");

  return (
    <View className="relative flex-row gap-2.5">
      {cells.map((digit, index) => {
        const isActive = editable && index === value.length && state === "default";

        let cellClass = "border border-hairline bg-surface";
        let textClass = "text-ink";
        if (state === "error") {
          cellClass = "border border-danger bg-danger-bg";
          textClass = "text-danger";
        } else if (isActive) {
          cellClass = "border-2 border-ink bg-surface";
        }

        return (
          <View
            key={index}
            className={`min-h-[58px] flex-1 items-center justify-center rounded-input py-2 ${cellClass}`}
            // Purely visual while typing — the input below carries the
            // accessible state. Both props are needed: the first is iOS, the
            // second Android.
            accessibilityElementsHidden={editable}
            importantForAccessibility={editable ? "no-hide-descendants" : "auto"}
          >
            <Text className={`font-sans-semibold text-heading ${textClass}`}>{digit}</Text>
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
            accessibilityLabel={accessibilityLabel ?? `${length}-digit code`}
            accessibilityValue={{ text: `${value.length} of ${length} digits entered` }}
            accessibilityHint="Enter the code you were sent"
            // Announced without focus moving, so the count is spoken as the
            // user types rather than only when they navigate back to the field.
            accessibilityLiveRegion="polite"
            aria-invalid={state === "error" ? true : undefined}
          />
        </Pressable>
      ) : null}
    </View>
  );
}
