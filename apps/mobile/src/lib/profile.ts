import type { CompleteProfileInput } from "@wave/shared";
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

export async function updateProfile(input: {
  fullName?: string;
  avatarUrl?: string;
  email?: string | null;
}): Promise<Profile> {
  const { data } = await api.put<{ profile: Profile }>("/profile/me", input);
  return data.profile;
}
