import { Linking } from "react-native";

export interface SupportContact {
  email?: string;
  whatsapp?: string;
}

// Ride the Wave's public contact. A build can override either, but the app
// always has somewhere to send a student who needs a person.
const DEFAULT_SUPPORT_EMAIL = "support@usewavenow.com";
const DEFAULT_SUPPORT_WHATSAPP = "0550076503";

export function getSupportContact(): SupportContact {
  const email = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL;
  const whatsapp = process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP?.trim() || DEFAULT_SUPPORT_WHATSAPP;
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
    // Ghana numbers are written 0XX…; wa.me wants the country code.
    const raw = contact.whatsapp.replace(/\D/g, "");
    const digits = raw.startsWith("0") ? `233${raw.slice(1)}` : raw;
    await Linking.openURL(`https://wa.me/${digits}`);
    return;
  }
  if (contact.email) {
    await Linking.openURL(`mailto:${contact.email}`);
  }
}
