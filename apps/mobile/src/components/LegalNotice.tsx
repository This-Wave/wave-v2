import { Pressable, Text, View } from "react-native";
import { getLegalLinks, openLegalLink } from "../lib/legal";

/** Shown on signup when terms/privacy URLs are configured (checklist H11). */
export function LegalNotice() {
  const links = getLegalLinks();
  if (!links.terms && !links.privacy) return null;

  return (
    <View className="mt-6">
      <Text className="font-sans text-meta text-muted">
        By continuing you agree to Wave&apos;s{" "}
        {links.terms ? (
          <Text
            className="font-sans-medium text-ink underline"
            onPress={() => void openLegalLink(links.terms)}
            accessibilityRole="link"
          >
            Terms
          </Text>
        ) : null}
        {links.terms && links.privacy ? " and " : null}
        {links.privacy ? (
          <Text
            className="font-sans-medium text-ink underline"
            onPress={() => void openLegalLink(links.privacy)}
            accessibilityRole="link"
          >
            Privacy Policy
          </Text>
        ) : null}
        .
      </Text>
    </View>
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
