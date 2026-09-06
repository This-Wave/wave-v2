import { Pressable, View } from "react-native";

interface SwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Blocks input while a change is in flight, so a double-tap cannot race itself. */
  disabled?: boolean;
  /**
   * Required in practice: the track is a shape with no text in it, so without
   * this a screen reader announces "switch, on" and never says what is on.
   */
  accessibilityLabel: string;
  /** Describes the consequence where the label alone leaves it ambiguous. */
  accessibilityHint?: string;
}

/**
 * On/off switch. Ink track when on — not lime: this reads as state rather than
 * as an action, and the accent is reserved for things you press to make
 * something happen.
 *
 * Both states have to survive 1.4.11, which is easy to get wrong here. The
 * obvious off state is a pale track with a white knob, and that puts white on
 * #ebebeb at 1.1:1 — the knob disappears and the control reads as an empty
 * capsule. So off is an outlined track with an ink-grey knob (5.4:1 on white)
 * and on is an ink track with a white knob (15.6:1). Position carries the state
 * as well as fill, so neither is colour alone.
 *
 * The track is 44x26, which clears 2.5.8's 24px minimum on its short edge but
 * only just, and a switch is usually the smallest control on a settings screen.
 * `hitSlop` opens the tappable area to a full 44 square without changing the
 * drawing — the criterion measures the target, not the paint.
 */
export function Switch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: SwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ checked: value, disabled }}
      // React Native Web renders role="switch" but does not derive aria-checked
      // from accessibilityState, so the switch shipped as a role with its
      // required attribute missing — axe rates that critical, and a screen
      // reader announces "switch" with no on/off at all. RN 0.71+ accepts these
      // ARIA props natively too, so this is not a web-only shim.
      aria-checked={value}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={{ top: 9, bottom: 9, left: 0, right: 0 }}
      style={disabled ? { opacity: 0.5 } : undefined}
      className={`h-[26px] w-[44px] justify-center rounded-pill px-0.5 ${
        value ? "bg-ink" : "border border-muted bg-surface"
      }`}
    >
      <View
        className={`h-5 w-5 rounded-pill ${value ? "ml-auto bg-surface" : "ml-0 bg-muted"}`}
      />
    </Pressable>
  );
}
