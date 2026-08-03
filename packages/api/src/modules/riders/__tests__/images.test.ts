import { describe, expect, test, vi, beforeEach } from "vitest";

const createSignedUrls = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => ({ createSignedUrls }) } }),
}));

const { ownsVerificationPath, signVerificationImages } = await import("../images");

const config = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" };
const RIDER = "4e45b6f3-0da4-446b-a547-2cf8138028e0";

beforeEach(() => {
  createSignedUrls.mockReset();
});

describe("ownsVerificationPath", () => {
  test("accepts a path the upload route would have produced for this rider", () => {
    expect(ownsVerificationPath(`${RIDER}/id-1730000000000.jpeg`, RIDER)).toBe(true);
  });

  test("rejects another rider's path", () => {
    const other = "6a2f924d-256d-4599-a239-6b71ce9a7e25";
    expect(ownsVerificationPath(`${other}/id-1730000000000.jpeg`, RIDER)).toBe(false);
  });

  test("rejects traversal out of the rider's own prefix", () => {
    expect(ownsVerificationPath(`${RIDER}/../${RIDER}x/id.jpeg`, RIDER)).toBe(false);
  });

  test("rejects a prefix match that is not a directory boundary", () => {
    expect(ownsVerificationPath(`${RIDER}-evil/id.jpeg`, RIDER)).toBe(false);
  });
});

describe("signVerificationImages", () => {
  test("signs stored paths and exposes them as URL fields", async () => {
    createSignedUrls.mockResolvedValue({
      data: [
        { path: `${RIDER}/id.jpeg`, signedUrl: "https://signed/id", error: null },
        { path: `${RIDER}/selfie.jpeg`, signedUrl: "https://signed/selfie", error: null },
      ],
      error: null,
    });

    const [signed] = await signVerificationImages(config, [
      { id: "v1", idImagePath: `${RIDER}/id.jpeg`, selfiePath: `${RIDER}/selfie.jpeg` },
    ]);

    expect(signed).toEqual({ id: "v1", idImageUrl: "https://signed/id", selfieUrl: "https://signed/selfie" });
    // The paths themselves must not leak into the response.
    expect(signed).not.toHaveProperty("idImagePath");
  });

  test("batches every row into one signing call", async () => {
    createSignedUrls.mockResolvedValue({ data: [], error: null });
    await signVerificationImages(config, [
      { idImagePath: `${RIDER}/a.jpeg`, selfiePath: `${RIDER}/b.jpeg` },
      { idImagePath: `${RIDER}/c.jpeg`, selfiePath: `${RIDER}/d.jpeg` },
    ]);
    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0]?.[0]).toHaveLength(4);
  });

  test("passes legacy absolute URLs through without signing them", async () => {
    const [signed] = await signVerificationImages(config, [
      { idImagePath: "https://placehold.co/600x400", selfiePath: "https://placehold.co/600x600" },
    ]);
    expect(signed?.idImageUrl).toBe("https://placehold.co/600x400");
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  test("returns null for an image that could not be signed rather than throwing", async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ path: `${RIDER}/id.jpeg`, signedUrl: null, error: "Object not found" }],
      error: null,
    });
    const [signed] = await signVerificationImages(config, [
      { idImagePath: `${RIDER}/id.jpeg`, selfiePath: `${RIDER}/selfie.jpeg` },
    ]);
    expect(signed?.idImageUrl).toBeNull();
    expect(signed?.selfieUrl).toBeNull();
  });

  test("a Storage outage degrades to nulls and a warning, not a failed request", async () => {
    createSignedUrls.mockResolvedValue({ data: null, error: new Error("storage unreachable") });
    const warn = vi.fn();
    const [signed] = await signVerificationImages(
      config,
      [{ idImagePath: `${RIDER}/id.jpeg`, selfiePath: `${RIDER}/selfie.jpeg` }],
      { warn },
    );
    expect(signed?.idImageUrl).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
