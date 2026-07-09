import { Pressable, Text, View } from "react-native";
import { ArrowRight, type LucideIcon } from "lucide-react-native";

interface ServiceCardProps {
  icon: LucideIcon;
  iconBgClass: string;
  iconColor: string;
  title: string;
  description: string;
  actionLabel: string;
  onPress?: () => void;
}

export function ServiceCard({ icon: Icon, iconBgClass, iconColor, title, description, actionLabel, onPress }: ServiceCardProps) {
  return (
    <Pressable onPress={onPress} className="flex-1 rounded-card border border-border bg-surface p-4 active:scale-[0.97]">
      <View className={`mb-2.5 h-10 w-10 items-center justify-center rounded-well ${iconBgClass}`}>
        <Icon size={20} color={iconColor} strokeWidth={2} />
      </View>
      <Text className="mb-0.5 font-sans-bold text-[14px] text-ink">{title}</Text>
      <Text className="text-[11px] leading-4 text-muted">{description}</Text>
      <View className="mt-2.5 flex-row items-center gap-1">
        <Text className="font-sans-semibold text-[10px]" style={{ color: iconColor }}>
          {actionLabel}
        </Text>
        <ArrowRight size={10} color={iconColor} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}
