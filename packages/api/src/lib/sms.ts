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
  // mNotify prioritises "otp" traffic over bulk "quick" traffic and exempts it
  // from do-not-disturb lists. Transactional codes want "otp".
  smsType?: "otp" | "quick";
}

export async function sendSms(params: SendSmsParams): Promise<void> {
  try {
    await axios.post(`${MNOTIFY_QUICK_SMS_URL}?key=${params.apiKey}`, {
      recipient: [toLocalGhanaFormat(params.phone)],
      sender: params.senderId,
      message: params.message,
      is_schedule: false,
      sms_type: params.smsType ?? "quick",
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new SmsSendError(err.response?.status, providerReason(err.response?.data));
    }
    throw new SmsSendError();
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
