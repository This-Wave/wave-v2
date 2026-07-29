import { Pressable, Text, View } from "react-native";
import type { ReactNode } from "react";
import { CheckIcon } from "../icons";
import { colors } from "../../theme/tokens";

interface SelectRowProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  selected: boolean;
  onPress?: () => void;
  /** Solid-green selected treatment (time slots, screen 07) vs. checkbox (screen 15). */
  fill?: boolean;
}

/**
 * The v5 selectable row. Screen 07 fills the whole row green when picked;
 * screen 15 keeps the row white and turns the trailing 22px checkbox green.
 */
export function SelectRow({ title, subtitle, leading, selected, onPress, fill }: SelectRowProps) {
  if (fill) {
    return (
      <Pressable
        onPress={onPress}
        className={`flex-row items-center justify-between rounded-control px-[18px] py-4 ${
          selected ? "border border-wave-500 bg-wave-500" : "border border-border bg-surface"
        }`}
      >
        <View>
          <Text className={`font-sans-semibold text-[15px] ${selected ? "text-white" : "text-ink"}`}>{title}</Text>
          {subtitle ? (
            <Text className="text-[12px]" style={selected ? { color: "rgba(255,255,255,0.7)" } : { color: colors.muted }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {selected ? (
          <View className="h-[22px] w-[22px] items-center justify-center rounded-chip bg-wave-lime">
            <CheckIcon />
          </View>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-3.5 rounded-card bg-surface p-4 ${
        selected ? "border border-wave-500" : "border border-border"
      }`}
    >
      {leading}
      <View className="flex-1">
        <Text className="font-sans-semibold text-[15px] text-ink">{title}</Text>
        {subtitle ? <Text className="text-[12px] text-muted">{subtitle}</Text> : null}
      </View>
      <View
        className={`h-[22px] w-[22px] items-center justify-center rounded-check ${
          selected ? "bg-wave-500" : "border border-border"
        }`}
      >
        {selected ? <CheckIcon color={colors.white} /> : null}
      </View>
    </Pressable>
  );
}
