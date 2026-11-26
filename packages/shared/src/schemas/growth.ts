import { z } from "zod";

/** "Look around first": the guest gives a first name before browsing. */
export const guestVisitSchema = z
  .object({
    firstName: z.string().trim().min(1, "Tell us your first name").max(40),
    universityId: z.string().uuid().optional(),
  })
  .strict();
export type GuestVisitInput = z.infer<typeof guestVisitSchema>;

export const BUSINESS_LEAD_KINDS = ["bulk_pickup", "shop_listing"] as const;
export type BusinessLeadKind = (typeof BUSINESS_LEAD_KINDS)[number];

/** "Own a business on campus?": a lead Wave calls back. */
export const businessLeadSchema = z
  .object({
    fullName: z.string().trim().min(2, "Your name, please").max(80),
    phone: z.string().trim().min(9, "A phone number we can call").max(15),
    businessName: z.string().trim().min(2, "What is the business called?").max(80),
    universityId: z.string().uuid().optional(),
    kind: z.enum(BUSINESS_LEAD_KINDS),
    details: z.string().trim().max(500).optional(),
  })
  .strict();
export type BusinessLeadInput = z.infer<typeof businessLeadSchema>;

export const ADMIN_MESSAGE_CHANNELS = ["sms", "push"] as const;
export type AdminMessageChannel = (typeof ADMIN_MESSAGE_CHANNELS)[number];

/**
 * A message from the admin Messages page. `everyone` = every active student;
 * `campus` = active students of one university; `phones` = these numbers.
 */
export const adminMessageSchema = z
  .object({
    channel: z.enum(ADMIN_MESSAGE_CHANNELS),
    audience: z.discriminatedUnion("type", [
      z.object({ type: z.literal("everyone") }),
      z.object({ type: z.literal("campus"), universityId: z.string().uuid() }),
      z.object({ type: z.literal("phones"), phones: z.array(z.string().trim().min(9).max(15)).min(1).max(500) }),
    ]),
    title: z.string().trim().max(60).optional(),
    // 300 keeps an SMS to two parts at most.
    body: z.string().trim().min(1, "Write the message").max(300),
  })
  .strict()
  .refine((m) => m.channel !== "push" || !!m.title, { message: "A push message needs a title", path: ["title"] });
export type AdminMessageInput = z.infer<typeof adminMessageSchema>;
