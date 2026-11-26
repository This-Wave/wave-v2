import type { BusinessLeadInput } from "@wave/shared";
import { api } from "./api";

/**
 * Growth signals: a guest's first name, a business owner's lead, and "this
 * account opened Wave from a home-screen icon". The API stores each one and
 * reports it to the team's Telegram chat.
 */

/** Fire and forget: a failed log must never stop someone looking around. */
export function recordGuestVisit(firstName: string, universityId?: string): void {
  void api.post("/guest-visits", { firstName, universityId }).catch(() => {});
}

export async function submitBusinessLead(input: BusinessLeadInput): Promise<void> {
  await api.post("/business-leads", input);
}

const INSTALL_REPORTED_KEY = "wave.installReported";

/** Once per device: the API keeps only the first time anyway. */
export function reportAppInstalled(): void {
  try {
    if (typeof window === "undefined" || window.localStorage.getItem(INSTALL_REPORTED_KEY)) return;
    void api
      .post("/profile/me/app-installed")
      .then(() => {
        try {
          window.localStorage.setItem(INSTALL_REPORTED_KEY, "1");
        } catch {
          /* private mode: report again next time, harmless */
        }
      })
      .catch(() => {});
  } catch {
    /* storage blocked */
  }
}
