import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Linking, Platform, Pressable, Text, View } from "react-native";
import { PhoneIcon } from "./icons";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { colors } from "../theme/tokens";
import { maskMomoNumber, MOMO_NETWORKS, type MomoNetwork } from "../lib/momo";

/**
 * "Approve on your phone": canvas board 10. The MoMo prompt is on the
 * student's phone and the parent screen is polling; nothing here can be
 * pressed except a fallback and a way out (no lime button on purpose).
 *
 * The ring turns slowly under reduced motion rather than stopping, so the
 * screen still reads as live.
 */
export function MomoApprove({
  amountLabel,
  network,
  payer,
  onPayAnotherWay,
  seconds = 120,
}: {
  amountLabel: string;
  network: MomoNetwork;
  payer: string;
  onPayAnotherWay: () => void;
  /** How long the prompt stays live, for the countdown. */
  seconds?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== "web" }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduce]);
  const tilt = pulse.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] });

  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((n) => Math.max(n - 1, 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const net = MOMO_NETWORKS.find((n) => n.id === network) ?? MOMO_NETWORKS[0]!;
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <View className="flex-1 px-gutter pb-8">
      <View className="flex-1 items-center justify-center" style={{ gap: 14 }}>
        <View className="h-24 w-24 items-center justify-center rounded-pill bg-wash">
          <Animated.View style={{ transform: [{ rotate: tilt }] }}>
            <PhoneIcon size={36} color={colors.ink} strokeWidth={1.9} />
          </Animated.View>
        </View>
        <View className="items-center" style={{ gap: 8 }} accessibilityLiveRegion="polite">
          <Text accessibilityRole="header" className="text-center font-display text-heading text-ink">
            Approve on your phone
          </Text>
          <Text className="text-center font-sans text-ui text-muted">
            Check {maskMomoNumber(payer)} for the {net.label} MoMo prompt and enter your PIN to pay {amountLabel}.
          </Text>
          <Text
            className="mt-2 font-display text-ink"
            style={{ fontSize: 36, lineHeight: 40 }}
            accessibilityLabel={left > 0 ? `${clock} left` : "Still waiting"}
          >
            {clock}
          </Text>
          <Text className="font-sans text-body text-muted">{left > 0 ? "Waiting for MoMo…" : "Still waiting for MoMo…"}</Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openURL(`tel:${encodeURIComponent(net.ussd)}`).catch(() => undefined)}
          className="min-h-[56px] items-center justify-center rounded-input border-2 border-b-4 border-line bg-surface"
        >
          <Text className="font-sans-bold text-ui uppercase tracking-wider text-ink">I didn't get a prompt</Text>
        </Pressable>
        <Text className="text-center font-sans text-meta text-muted">Opens {net.ussd} to approve it yourself.</Text>
        <Pressable accessibilityRole="button" onPress={onPayAnotherWay} className="min-h-[44px] items-center justify-center">
          <Text className="font-sans-bold text-ui text-ink-700">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
