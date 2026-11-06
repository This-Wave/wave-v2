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

/**
 * A browser's `PushSubscription.toJSON()`. The endpoint must be https: it is
 * the URL the server posts to, so anything else is either junk or an attempt
 * to make the API call somewhere it shouldn't.
 */
export const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).startsWith("https://"),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});
export type WebPushSubscriptionInput = z.infer<typeof webPushSubscriptionSchema>;

export const webPushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
});
