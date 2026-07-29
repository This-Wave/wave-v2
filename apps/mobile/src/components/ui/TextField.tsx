import { Pressable, Text, TextInput, View } from "react-native";
import { FieldLabel } from "./FieldLabel";
import { ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** Taller multiline well (the "Notes for your runner" field on screen 05). */
  compactMultiline?: boolean;
  maxLength?: number;
  mono?: boolean;
  editable?: boolean;
  selectable?: boolean;
  onPress?: () => void;
  keyboardType?: "default" | "number-pad" | "email-address" | "phone-pad";
  accent?: boolean;
}

// v5 input: 52px tall, 18px radius, white fill, hairline border. No focus ring —
// the border stays #DCE8D3 in every state.
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  compactMultiline,
  maxLength,
  mono,
  editable = true,
  selectable = false,
  onPress,
  keyboardType = "default",
  accent,
}: TextFieldProps) {
  if (selectable) {
    return (
      <View>
        {label ? <FieldLabel>{label}</FieldLabel> : null}
        <Pressable
          onPress={onPress}
          className="h-[52px] flex-row items-center justify-between rounded-control border border-border bg-surface px-4"
        >
          <Text className="font-sans-medium text-[15px] text-ink">{value}</Text>
          <ChevronRightIcon size={12} color={colors.muted} strokeWidth={2} />
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        keyboardType={keyboardType}
        className={`rounded-control border border-border bg-surface px-4 text-[15px] leading-[22px] ${
          accent ? "font-sans-semibold text-wave-500" : "font-sans-medium text-ink"
        } ${mono ? "font-mono" : ""} ${multiline ? "py-3.5" : "h-[52px] py-0"}`}
        style={
          multiline
            ? { minHeight: compactMultiline ? 76 : 88, textAlignVertical: "top" }
            : undefined
        }
      />
      {maxLength ? (
        <Text className="mt-1.5 text-right text-[11px] text-faint">
          {value.length} / {maxLength}
        </Text>
      ) : null}
    </View>
  );
}
