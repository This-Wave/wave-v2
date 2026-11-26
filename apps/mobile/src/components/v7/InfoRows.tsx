import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

/**
 * v7 canvas label/value row (You, rider profile, job detail): the label in
 * muted on the left, the value in bold ink on the right, a hairline under it.
 */
export function InfoRow({
  label,
  value,
  onPress,
  trailing,
  last,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
  trailing?: ReactNode;
  last?: boolean;
}) {
  const body = (
    <View
      className={`min-h-[52px] flex-row items-center justify-between py-3 ${last ? "" : "border-b border-hairline"}`}
      style={{ gap: 12 }}
    >
      <Text className="font-sans text-ui text-muted">{label}</Text>
      {trailing ?? (
        <Text className="flex-shrink text-right font-sans-bold text-ui text-ink" numberOfLines={2}>
          {value ?? "—"}
        </Text>
      )}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}${value ? `, ${value}` : ""}`}>
      {body}
    </Pressable>
  );
}

/** v7 canvas text link under a list: green for a way forward, muted for sign out. */
export function TextLink({ label, onPress, tone = "link" }: { label: string; onPress: () => void; tone?: "link" | "muted" | "danger" }) {
  const color = tone === "link" ? "text-link" : tone === "danger" ? "text-danger" : "text-ink-700";
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} className="min-h-[40px] justify-center self-start">
      <Text className={`font-sans-bold text-ui ${color}`}>{label}</Text>
    </Pressable>
  );
}

/** "+233241234567" → "024 123 4567", the way Ghanaians write a number. */
export function localPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  const local = d.startsWith("233") ? `0${d.slice(3)}` : d;
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : phone;
}
