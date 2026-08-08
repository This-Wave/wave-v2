import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { sendSms, sendOtpSms, toLocalGhanaFormat, SmsSendError } from "../sms";

vi.mock("axios");
const post = vi.mocked(axios.post);
const isAxiosError = vi.mocked(axios.isAxiosError);

function axiosError(status: number, data: unknown) {
  return { isAxiosError: true, response: { status, data } };
}

beforeEach(() => {
  vi.resetAllMocks();
  // The real `isAxiosError` is a type guard on a shape we fake here.
  isAxiosError.mockImplementation((e: unknown) => !!(e as { isAxiosError?: boolean })?.isAxiosError);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const base = { apiKey: "k", senderId: "TACCBooking", phone: "+233550076503" };

describe("toLocalGhanaFormat", () => {
  it("converts E.164 to the local form mNotify's API expects", () => {
    // The app stores +233…; every mNotify example uses 0…
    expect(toLocalGhanaFormat("+233550076503")).toBe("0550076503");
  });

  it("leaves an already-local number alone", () => {
    expect(toLocalGhanaFormat("0550076503")).toBe("0550076503");
  });
});

/**
 * `sms_type` is a flag that may only ever hold `"otp"`.
 *
 * This defaulted to `"quick"`, which mNotify rejects outright:
 * `422 {"sms_type":["The sms_type must be \"otp\"."]}`. Every standard send the
 * app made was refused before it left the building. Confirmed against the live
 * API on 2026-08-08 — omitting the field sent successfully, `"quick"` 422'd.
 */
describe("sms_type", () => {
  it("omits the field entirely on a standard send", async () => {
    post.mockResolvedValue({ data: { status: "success" } });

    await sendSms({ ...base, message: "hello" });

    expect(post.mock.calls[0]![1]).not.toHaveProperty("sms_type");
  });

  it("never sends the string 'quick', which the API refuses", async () => {
    post.mockResolvedValue({ data: { status: "success" } });

    await sendSms({ ...base, message: "hello", smsType: "standard" });

    expect(JSON.stringify(post.mock.calls[0]![1])).not.toContain("quick");
  });

  it("sets sms_type only for an OTP", async () => {
    post.mockResolvedValue({ data: { status: "success" } });

    await sendSms({ ...base, message: "code", smsType: "otp" });

    expect(post.mock.calls[0]![1]).toMatchObject({ sms_type: "otp" });
  });
});

/**
 * The two send types bill different pots: standard draws an SMS credit, `otp`
 * takes GHS 0.035 from the main cash wallet. The wallet can be empty while
 * hundreds of credits remain, which is exactly the state this account was in.
 */
describe("empty-wallet fallback", () => {
  const walletEmpty = axiosError(402, {
    error: "insufficient wallet balance. please top up your account and try again",
  });

  it("retries an OTP as a standard send when the cash wallet is empty", async () => {
    post.mockRejectedValueOnce(walletEmpty).mockResolvedValueOnce({ data: { status: "success" } });

    await expect(sendOtpSms({ ...base, otp: "123456" })).resolves.toBeUndefined();

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]![1]).toMatchObject({ sms_type: "otp" });
    // The retry must drop the flag, or it fails for the same reason again.
    expect(post.mock.calls[1]![1]).not.toHaveProperty("sms_type");
  });

  it("says so in the logs rather than degrading silently", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    post.mockRejectedValueOnce(walletEmpty).mockResolvedValueOnce({ data: { status: "success" } });

    await sendOtpSms({ ...base, otp: "123456" });

    // The retry loses do-not-disturb exemption, so it must be visible.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("wallet is empty"));
  });

  it("does not retry a 402 that is about something else", async () => {
    post.mockRejectedValue(axiosError(402, { error: "account suspended" }));

    await expect(sendOtpSms({ ...base, otp: "123456" })).rejects.toBeInstanceOf(SmsSendError);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("does not retry a standard send — there is nothing to fall back to", async () => {
    post.mockRejectedValue(walletEmpty);

    await expect(sendSms({ ...base, message: "hi" })).rejects.toBeInstanceOf(SmsSendError);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("surfaces the provider's own reason when the retry also fails", async () => {
    post
      .mockRejectedValueOnce(walletEmpty)
      .mockRejectedValueOnce(axiosError(422, { message: "sender id not registered" }));

    await expect(sendOtpSms({ ...base, otp: "123456" })).rejects.toMatchObject({
      status: 422,
      providerMessage: "sender id not registered",
    });
  });
});

/**
 * `SmsSendError` exists so a failure can be logged without the request body,
 * which for these sends contains the OTP or the delivery PIN in plaintext.
 */
describe("SmsSendError", () => {
  it("carries the provider's reason, not the payload", async () => {
    post.mockRejectedValue(
      axiosError(402, { error: "insufficient wallet balance. please top up" }),
    );

    const err = await sendSms({ ...base, message: "PIN 654321" }).catch((e) => e as SmsSendError);

    expect(err.providerMessage).toMatch(/insufficient wallet/);
    expect(JSON.stringify(err)).not.toContain("654321");
  });
});
