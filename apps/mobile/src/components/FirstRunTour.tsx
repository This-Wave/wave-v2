import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import type { SelfServeProfileRole } from "@wave/shared";
import { Button, Gutter } from "./v6";
import { useAuthStore } from "../store/authStore";
import { hasSeenTour, markTourSeen } from "../lib/onboarding";

/**
 * Three cards, once, on the first run of a role.
 *
 * Deliberately *after* sign-in rather than in front of it. The v6 redesign
 * removed a three-slide carousel from `WelcomeScreen` because it put taps
 * between a returning user and the phone field, and that objection was right —
 * so this is mounted inside each role's navigator, past every gate, where it is
 * only ever seen by an account that has just been created and can actually use
 * what it describes. A returning user never renders it.
 *
 * Each deck earns its place by covering the thing that role gets wrong when
 * nobody tells them: that Wave is scheduled rather than on-demand, that a rider
 * types the price they really paid, that a shop is invisible until approved.
 */
interface Card {
  title: string;
  body: string;
}

const DECKS: Record<SelfServeProfileRole, Card[]> = {
  student: [
    {
      title: "Wave runs on a schedule",
      body: "Wave isn't on-demand. Runs go out on Sundays and Wednesdays, and you order before the cutoff for the next one. Anything outside those days costs more.",
    },
    {
      title: "Ask for anything",
      body: "Order from a shop's list, or just describe what you want and a runner buys it at the till. On a described order you're charged what they actually paid.",
    },
    {
      title: "Your PIN ends the delivery",
      body: "When your order is confirmed you get a six-digit PIN. Give it to your runner only once your things are in your hands — it's how they prove they delivered.",
    },
  ],
  rider: [
    {
      title: "Take what you can carry",
      body: "The feed shows orders waiting for a runner. Accept one and it's yours — the student is told it's you, so only take what you'll actually finish.",
    },
    {
      title: "Type what you really paid",
      body: "On a shop run you enter the amount on the receipt, and the student is charged exactly that. Get it right the first time: it comes out of their money, not yours.",
    },
    {
      title: "The PIN closes it out",
      body: "At the checkpoint the student reads you a six-digit PIN. Entering it marks the order delivered and records your earnings for that run.",
    },
  ],
  shop_owner: [
    {
      title: "You're not live yet",
      body: "An admin checks every new shop before students can see it. Until then your storefront is hidden — but everything you set up now is ready for the moment it opens.",
    },
    {
      title: "Your menu is a promise",
      body: "Students order straight from your list, so mark anything out of stock. A runner turning up for something you don't have costs you the order and them the wait.",
    },
    {
      title: "Answer before the Wave closes",
      body: "Orders arrive ahead of each run. Accept what you can fulfil and flag what you can't, so a runner isn't sent for something that was never coming.",
    },
  ],
};

export function FirstRunTour({ role }: { role: SelfServeProfileRole }) {
  const profileId = useAuthStore((s) => s.profile?.id);
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    void hasSeenTour(profileId).then((seen) => {
      if (!cancelled && !seen) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  function dismiss() {
    setVisible(false);
    // Marked on dismissal rather than on open, so a crash mid-tour does not
    // silently consume someone's only showing of it.
    if (profileId) void markTourSeen(profileId);
  }

  const cards = DECKS[role];
  const card = cards[index];
  const isLast = index === cards.length - 1;

  if (!card) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={dismiss}>
      {/* Scrim and top radius copied from the `Sheet` primitive rather than
          re-invented — this is sheet-shaped, and a second, slightly different
          sheet is exactly the kind of drift a design system exists to stop. */}
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(8,52,0,0.45)" }}>
        <View
          className="bg-surface pb-8 pt-6"
          style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
        >
          <Gutter>
            <View className="mb-6 flex-row items-center justify-between">
              <View className="flex-row gap-1.5">
                {cards.map((c, i) => (
                  <View
                    key={c.title}
                    className={`h-1.5 rounded-pill ${
                      i === index ? "w-5 bg-ink" : "w-1.5 bg-hairline"
                    }`}
                  />
                ))}
              </View>
              <Pressable onPress={dismiss} accessibilityRole="button" hitSlop={8}>
                <Text className="font-sans text-body text-muted">Skip</Text>
              </Pressable>
            </View>

            <Text className="mb-3 font-sans-bold text-heading text-ink">{card.title}</Text>
            <Text className="mb-8 font-sans text-ui text-muted">{card.body}</Text>

            <Button
              label={isLast ? "Got it" : "Next"}
              onPress={() => (isLast ? dismiss() : setIndex((i) => i + 1))}
            />
          </Gutter>
        </View>
      </View>
    </Modal>
  );
}
