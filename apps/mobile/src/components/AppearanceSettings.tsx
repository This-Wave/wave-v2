import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SettingsGroup } from "./v6";
import { ContrastIcon } from "./icons";
import { colors } from "../theme/tokens";
import { canTheme, useThemeStore, type ThemeMode } from "../store/themeStore";

/**
 * Profile → Appearance: Light, Dark or System. PLAN-THEMES.md §3.
 *
 * Renders nothing on native — those builds cannot change colour at runtime yet.
 */
export function AppearanceSettings() {
  const { mode, setMode } = useThemeStore();
  if (!canTheme) return null;

  return (
    <SettingsGroup title="Appearance">
      <ChoiceRow
        icon={<ContrastIcon size={18} color={colors.ink} />}
        label="Theme"
        options={[
          ["light", "Light"],
          ["dark", "Dark"],
          ["system", "System"],
        ]}
        value={mode}
        onChange={(v) => setMode(v as ThemeMode)}
        last
      />
    </SettingsGroup>
  );
}

function ChoiceRow({
  icon,
  label,
  options,
  value,
  onChange,
  last,
}: {
  icon: ReactNode;
  label: string;
  options: [string, string][];
  value: string;
  onChange: (value: string) => void;
  last?: boolean;
}) {
  return (
    <View className={`gap-3 px-4 py-3.5 ${last ? "" : "border-b border-hairline"}`}>
      <View className="flex-row items-center gap-3.5">
        <View className="h-9 w-9 items-center justify-center rounded-input bg-lime-faint">{icon}</View>
        <Text className="font-sans-medium text-ui text-ink">{label}</Text>
      </View>
      <View className="flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map(([key, text]) => {
          const selected = key === value;
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              className={`min-h-[44px] flex-1 items-center justify-center rounded-pill px-3 ${
                selected ? "bg-ink" : "border border-hairline bg-canvas"
              }`}
            >
              <Text className={`font-sans-medium text-body ${selected ? "text-on-ink" : "text-ink"}`}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
