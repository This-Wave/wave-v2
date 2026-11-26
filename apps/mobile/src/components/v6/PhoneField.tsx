import { Text, TextInput, View } from "react-native";
import { useId, useState } from "react";
import { normalizeGhanaLocalDigits } from "@wave/shared";
import { colors } from "../../theme/tokens";

interface PhoneFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Shown above the well and used as the input's accessible name. */
  label?: string;
  error?: string | null;
}

/**
 * Ghana phone entry. One well with the +233 prefix set inline as muted text
 * rather than as a separate country chip — there is only one country here, so a
 * picker would be a control that can never be used.
 *
 * Three fixes on the way over from v5:
 *
 * - The placeholder was `colors.faint` (#c1c1c1, 1.80:1). Placeholders are text
 *   and owe 4.5:1, so it is `muted` now. This was the same defect the Phase 1
 *   sweep fixed everywhere else and missed here, because that pass searched for
 *   `colors.subtle` and this file spells the identical colour `faint`.
 * - The input had no accessible name at all. A screen reader landed on it and
 *   said "text field" — the visible "+233" is a sibling `Text`, not a label.
 * - Fixed `h-[52px]` became a minimum, so the number still fits at a large OS
 *   text size instead of clipping (1.4.4).
 */
export function PhoneField({
  value,
  onChangeText,
  placeholder = "54 321 0000",
  label,
  error,
}: PhoneFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label ? (
        <Text nativeID={`${id}-label`} className="mb-2 font-sans-bold text-body text-ink">
          {label}
        </Text>
      ) : null}
      {/* v7 canvas: the country code in its own box, the number beside it. */}
      <View className="flex-row" style={{ gap: 8 }}>
        <View className="min-h-[56px] w-[88px] items-center justify-center rounded-input border-2 border-line bg-surface">
          <Text className="font-sans-bold text-ui text-ink">+233</Text>
        </View>
        <TextInput
          value={groupDigits(value)}
          onChangeText={(text) => onChangeText(normalizeGhanaLocalDigits(text))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder ?? "24 123 4567"}
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          accessibilityLabel={label ?? "Phone number"}
          // The prefix is on screen but not in the field, so a screen-reader
          // user has no way to know the number they type is missing it.
          accessibilityHint="Ghana number without the country code"
          aria-labelledby={label ? `${id}-label` : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
          className={`min-h-[56px] flex-1 rounded-input border-2 bg-surface px-4 font-sans-medium text-ui text-ink ${
            error ? "border-danger" : focused ? "border-ink" : "border-line"
          }`}
          style={{ outlineStyle: "none" } as object}
        />
      </View>
      {error ? (
        <Text
          nativeID={`${id}-error`}
          accessibilityLiveRegion="polite"
          role="alert"
          className="mt-1.5 font-sans text-meta text-danger"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** "241234567" → "24 123 4567", as the canvas shows a Ghana number. */
function groupDigits(d: string): string {
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5)].filter(Boolean).join(" ");
}
