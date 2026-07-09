import { Text, View } from "react-native";
import { User } from "lucide-react-native";

interface AvatarProps {
  initials?: string;
  size?: number;
}

export function Avatar({ initials, size = 40 }: AvatarProps) {
  return (
    <View
      className="items-center justify-center rounded-full bg-wave-500"
      style={{ width: size, height: size }}
    >
      {initials ? (
        <Text className="font-sans-extrabold text-white" style={{ fontSize: size * 0.36 }}>
          {initials}
        </Text>
      ) : (
        <User size={size * 0.5} color="#fff" />
      )}
    </View>
  );
}
