import type { CompleteProfileInput, UpdateProfileInput } from "@wave/shared";
import { api } from "./api";
import type { Profile } from "../types";

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data } = await api.get<{ profile: Profile | null }>("/profile/me");
  return data.profile;
}

export async function completeProfile(input: CompleteProfileInput): Promise<Profile> {
  const { data } = await api.post<{ profile: Profile }>("/profile", input);
  return data.profile;
}

// Typed from the server's Zod schema rather than a hand-copied shape: the
// schema is `.strict()`, so any field that drifts in here is a 400 at runtime.
export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  const { data } = await api.put<{ profile: Profile }>("/profile/me", input);
  return data.profile;
}
