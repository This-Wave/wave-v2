import { Linking, Platform } from "react-native";

/**
 * Open the device's map app at a place.
 *
 * Wave has no coordinates for shops — `Shop` stores a free-text `locationText`
 * ("Berekuso Main Road, opposite the junction") and nothing else — so this is a
 * *search*, not a pin. That is the honest capability: it gets a rider to the
 * right area and lets them finish on local knowledge, which is how Berekuso
 * addressing works anyway.
 *
 * Platform-native schemes are tried first so the request lands in the installed
 * map app rather than a browser tab. The Google Maps universal URL is the
 * fallback and works everywhere, including web.
 */
export async function openMapsSearch(query: string): Promise<boolean> {
  const q = query.trim();
  if (!q) return false;

  const encoded = encodeURIComponent(q);
  const candidates =
    Platform.OS === "ios"
      ? [`maps://?q=${encoded}`, `https://maps.apple.com/?q=${encoded}`]
      : [`geo:0,0?q=${encoded}`];

  for (const url of candidates) {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // Fall through to the next candidate — a scheme this device cannot handle
      // is not an error worth surfacing, it just means try the web URL.
    }
  }

  try {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
    return true;
  } catch {
    return false;
  }
}
