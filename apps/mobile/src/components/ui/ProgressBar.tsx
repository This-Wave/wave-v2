import { View } from "react-native";

export function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View className="h-2 rounded-pill bg-border">
      <View className="h-2 rounded-pill bg-wave-500" style={{ width: `${pct}%` }} />
    </View>
  );
}
