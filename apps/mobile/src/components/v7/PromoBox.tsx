import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/tokens";
import { GiftIcon } from "../icons";

/**
 * "Got a code?" at the end of Send. Collapsed to a link until tapped, so the
 * review stays short for everyone without one (most people, most days).
 */
export function PromoBox({
  applied,
  error,
  busy,
  onApply,
  onRemove,
  note,
}: {
  applied: { code: string; pct: number } | null;
  error: string | null;
  busy: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
  /** Shown under an applied code, e.g. "Applied when you sign in". */
  note?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  if (applied) {
    return (
      <View className="flex-row items-center rounded-card bg-wash p-4" style={{ gap: 12 }}>
        <GiftIcon size={22} color={colors.ink} strokeWidth={1.9} />
        <View className="flex-1">
          <Text className="font-sans-bold text-body text-ink">
            {applied.code} · {applied.pct}% off delivery
          </Text>
          {note ? <Text className="font-sans text-meta text-ink-700">{note}</Text> : null}
        </View>
        <Text accessibilityRole="button" onPress={onRemove} className="font-sans-bold text-body text-link">
          Remove
        </Text>
      </View>
    );
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" className="min-h-[40px] justify-center self-start">
        <Text className="font-sans-bold text-body text-link">Got a code?</Text>
      </Pressable>
    );
  }

  return (
    <View>
      <View className="flex-row" style={{ gap: 8 }}>
        <TextInput
          value={value}
          onChangeText={(t) => setValue(t.toUpperCase())}
          placeholder="HELLOHILL"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          accessibilityLabel="Promo code"
          onSubmitEditing={() => value.trim() && onApply(value)}
          className={`min-h-[48px] flex-1 rounded-input border-2 bg-surface px-4 font-sans-bold text-ui text-ink ${error ? "border-danger" : "border-line"}`}
          style={{ outlineStyle: "none" } as object}
        />
        <Pressable
          onPress={() => value.trim() && onApply(value)}
          disabled={busy || !value.trim()}
          accessibilityRole="button"
          className={`min-h-[48px] justify-center rounded-input border-2 border-b-4 border-line bg-surface px-4 ${busy || !value.trim() ? "opacity-50" : ""}`}
        >
          <Text className="font-sans-bold text-meta uppercase tracking-wider text-ink">{busy ? "Checking" : "Apply"}</Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" className="mt-1.5 font-sans text-meta text-danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
