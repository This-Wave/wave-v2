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

/**
 * Open the device's map app at an exact point (review 11-campus, H3).
 *
 * Unlike `openMapsSearch`, this drops a real pin. Checkpoints are the one place
 * Wave can do this honestly: they are fixed, surveyed-once campus locations, so
 * an admin records the coordinates and every rider afterwards gets turn-by-turn
 * to the exact spot instead of a search for "Quad" that could land anywhere.
 *
 * Shops keep the search: their `locationText` is free text ("opposite the
 * junction") and Wave has no coordinates for them at all.
 *
 * `label` names the pin in the map app. Passed via `q=` on the geo: scheme,
 * which is the only one of the three that carries a label with a coordinate.
 */
export async function openMapsAt(
  latitude: number,
  longitude: number,
  label?: string,
): Promise<boolean> {
  // Guard the obvious ways bad data arrives — a null coerced to 0 would send a
  // rider to the Gulf of Guinea rather than failing visibly.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;

  const point = `${latitude},${longitude}`;
  const name = encodeURIComponent(label?.trim() || "Checkpoint");
  const candidates =
    Platform.OS === "ios"
      ? [`maps://?ll=${point}&q=${name}`, `https://maps.apple.com/?ll=${point}&q=${name}`]
      : [`geo:${point}?q=${point}(${name})`];

  for (const url of candidates) {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // Same reasoning as openMapsSearch: an unhandled scheme is not an error,
      // it just means try the next candidate.
    }
  }

  try {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${point}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Navigate to a checkpoint: an exact pin when someone has recorded its
 * coordinates, a name search when they have not.
 *
 * Most checkpoints have no coordinates until someone walks the campus with the
 * admin screen open, so the fallback is the normal case today, not an edge one.
 */
export async function openCheckpointInMaps(checkpoint: {
  name: string;
  latitude: string | null;
  longitude: string | null;
}): Promise<boolean> {
  if (checkpoint.latitude !== null && checkpoint.longitude !== null) {
    const opened = await openMapsAt(
      Number(checkpoint.latitude),
      Number(checkpoint.longitude),
      checkpoint.name,
    );
    if (opened) return true;
  }
  return openMapsSearch(checkpoint.name);
}

