import { useEffect, useRef } from "react";
import { Animated, Easing, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../../theme/tokens";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import { CheckIcon } from "../icons";

/** Six digits as "730 256". */
export function formatCode(pin: string): string {
  const d = pin.replace(/\D/g, "");
  return d.length === 6 ? `${d.slice(0, 3)} ${d.slice(3)}` : d;
}

/**
 * v7 code ticket: the six-digit collection code on a wash ticket with two
 * notches, dropping in once. The peak moment of every order (peak-end).
 */
export function CodeTicket({ pin, caption = "Your code", note, large }: { pin?: string | null; caption?: string; note?: string; large?: boolean }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (!pin || reduced) {
      v.setValue(1);
      return;
    }
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }, [pin, reduced, v]);
  return (
    <View className="items-center rounded-card bg-wash px-5 py-6" style={{ overflow: "hidden" }}>
      <View className="absolute -left-3 top-1/2 h-6 w-6 rounded-pill bg-canvas" style={{ marginTop: -12 }} />
      <View className="absolute -right-3 top-1/2 h-6 w-6 rounded-pill bg-canvas" style={{ marginTop: -12 }} />
      <Text className="font-sans-bold text-meta text-ink-700">{caption}</Text>
      <Animated.Text
        accessibilityLabel={pin ? `Code ${pin.split("").join(" ")}` : "Code loading"}
        className="font-display text-ink"
        style={{
          fontSize: large ? 56 : 46,
          letterSpacing: 4,
          marginTop: 4,
          fontVariant: ["tabular-nums"],
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
        }}
      >
        {pin ? formatCode(pin) : "··· ···"}
      </Animated.Text>
      {note ? <Text className="mt-1 font-sans text-meta text-muted">{note}</Text> : null}
    </View>
  );
}

/**
 * v7 route: pickup pin, a wave line, your pin. `progress` (0-1) fills the
 * line in lime; dashes flow along it while the order moves.
 */
export function RouteLine({
  fromLabel,
  from,
  fromSub,
  toLabel,
  to,
  toSub,
  progress,
}: {
  fromLabel: string;
  from: string;
  fromSub?: string | null;
  toLabel: string;
  to: string;
  toSub?: string | null;
  progress?: number;
}) {
  const reduced = useReducedMotion();
  const dash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced || progress === undefined || progress >= 1) return;
    const loop = Animated.loop(Animated.timing(dash, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [dash, progress, reduced]);
  const AnimatedPath = Animated.createAnimatedComponent(Path);
  const d = "M12 6 q-6 9 0 18 t0 18 t0 18";
  return (
    <View className="flex-row" style={{ gap: 14 }}>
      <View className="items-center">
        <Pin color={colors.ink} />
        <Svg width={24} height={60} viewBox="0 0 24 60">
          <Path d={d} fill="none" stroke={colors.line} strokeWidth={4} strokeLinecap="round" />
          {progress !== undefined ? (
            <Path d={d} fill="none" stroke={colors.lime} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${Math.round(progress * 60)} 100`} />
          ) : null}
          {progress !== undefined && progress < 1 ? (
            <AnimatedPath d={d} fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeDasharray="1 9" strokeDashoffset={dash.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) as unknown as number} />
          ) : null}
        </Svg>
        <Pin color={colors.lime} />
      </View>
      <View className="flex-1 justify-between">
        <View>
          <Text className="font-sans-bold text-caption text-muted">{fromLabel}</Text>
          <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>{from}</Text>
          {fromSub ? <Text className="font-sans text-meta text-muted" numberOfLines={2}>{fromSub}</Text> : null}
        </View>
        <View>
          <Text className="font-sans-bold text-caption text-muted">{toLabel}</Text>
          <Text className="font-sans-bold text-ui text-ink" numberOfLines={1}>{to}</Text>
          {toSub ? <Text className="font-sans text-meta text-muted">{toSub}</Text> : null}
        </View>
      </View>
    </View>
  );
}

function Pin({ color }: { color: string }) {
  return (
    <Svg width={24} height={28} viewBox="6.5 3 35 42">
      <Path d="M24 3c-9.6 0-17.5 7.6-17.5 17C6.5 33 24 45 24 45s17.5-12 17.5-25C41.5 10.6 33.6 3 24 3z" fill={color} />
      <Circle cx={24} cy={20} r={6} fill="#ffffff" />
    </Svg>
  );
}

/** v7 vertical tracker: done stops are lime with a tick, the line fills as it goes. */
export function Tracker({ steps }: { steps: { label: string; time?: string | null; done: boolean }[] }) {
  return (
    <View accessibilityRole="list">
      {steps.map((s, i) => (
        <View key={s.label} className="flex-row" style={{ gap: 14, paddingBottom: i === steps.length - 1 ? 0 : 16 }} accessibilityLabel={`${s.label}${s.done ? ", done" : ""}`}>
          <View className="items-center">
            <View className={`h-6 w-6 items-center justify-center rounded-pill border-2 ${s.done ? "border-lime bg-lime" : "border-line bg-surface"}`}>
              {s.done ? <CheckIcon size={14} color={colors.onLime} strokeWidth={3} /> : null}
            </View>
            {i < steps.length - 1 ? (
              <View className={`absolute w-0.5 ${s.done && steps[i + 1]?.done ? "bg-lime" : "bg-hairline"}`} style={{ top: 26, bottom: -16 }} />
            ) : null}
          </View>
          <View className="flex-1 flex-row items-center justify-between">
            <Text className={`${s.done ? "font-sans-bold text-ink" : "font-sans text-muted"} text-body`}>{s.label}</Text>
            {s.time ? <Text className="font-sans text-meta text-muted">{s.time}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
