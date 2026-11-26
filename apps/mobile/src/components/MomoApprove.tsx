import { useEffect, useRef } from "react";
import { Animated, Easing, Linking, Platform, Pressable, Text, View } from "react-native";
import { MobileIcon } from "./icons";
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
}: {
  amountLabel: string;
  network: MomoNetwork;
  payer: string;
  onPayAnotherWay: () => void;
}) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const net = MOMO_NETWORKS.find((n) => n.id === network) ?? MOMO_NETWORKS[0]!;

  return (
    <View className="flex-1 px-gutter pb-8">
      <View className="flex-1 items-center justify-center gap-7">
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Waiting for you to approve the payment"
          className="h-[120px] w-[120px] items-center justify-center"
        >
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              borderRadius: 9999,
              borderWidth: 4,
              borderColor: colors.hairline,
              borderTopColor: colors.ink,
              transform: [{ rotate }],
            }}
          />
          <MobileIcon size={40} color={colors.ink} strokeWidth={1.8} />
        </View>
        <View className="items-center gap-2" accessibilityLiveRegion="polite">
          <Text className="text-center font-display text-heading text-ink">Approve on your phone</Text>
          <Text className="font-display text-ink" style={{ fontSize: 40, lineHeight: 44 }}>
            {amountLabel}
          </Text>
          <Text className="font-sans text-ui text-muted">
            {net.label} MoMo · {maskMomoNumber(payer)}
          </Text>
        </View>
      </View>

      <View className="items-center gap-1">
        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(`tel:${encodeURIComponent(net.ussd)}`).catch(() => undefined)}
          className="min-h-[44px] justify-center"
        >
          <Text className="font-sans-bold text-ui text-ink">No prompt? Dial {net.ussd}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onPayAnotherWay} className="min-h-[44px] justify-center">
          <Text className="font-sans-semibold text-ui text-muted">Pay another way</Text>
        </Pressable>
      </View>
    </View>
  );
}
