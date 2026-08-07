import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { sendEmailQuietly, shopLiveEmail } from "../../lib/email";
import { pushToProfiles } from "../notifications/dispatch";

/**
 * Tells every student who asked for a shop that it is now on Wave.
 *
 * Two channels, and they are not redundant. The push is what actually gets
 * someone back into the app the same day; the email is what survives a
 * dismissed notification and a phone that has since reinstalled. A student with
 * neither an email nor a push token simply finds out by opening the app, which
 * is why nothing here is allowed to fail the onboarding that triggered it.
 *
 * **Never throws.** Both senders swallow their own errors, and the loop is
 * sequential rather than `Promise.all` because Resend rate-limits per second
 * and a pilot-sized fan-out is a handful of students, not a campaign.
 */
export async function announceShopIsLive(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  studentIds: string[];
  shopId: string;
  shopName: string;
}): Promise<{ emailed: number; pushed: number }> {
  const { fastify, log, studentIds, shopId, shopName } = args;
  if (studentIds.length === 0) return { emailed: 0, pushed: 0 };

  let emailed = 0;

  try {
    const students = await fastify.prisma.profile.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, fullName: true, email: true },
    });

    for (const student of students) {
      if (!student.email) continue;
      const { subject, html, text } = shopLiveEmail({
        studentName: student.fullName,
        shopName,
      });
      const { sent } = await sendEmailQuietly({
        apiKey: fastify.config.RESEND_API_KEY,
        from: fastify.config.RESEND_FROM,
        to: student.email,
        subject,
        html,
        text,
        log,
      });
      if (sent) emailed += 1;
    }

    const { sent: pushed } = await pushToProfiles({
      fastify,
      log,
      profileIds: studentIds,
      payload: {
        title: `${shopName} is on Wave`,
        body: "The shop you asked for is live. Tap to see its menu.",
        // `shopId`, so tapping the notification opens the shop rather than the
        // home screen — the whole point of the message is to get them there.
        data: { type: "shop_live", shopId },
      },
    });

    return { emailed, pushed };
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : "unknown", shopId },
      "Shop-is-live announcement failed",
    );
    return { emailed, pushed: 0 };
  }
}
