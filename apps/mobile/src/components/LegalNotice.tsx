import { Pressable, Text, View } from "react-native";
import { getLegalLinks, openLegalLink } from "../lib/legal";
import { CheckIcon } from "./icons";
import { colors } from "../theme/tokens";

/**
 * The signup consent: a tick-box the person has to set, and a line that always
 * says what they are agreeing to.
 *
 * Two bugs it replaces, both High in debug.md. It used to return `null` when
 * neither `EXPO_PUBLIC_TERMS_URL` nor `EXPO_PUBLIC_PRIVACY_URL` was set, so a
 * production build with those env vars missing showed **no consent line at
 * all** and students signed up having agreed to nothing on screen. And it was
 * link-only — a sentence under a button, which is not consent anyone can
 * evidence later.
 *
 * So: the text is unconditional, and the links inside it appear only when
 * there is somewhere to link to. A missing URL now costs a hyperlink, not the
 * agreement. `onChange` lets the screen block its own submit, which is what
 * makes the tick a gate rather than a decoration.
 */
export function LegalNotice({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (next: boolean) => void;
}) {
  const links = getLegalLinks();

  return (
    <Pressable
      onPress={() => onChange(!accepted)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: accepted }}
      // The whole row is the target: a 20pt box on its own is below the 44pt
      // minimum, and the label is the part people aim at anyway.
      accessibilityLabel="I agree to Wave's Terms of Service and Privacy Policy"
      className="mt-6 flex-row items-start gap-3 rounded-card py-1 active:opacity-70"
    >
      <View
        className={`mt-0.5 h-5 w-5 items-center justify-center rounded-input border ${
          accepted ? "border-ink bg-lime" : "border-icon bg-surface"
        }`}
      >
        {accepted ? <CheckIcon size={14} color={colors.onAccent} strokeWidth={2.6} /> : null}
      </View>

      {/* Hidden from assistive tech: the Pressable above carries the whole
          sentence as its label, so reading this again would say it twice. The
          links stay reachable because each is its own control. */}
      <Text
        className="flex-1 font-sans text-meta text-muted"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        I agree to Wave&apos;s{" "}
        {links.terms ? (
          <Text
            className="font-sans-medium text-ink underline"
            onPress={() => void openLegalLink(links.terms)}
            accessibilityRole="link"
          >
            Terms of Service
          </Text>
        ) : (
          <Text className="font-sans-medium text-ink">Terms of Service</Text>
        )}{" "}
        and{" "}
        {links.privacy ? (
          <Text
            className="font-sans-medium text-ink underline"
            onPress={() => void openLegalLink(links.privacy)}
            accessibilityRole="link"
          >
            Privacy Policy
          </Text>
        ) : (
          <Text className="font-sans-medium text-ink">Privacy Policy</Text>
        )}
        .
      </Text>
    </Pressable>
  );
}

/** Profile row linking to legal docs when configured. */
export function LegalLinksRow() {
  const links = getLegalLinks();
  if (!links.terms && !links.privacy) return null;

  return (
    <View className="gap-1">
      {links.terms ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void openLegalLink(links.terms)}
          className="py-1"
        >
          <Text className="font-sans text-body text-ink underline">Terms of service</Text>
        </Pressable>
      ) : null}
      {links.privacy ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void openLegalLink(links.privacy)}
          className="py-1"
        >
          <Text className="font-sans text-body text-ink underline">Privacy policy</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
