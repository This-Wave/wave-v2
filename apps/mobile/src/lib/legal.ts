import { Linking } from "react-native";

export interface LegalLinks {
  terms?: string;
  privacy?: string;
}

export function getLegalLinks(): LegalLinks {
  return {
    terms: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || undefined,
    privacy: process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || undefined,
  };
}

export function hasLegalLinks(links: LegalLinks = getLegalLinks()): boolean {
  return !!(links.terms || links.privacy);
}

export async function openLegalLink(url: string | undefined): Promise<void> {
  if (!url) return;
  await Linking.openURL(url);
}
