import { TextInput, View } from "react-native";
import { Search } from "lucide-react-native";

interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChangeText, placeholder = "Search..." }: SearchBarProps) {
  return (
    <View className="flex-row items-center gap-2 rounded-well border border-border bg-surface-muted px-3.5 py-2.5">
      <Search size={16} color="#9E9E9E" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#BDBDBD"
        className="flex-1 text-[14px] text-ink"
      />
    </View>
  );
}
