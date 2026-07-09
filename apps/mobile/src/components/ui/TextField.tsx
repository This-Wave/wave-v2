import { Pressable, Text, TextInput, View } from "react-native";
import { ChevronDown } from "lucide-react-native";

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  mono?: boolean;
  editable?: boolean;
  selectable?: boolean;
  onPress?: () => void;
  focused?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  maxLength,
  mono,
  editable = true,
  selectable = false,
  onPress,
  focused,
}: TextFieldProps) {
  const borderClass = focused || value ? "border-wave-500 border-[1.5px]" : "border-border border-[1.5px]";

  if (selectable) {
    return (
      <View>
        {label ? <Text className="mb-1.5 font-sans-semibold text-xs text-text-secondary">{label}</Text> : null}
        <Pressable onPress={onPress} className={`flex-row items-center justify-between rounded-well px-3.5 py-3.5 ${borderClass}`}>
          <Text className="font-sans-medium text-[15px] text-ink">{value}</Text>
          <ChevronDown size={16} color="#9E9E9E" />
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      {label ? <Text className="mb-1.5 font-sans-semibold text-xs text-text-secondary">{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#BDBDBD"
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
        className={`rounded-well px-3.5 py-3.5 text-[15px] text-ink ${borderClass} ${mono ? "font-mono" : "font-sans"}`}
        style={multiline ? { minHeight: 96, textAlignVertical: "top" } : undefined}
      />
      {maxLength ? (
        <Text className="mt-1 text-right text-[11px] text-muted">
          {value.length} / {maxLength}
        </Text>
      ) : null}
    </View>
  );
}
