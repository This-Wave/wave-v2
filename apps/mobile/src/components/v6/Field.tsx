import { TextInput, Text, View } from "react-native";
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
  return (
    <View>
      {label ? (
        <Text className="mb-2 font-sans-medium text-body text-ink">{label}</Text>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        multiline={multiline}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        maxLength={maxLength}
        textAlignVertical={multiline ? "top" : "center"}
        className={`rounded-input border bg-surface px-4 font-sans text-body text-ink ${
          error ? "border-danger" : "border-hairline"
        } ${multiline ? "min-h-[112px] py-3" : "h-12"}`}
      />
      {error ? (
        <Text className="mt-1.5 font-sans text-meta text-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-1.5 font-sans text-meta text-muted">{hint}</Text>
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
}: {
  value: string;
  onChangeText: (v: string) => void;
  prefix?: string;
  placeholder?: string;
}) {
  return (
    <View className="flex-row items-baseline justify-center gap-1">
      {prefix ? <Text className="font-sans-medium text-heading-sm text-muted">{prefix}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        keyboardType="numeric"
        className="min-w-[120px] font-sans-bold text-heading text-ink"
      />
    </View>
  );
}
