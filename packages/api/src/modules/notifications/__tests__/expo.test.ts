import { beforeEach, describe, expect, test, vi } from "vitest";
import axios from "axios";
import { isExpoPushToken, PushSendError, sendExpoPush, type ExpoPushMessage } from "../expo";

vi.mock("axios", () => ({
  default: { post: vi.fn(), isAxiosError: vi.fn(() => false) },
}));

const postMock = vi.mocked(axios.post);
const isAxiosErrorMock = vi.mocked(axios.isAxiosError);

const message = (to: string): ExpoPushMessage => ({ to, title: "T", body: "B" });

beforeEach(() => {
  postMock.mockReset();
  isAxiosErrorMock.mockReset();
  isAxiosErrorMock.mockReturnValue(false);
});

describe("isExpoPushToken", () => {
  test.each([
    ["ExponentPushToken[xxxxxxxx]", true],
    ["ExpoPushToken[xxxxxxxx]", true],
    ["ExponentPushToken[]", false],
    ["fcm-raw-token", false],
    ["", false],
  ])("%s -> %s", (token, expected) => {
    expect(isExpoPushToken(token)).toBe(expected);
  });
});

describe("sendExpoPush", () => {
  test("makes no request for an empty batch", async () => {
    await expect(sendExpoPush([])).resolves.toEqual([]);
    expect(postMock).not.toHaveBeenCalled();
  });

  test("splits batches larger than Expo's 100-message limit", async () => {
    postMock.mockImplementation(async (_url, body) => ({
      data: { data: (body as ExpoPushMessage[]).map(() => ({ status: "ok" })) },
    }));

    const tickets = await sendExpoPush(
      Array.from({ length: 250 }, (_, i) => message(`ExponentPushToken[${i}]`)),
    );

    expect(postMock).toHaveBeenCalledTimes(3);
    expect(postMock.mock.calls.map((c) => (c[1] as ExpoPushMessage[]).length)).toEqual([100, 100, 50]);
    expect(tickets).toHaveLength(250);
  });

  test("throws PushSendError, never the raw axios error", async () => {
    isAxiosErrorMock.mockReturnValue(true);
    postMock.mockRejectedValue({
      response: { status: 429, data: { errors: [{ message: "Rate limited" }] } },
      // A raw axios error also carries config.data — every recipient token and
      // message body. PushSendError exists so that never reaches a log.
      config: { data: JSON.stringify([message("ExponentPushToken[secret]")]) },
    });

    let thrown: unknown;
    try {
      await sendExpoPush([message("ExponentPushToken[a]")]);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(PushSendError);
    const err = thrown as PushSendError;
    expect(err.status).toBe(429);
    expect(err.providerMessage).toBe("Rate limited");
    expect(JSON.stringify(err)).not.toContain("secret");
  });

  test("returns tickets in the order the messages were given", async () => {
    postMock.mockResolvedValue({
      data: { data: [{ status: "ok", id: "1" }, { status: "error", details: { error: "DeviceNotRegistered" } }] },
    });

    const tickets = await sendExpoPush([
      message("ExponentPushToken[a]"),
      message("ExponentPushToken[b]"),
    ]);

    expect(tickets[0]!.status).toBe("ok");
    expect(tickets[1]!.details?.error).toBe("DeviceNotRegistered");
  });
});
