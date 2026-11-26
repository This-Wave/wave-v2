import axios from "axios";

const MNOTIFY_QUICK_SMS_URL = "https://api.mnotify.com/api/sms/quick";

// mNotify's Ghana numbers are in local format (0XXXXXXXXX), not E.164 — the
// rest of the app stores/uses +233XXXXXXXXX everywhere.
export function toLocalGhanaFormat(e164Phone: string): string {
  return e164Phone.startsWith("+233") ? `0${e164Phone.slice(4)}` : e164Phone;
}

/**
 * Carries only what is safe to log. A raw axios error serializes
 * `config.data`, which for an SMS send is the message body — i.e. the OTP or
 * the delivery PIN in plaintext. Callers log this instead.
 */
export class SmsSendError extends Error {
  constructor(
    readonly status?: number,
    readonly providerMessage?: string,
  ) {
    super(
      `mNotify send failed${status ? ` (HTTP ${status})` : ""}` +
        `${providerMessage ? `: ${providerMessage}` : ""}`,
    );
    this.name = "SmsSendError";
  }
}

/**
 * mNotify is inconsistent about where it puts the reason for a failure: some
 * responses use `message`, others `error`. Reading only `message` discarded the
 * actionable half — a real 402 arrived as a bare "HTTP 402" when the body said
 * "insufficient wallet balance. please top up your account and try again".
 *
 * Only these two known scalar fields are read, never the whole body: the request
 * payload contains the OTP or delivery PIN, and an unbounded dump would put it
 * straight into a log line. That is the property `SmsSendError` exists to hold.
 */
function providerReason(data: unknown): string | undefined {
  if (typeof data === "string") return data.slice(0, 200);
  if (!data || typeof data !== "object") return undefined;
  const body = data as { message?: unknown; error?: unknown };
  const reason = body.message ?? body.error;
  return typeof reason === "string" ? reason.slice(0, 200) : undefined;
}

export interface SendSmsParams {
  apiKey: string;
  senderId: string;
  phone: string;
  message: string;
  /**
   * `"otp"` marks the message as a one-time code. Anything else is a standard send.
   *
   * ⚠️ What that flag actually buys is **not documented**. The BMS/mNotify spec
   * (developer.bms.africa, `/openapi14.yaml`) says exactly one thing about it —
   * that it costs GHS 0.035 per campaign from the main wallet — and contains no
   * mention of priority, routing or do-not-disturb anywhere. An earlier comment
   * here asserted "prioritised over bulk traffic and exempt from do-not-disturb
   * lists"; that was inference, not fact, and it propagated into the planning
   * docs. Treat the delivery benefit as plausible-but-unconfirmed: a provider
   * charging a premium for a flag is presumably selling something, but ask
   * mNotify before relying on it for anything that matters.
   *
   * ⚠️ There is no `"quick"` value. `sms_type` is a flag that may ONLY hold
   * `"otp"` — sending `sms_type: "quick"` is rejected with
   * `422 {"sms_type":["The sms_type must be \"otp\"."]}`. The field must be
   * **omitted** for a standard send. This defaulted to `"quick"`, so every
   * non-OTP send this app made was rejected before it left the building.
   */
  smsType?: "otp" | "standard";
}

/**
 * The two send types bill different balances, which is the whole reason the
 * fallback below exists:
 *
 *  - **standard** draws one unit from the SMS credit balance (`balance`).
 *  - **otp** deducts GHS 0.035 per campaign from the **main cash wallet**
 *    (`wallet`) — a different pot, which can be empty while credits are plentiful.
 */
const INSUFFICIENT_WALLET = /insufficient wallet balance/i;

/**
 * mNotify refuses the otp flag (403) for a sender ID that has not registered
 * the web address its OTPs are used on: "your sender id 'TACCBooking' isn't set
 * up for OTPs yet. To send OTPs, add the URL where your OTPs are used…". Seen
 * live on 2026-11-26, after the move to usewavenow.com, and it stopped every
 * sign-in code. The standard route is unaffected, so the code still goes out.
 */
const SENDER_NOT_OTP_READY = /isn'?t set up for OTPs/i;

/** The otp-flag refusals a standard send gets past, and what to log for each. */
function otpFallbackReason(status: number | undefined, reason: string | undefined): string | null {
  if (!reason) return null;
  if (status === 402 && INSUFFICIENT_WALLET.test(reason)) {
    return (
      "[sms] mNotify cash wallet is empty — retrying as a standard credit send. " +
      "The message will go out, but whatever the otp flag buys is forfeited " +
      "until the wallet is topped up."
    );
  }
  if (status === 403 && SENDER_NOT_OTP_READY.test(reason)) {
    return (
      "[sms] mNotify sender ID is not set up for OTPs — retrying as a standard send. " +
      "Register the app URL for this sender in the mNotify dashboard to restore the otp route."
    );
  }
  return null;
}

export async function sendSms(params: SendSmsParams): Promise<void> {
  const body = {
    recipient: [toLocalGhanaFormat(params.phone)],
    sender: params.senderId,
    message: params.message,
    is_schedule: false,
    // Present only when it is "otp". See the warning on `smsType`.
    ...(params.smsType === "otp" ? { sms_type: "otp" } : {}),
  };

  try {
    await axios.post(`${MNOTIFY_QUICK_SMS_URL}?key=${params.apiKey}`, body);
  } catch (err) {
    if (!axios.isAxiosError(err)) throw new SmsSendError();

    const status = err.response?.status;
    const reason = providerReason(err.response?.data);

    /**
     * The otp flag was refused for a reason the standard route does not share
     * (an empty cash wallet, or a sender not yet set up for OTPs). Retry as a
     * standard send rather than failing.
     *
     * A code that arrives on ordinary priority is worth far more than one that
     * does not arrive at all: without it a student cannot sign in and a rider
     * cannot close a handover. The retry may lose whatever the flag buys, so it
     * logs rather than passing silently.
     */
    const fallback = params.smsType === "otp" ? otpFallbackReason(status, reason) : null;
    if (fallback) {
      // eslint-disable-next-line no-console
      console.warn(fallback);
      try {
        const { sms_type: _omit, ...standard } = body as typeof body & { sms_type?: string };
        await axios.post(`${MNOTIFY_QUICK_SMS_URL}?key=${params.apiKey}`, standard);
        return;
      } catch (retryErr) {
        if (axios.isAxiosError(retryErr)) {
          throw new SmsSendError(
            retryErr.response?.status,
            providerReason(retryErr.response?.data),
          );
        }
        throw new SmsSendError();
      }
    }

    throw new SmsSendError(status, reason);
  }
}

export async function sendOtpSms(params: {
  apiKey: string;
  senderId: string;
  phone: string;
  otp: string;
}): Promise<void> {
  await sendSms({
    apiKey: params.apiKey,
    senderId: params.senderId,
    phone: params.phone,
    message: `Your Wave verification code is ${params.otp}. It expires in 5 minutes.`,
    smsType: "otp",
  });
}

export async function sendDeliveryPinSms(params: {
  apiKey: string;
  senderId: string;
  phone: string;
  pin: string;
}): Promise<void> {
  await sendSms({
    apiKey: params.apiKey,
    senderId: params.senderId,
    phone: params.phone,
    message:
      `Your Wave delivery PIN is ${params.pin}. ` +
      `Give it to your rider only once you have your order in hand.`,
    smsType: "otp",
  });
}
