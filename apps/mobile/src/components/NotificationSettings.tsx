import { Pressable, Text, View } from "react-native";
import { SettingsGroup, SettingsRow, Switch } from "./v6";
import { BellIcon } from "./icons";
import { colors } from "../theme/tokens";
import { useWebPush } from "../hooks/useWebPush";

const ADD_TO_HOME = "On iPhone, add Wave to your Home Screen first: tap Share, then Add to Home Screen.";

/** The Notifications group on Profile. Web only; renders nothing elsewhere. */
export function NotificationSettings() {
  const { state, busy, error, turnOn, turnOff } = useWebPush();
  if (state === null || state === "unsupported") return null;

  const icon = <BellIcon size={18} color={colors.ink} strokeWidth={1.8} />;
  const value =
    state === "needs-install"
      ? ADD_TO_HOME
      : state === "blocked"
        ? "Blocked for this site. Allow notifications in your browser settings."
        : (error ?? "When your order is paid, on its way and at the checkpoint");

  const toggleable = state === "on" || state === "off";
  return (
    <SettingsGroup title="Notifications">
      <SettingsRow
        icon={icon}
        label="Order updates"
        value={value}
        chevron={false}
        trailing={
          toggleable ? (
            <Switch
              value={state === "on"}
              disabled={busy}
              accessibilityLabel="Order update notifications"
              onValueChange={(next) => (next ? turnOn() : turnOff())}
            />
          ) : undefined
        }
        last
      />
    </SettingsGroup>
  );
}

/**
 * The ask at the moment it makes sense: an order was just placed. Sits on the
 * ink order-confirmed screen. Hidden once on, blocked, or impossible.
 */
export function NotificationPrompt() {
  const { state, busy, error, turnOn } = useWebPush();
  if (state !== "off" && state !== "needs-install") return null;

  // v7 canvas "Turn on delivery updates": a plain card on white (the v6
  // version was white text for a dark panel, which vanished on v7's white).
  return (
    <View className="mt-6 items-center rounded-card border border-hairline bg-surface p-5" style={{ gap: 10 }}>
      <View className="h-14 w-14 items-center justify-center rounded-pill bg-lime">
        <BellIcon size={24} color={colors.onLime} strokeWidth={2} />
      </View>
      <Text className="text-center font-display text-subheading text-ink">Turn on delivery updates</Text>
      <Text className="text-center font-sans text-body text-muted">
        {state === "needs-install" ? ADD_TO_HOME : (error ?? "On the way, at your checkpoint, collected.")}
      </Text>
      {state === "off" ? (
        <Pressable
          onPress={turnOn}
          disabled={busy}
          accessibilityRole="button"
          className="mt-1 min-h-[44px] items-center justify-center self-stretch rounded-input border-b-4 border-lime-edge bg-lime px-5 active:opacity-80"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Text className="font-sans-bold text-meta uppercase tracking-wider text-on-lime">{busy ? "Turning on" : "Turn on"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
