import { supabase } from "./supabase";
import { unregisterPushToken } from "./notifications";
import { disableWebPush } from "./webPush";
import { api } from "./api";

/**
 * Signs out, detaching this device's push token first.
 *
 * Order matters: `DELETE /notifications/token` is authenticated, so it has to
 * go out while the session is still valid. Every "Log Out" control calls this
 * rather than `supabase.auth.signOut()` directly — otherwise the signed-out
 * account keeps the token and its order notifications keep landing on this
 * device, in front of whoever signs in next.
 */
export async function signOut(): Promise<void> {
  await unregisterPushToken();
  await disableWebPush();
  // Best-effort, for the audit log; a failure must not keep anyone signed in.
  await api.post("/auth/signed-out").catch(() => undefined);
  await supabase.auth.signOut();
}
