import { Text, View } from "react-native";
import { UserIcon } from "../icons";
import { colors } from "../../theme/tokens";

interface AvatarProps {
  initials?: string;
  size?: number;
}

// v5: solid green square, 18–20px radius, lime initials.
export function Avatar({ initials, size = 40 }: AvatarProps) {
  return (
    <View
      className="items-center justify-center bg-wave-500"
      style={{ width: size, height: size, borderRadius: size >= 56 ? 20 : 18 }}
    >
      {initials ? (
        <Text className="font-sans-semibold" style={{ fontSize: size * 0.33, color: colors.lime }}>
          {initials}
        </Text>
      ) : (
        <UserIcon size={size * 0.45} color={colors.lime} strokeWidth={1.8} />
      )}
    </View>
  );
}
