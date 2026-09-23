import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRightIcon } from "../icons";
import { colors } from "../../theme/tokens";

/**
 * A titled group of settings rows: a small label on the canvas, then one white
 * card holding the rows.
 *
 * The screens this replaces gave every setting a card of its own — three
 * separate cards, each with a title, a subtitle and a chevron, stacked with a
 * gap between them. That reads as three announcements rather than one list, and
 * it cost about twice the height per row. Grouping them under a label is the
 * pattern people already know from their phone's own settings, which is the
 * right thing to borrow for a screen nobody wants to spend time learning.
 *
 * The label sits outside the card, in `muted`, because it names the group
 * rather than belonging to it.
 */
export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 px-1 font-sans-medium text-meta uppercase text-muted">{title}</Text>
      <View className="overflow-hidden rounded-card bg-surface">{children}</View>
    </View>
  );
}

/**
 * One row: an icon, a label, an optional value or control, and a chevron when
 * it leads somewhere.
 *
 * `last` suppresses the divider rather than a parent drawing dividers between
 * children, because these rows are usually written out one by one and
 * conditionally — a rider's rows differ from a student's — so there is no
 * reliable child count to key off.
 */
export function SettingsRow({
  icon,
  label,
  value,
  trailing,
  onPress,
  last,
  danger,
  chevron = true,
}: {
  icon: ReactNode;
  label: string;
  /** Secondary line under the label — what the setting currently is. */
  value?: string;
  /** A control instead of a chevron, e.g. a switch. Suppresses the chevron. */
  trailing?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  /** Sign out, delete account: the label turns red, the icon disc does not. */
  danger?: boolean;
  /**
   * Off for a row that acts in place rather than navigating — logging out opens
   * a confirm sheet, it does not go anywhere, and an arrow pointing nowhere is
   * a promise the row cannot keep.
   */
  chevron?: boolean;
}) {
  const body = (
    <View
      className={`flex-row items-center gap-3.5 px-4 py-3.5 ${
        last ? "" : "border-b border-hairline"
      }`}
    >
      {/* `input` radius on a 36pt square — the reference's rounded-square
          glyph holder. `lime-faint` rather than lime: a column of solid accent
          discs turns a settings list into a christmas tree. */}
      <View className="h-9 w-9 items-center justify-center rounded-input bg-lime-faint">
        {icon}
      </View>

      <View className="min-w-0 flex-1">
        <Text
          className={`font-sans-medium text-ui ${danger ? "text-danger" : "text-ink"}`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {value ? (
          <Text className="font-sans text-body text-muted" numberOfLines={2}>
            {value}
          </Text>
        ) : null}
      </View>

      {trailing ?? (onPress && chevron ? <ChevronRightIcon size={18} color={colors.icon} strokeWidth={2} /> : null)}
    </View>
  );

  // A row with a switch in it is not itself a control — the switch is. Wrapping
  // it in a Pressable would give a screen reader two overlapping targets for
  // one setting.
  if (!onPress) return body;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} className="active:bg-canvas">
      {body}
    </Pressable>
  );
}
