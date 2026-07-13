import axios from "axios";

const MNOTIFY_QUICK_SMS_URL = "https://api.mnotify.com/api/sms/quick";

// mNotify's Ghana numbers are in local format (0XXXXXXXXX), not E.164 — the
// rest of the app stores/uses +233XXXXXXXXX everywhere.
function toLocalGhanaFormat(e164Phone: string): string {
  return e164Phone.startsWith("+233") ? `0${e164Phone.slice(4)}` : e164Phone;
}

export async function sendOtpSms(params: {
  apiKey: string;
  senderId: string;
  phone: string;
  otp: string;
}): Promise<void> {
  await axios.post(`${MNOTIFY_QUICK_SMS_URL}?key=${params.apiKey}`, {
    recipient: [toLocalGhanaFormat(params.phone)],
    sender: params.senderId,
    message: `Your Wave verification code is ${params.otp}. It expires in 5 minutes.`,
    is_schedule: false,
    sms_type: "otp",
  });
}
