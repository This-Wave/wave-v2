import axios from "axios";

const RESEND_SEND_URL = "https://api.resend.com/emails";

/**
 * Carries only what is safe to log — a raw axios error serializes `config.data`,
 * which for an email send is the full rendered body. Mirrors `SmsSendError`.
 */
export class EmailSendError extends Error {
  constructor(
    readonly status?: number,
    readonly providerMessage?: string,
  ) {
    super(
      `Resend send failed${status ? ` (HTTP ${status})` : ""}` +
        `${providerMessage ? `: ${providerMessage}` : ""}`,
    );
    this.name = "EmailSendError";
  }
}

function providerReason(data: unknown): string | undefined {
  if (typeof data === "string") return data.slice(0, 200);
  if (!data || typeof data !== "object") return undefined;
  const body = data as { message?: unknown; error?: unknown; name?: unknown };
  const reason = body.message ?? body.error ?? body.name;
  return typeof reason === "string" ? reason.slice(0, 200) : undefined;
}

export interface SendEmailParams {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Throws on failure. Use `sendEmailQuietly` from route handlers — see below for
 * why that distinction matters.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  try {
    await axios.post(
      RESEND_SEND_URL,
      {
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      },
      { headers: { Authorization: `Bearer ${params.apiKey}` } },
    );
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new EmailSendError(err.response?.status, providerReason(err.response?.data));
    }
    throw new EmailSendError();
  }
}

/**
 * The form route handlers should call. **Never throws**, and no-ops when
 * `RESEND_API_KEY` is unset.
 *
 * Same contract as `pushToProfiles`: an email is an accelerator, never the only
 * way to learn something. Everything it announces is also visible by opening
 * the app. So a Resend outage — or simply nobody having configured a key in
 * local dev and CI — must not fail the admin action that triggered it.
 */
export async function sendEmailQuietly(params: {
  apiKey?: string;
  from: string;
  to?: string | null;
  subject: string;
  html: string;
  text: string;
  log: { warn: (o: unknown, m: string) => void };
}): Promise<{ sent: boolean }> {
  if (!params.apiKey || !params.to) return { sent: false };
  try {
    await sendEmail({
      apiKey: params.apiKey,
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { sent: true };
  } catch (err) {
    const e = err as EmailSendError;
    params.log.warn(
      { status: e.status, providerMessage: e.providerMessage },
      "Email send failed",
    );
    return { sent: false };
  }
}

/**
 * "The shop you asked for is on Wave now."
 *
 * Plain HTML on purpose: no images, no external CSS, no tracking pixel. Ghanaian
 * students read this on mobile data, and a 200KB template to say one sentence is
 * a cost the reader pays.
 */
export function shopLiveEmail(args: {
  studentName: string;
  shopName: string;
}): { subject: string; html: string; text: string } {
  const first = args.studentName.split(" ")[0] || "there";
  const subject = `${args.shopName} is now on Wave`;
  const text =
    `Hi ${first},\n\n` +
    `You asked us to add ${args.shopName}. It's on Wave now — you can browse ` +
    `its menu and order from it on the next Wave.\n\n` +
    `Open the app to take a look.\n\n— The Wave team`;
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;` +
    `font-size:16px;line-height:1.5;color:#083400;max-width:480px">` +
    `<p>Hi ${escapeHtml(first)},</p>` +
    `<p>You asked us to add <strong>${escapeHtml(args.shopName)}</strong>. ` +
    `It's on Wave now — you can browse its menu and order from it on the next Wave.</p>` +
    `<p>Open the app to take a look.</p>` +
    `<p style="color:#6a6a6a">— The Wave team</p>` +
    `</div>`;
  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
