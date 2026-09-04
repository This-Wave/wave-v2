import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Whether a given account has seen its first-run tour.
 *
 * Keyed by profile id rather than a single flag, because one device is shared
 * more often than not on this campus — a rider borrowing a phone to check the
 * feed must not silently inherit the previous account's "already seen" state,
 * and the two of them see different tours.
 *
 * Deliberately local rather than a column on `Profile`. Nothing server-side
 * needs to know, and a failed write here should never be able to block sign-in;
 * the worst case is that someone sees three cards twice.
 */
const key = (profileId: string) => `wave_tour_seen_${profileId}`;

export async function hasSeenTour(profileId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key(profileId))) === "1";
  } catch {
    // Storage unavailable — treat as seen. Showing the tour on every launch is
    // worse than never showing it.
    return true;
  }
}

export async function markTourSeen(profileId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(profileId), "1");
  } catch {
    // Non-critical.
  }
}
