import { z } from "zod";

// Expo issues both `ExponentPushToken[...]` (the long-standing form) and
// `ExpoPushToken[...]`. Anything else — a raw FCM or APNs token — is rejected
// here rather than after a wasted round trip to Expo's push service.
export const EXPO_PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export const registerPushTokenSchema = z.object({
  token: z
    .string()
    .max(255)
    .regex(EXPO_PUSH_TOKEN_PATTERN, "Must be an Expo push token, e.g. ExponentPushToken[xxx]"),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
