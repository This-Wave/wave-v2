import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { ProfileRole } from "@prisma/client";
import { sendEmailQuietly, welcomeEmail } from "../../lib/email";

/**
 * Tells the Wave team, on Telegram, when someone new joins and when a person
 * pays for their first order, and sends a new account its welcome email.
 *
 * Rides on the same bot and chat as the test-account watch
 * (`lib/activityWatch.ts`), so it is silent unless TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID are set, and the email is silent unless RESEND_API_KEY is
 * set and the person gave an address. **Never throws**: a sign-up or a payment
 * must not fail because Telegram or Resend did.
 */

const ROLE_LABEL: Record<ProfileRole, string> = {
  student: "Student",
  rider: "Rider",
  shop_owner: "Shop owner",
  admin: "Staff",
  dispatcher: "Dispatcher",
};

async function campusName(fastify: FastifyInstance, universityId: string | null): Promise<string> {
  if (!universityId) return "No campus";
  const uni = await fastify.prisma.university.findUnique({
    where: { id: universityId },
    select: { name: true },
  });
  return uni?.name ?? "Unknown campus";
}

export function signupAlertText(args: { fullName: string; role: ProfileRole; campus: string }): string {
  return `${args.fullName} · ${ROLE_LABEL[args.role]} · ${args.campus}`;
}

export function firstOrderAlertText(args: {
  fullName: string;
  campus: string;
  totalAmount: string;
  shopName: string | null;
}): string {
  const what = args.shopName ?? "Pickup";
  return `${args.fullName} · ${args.campus} · ${what} · GH₵${Number(args.totalAmount).toFixed(2)}`;
}

export async function announceSignup(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  profile: {
    fullName: string;
    role: ProfileRole;
    universityId: string | null;
    email: string | null;
    isTest?: boolean;
  };
}): Promise<void> {
  const { fastify, log, profile } = args;
  try {
    const watch = fastify.activityWatch;
    if (watch && !profile.isTest) {
      const campus = await campusName(fastify, profile.universityId);
      await watch.sendNow("New sign-up", signupAlertText({ ...profile, campus }));
    }
    const email = welcomeEmail({ name: profile.fullName, role: profile.role });
    await sendEmailQuietly({
      apiKey: fastify.config.RESEND_API_KEY,
      from: fastify.config.RESEND_FROM,
      to: profile.email,
      ...email,
      log,
    });
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : "unknown" }, "Sign-up announcement failed");
  }
}

/**
 * Call only after winning the payment claim in `confirmDeliveryFeePaid`, so a
 * webhook and a verify-poll for the same order cannot both announce it. "First"
 * means this is the only paid order the student has.
 */
export async function announceFirstPaidOrder(args: {
  fastify: FastifyInstance;
  log: FastifyBaseLogger;
  order: {
    studentId: string;
    universityId: string;
    totalAmount: unknown;
    isTest: boolean;
    shop: { name: string } | null;
  };
}): Promise<void> {
  const { fastify, log, order } = args;
  const watch = fastify.activityWatch;
  if (!watch || order.isTest) return;
  try {
    const paidOrders = await fastify.prisma.order.count({
      where: { studentId: order.studentId, paidAt: { not: null } },
    });
    if (paidOrders !== 1) return;
    const [student, campus] = await Promise.all([
      fastify.prisma.profile.findUnique({ where: { id: order.studentId }, select: { fullName: true } }),
      campusName(fastify, order.universityId),
    ]);
    await watch.sendNow(
      "First order",
      firstOrderAlertText({
        fullName: student?.fullName ?? "Unknown student",
        campus,
        totalAmount: String(order.totalAmount),
        shopName: order.shop?.name ?? null,
      }),
    );
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : "unknown" }, "First-order announcement failed");
  }
}
