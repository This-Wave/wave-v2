import { TextInput, View } from "react-native";
import { SearchIcon } from "../icons";
import { colors } from "../../theme/tokens";

interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

// v5 screen 14: 44px tall, white fill, hairline border, 18px radius.
export function SearchBar({ value, onChangeText, placeholder = "Search shops or items" }: SearchBarProps) {
  return (
    <View className="h-11 flex-row items-center gap-2.5 rounded-control border border-border bg-surface px-3.5">
      <SearchIcon />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        className="h-11 flex-1 text-[14px] text-ink"
      />
    </View>
  );
}
