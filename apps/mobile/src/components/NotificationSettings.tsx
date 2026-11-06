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

  return (
    <View className="mt-6 rounded-card p-4" style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" }}>
      <Text className="mb-1 font-sans-semibold text-ui text-white">Know when it moves</Text>
      <Text className="font-sans text-body text-white" style={{ opacity: 0.85 }}>
        {state === "needs-install"
          ? ADD_TO_HOME
          : (error ?? "Get a notification when a rider takes your order and when it reaches your checkpoint.")}
      </Text>
      {state === "off" ? (
        <Pressable
          onPress={turnOn}
          disabled={busy}
          accessibilityRole="button"
          className="mt-3 min-h-[44px] items-center justify-center self-start rounded-pill px-5 active:opacity-80"
          style={{ borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)", opacity: busy ? 0.6 : 1 }}
        >
          <Text className="font-sans-medium text-ui text-white">{busy ? "Turning on…" : "Turn on notifications"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
