import { TextInput, Text, View } from "react-native";
import { useId } from "react";
import { colors } from "../../theme/tokens";

/**
 * Text input. White surface, hairline border, 8px radius — the reference's
 * input shape. The label sits above rather than floating: floating labels need
 * motion and a filled surface, neither of which this system has.
 */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  error,
  multiline,
  keyboardType = "default",
  autoFocus,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "decimal-pad" | "phone-pad" | "email-address";
  autoFocus?: boolean;
  maxLength?: number;
}) {
  // Web renders these to real `id`/`aria-*` attributes; native ignores them and
  // relies on the explicit accessibilityLabel/Hint below.
  const id = useId();
  const messageId = `${id}-message`;

  return (
    <View>
      {label ? (
        <Text nativeID={`${id}-label`} className="mb-2 font-sans-medium text-body text-ink">
          {label}
        </Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        // #c1c1c1 measured 1.80:1 on white. Placeholders are text, so they owe
        // 4.5:1 under 1.4.3 — `muted` is 5.41:1 on white, 5.05:1 on canvas.
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        accessibilityLabel={label || undefined}
        accessibilityHint={error ?? hint}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        aria-invalid={error ? true : undefined}
        // Was a fixed h-12: at large OS text sizes the label grew and the box
        // did not, clipping the value. 1.4.4.
        className={`rounded-input border bg-surface px-4 py-3 font-sans text-body text-ink ${
          error ? "border-danger" : "border-hairline"
        } ${multiline ? "min-h-[112px]" : "min-h-[48px]"}`}
      />
      {error ? (
        <Text
          nativeID={messageId}
          // The error appears without moving focus, so it has to announce
          // itself or a screen-reader user never learns the field is invalid.
          accessibilityLiveRegion="polite"
          role="alert"
          className="mt-1.5 font-sans text-meta text-danger"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text nativeID={messageId} className="mt-1.5 font-sans text-meta text-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Large single-purpose amount/number entry — used where the value is the whole
 * point of the screen and a boxed field would undersell it.
 */
export function BigNumberField({
  value,
  onChangeText,
  prefix,
  placeholder = "0.00",
  label,
}: {
  value: string;
  onChangeText: (v: string) => void;
  prefix?: string;
  placeholder?: string;
  /** Announced to screen readers, which cannot infer the amount's meaning
   *  from the surrounding heading the way a sighted reader does. */
  label?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-center gap-1">
      {prefix ? <Text className="font-sans-medium text-heading-sm text-muted">{prefix}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType="numeric"
        accessibilityLabel={label}
        className="min-w-[120px] font-sans-bold text-heading text-ink"
      />
    </View>
  );
}
