import { Linking } from "react-native";

export interface SupportContact {
  email?: string;
  whatsapp?: string;
}

export function getSupportContact(): SupportContact {
  const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || undefined;
  const whatsapp = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP?.trim() || undefined;
  return { email, whatsapp };
}

export function hasSupportContact(contact: SupportContact = getSupportContact()): boolean {
  return !!(contact.email || contact.whatsapp);
}

export function supportContactLabel(contact: SupportContact = getSupportContact()): string {
  if (contact.whatsapp) return contact.whatsapp;
  if (contact.email) return contact.email;
  return "Wave support";
}

export async function openSupportContact(contact: SupportContact = getSupportContact()): Promise<void> {
  if (contact.whatsapp) {
    const digits = contact.whatsapp.replace(/\D/g, "");
    await Linking.openURL(`https://wa.me/${digits}`);
    return;
  }
  if (contact.email) {
    await Linking.openURL(`mailto:${contact.email}`);
  }
}
