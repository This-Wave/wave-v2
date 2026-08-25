import { describe, expect, test, vi, beforeEach } from "vitest";

// vi.hoisted so the mock factory below (which vitest lifts above the imports)
// can reference this without a temporal-dead-zone error. The alternative,
// top-level `await import(...)`, is not valid under this package's CommonJS
// target and fails `npm run type-check`.
const { createSignedUrls, remove } = vi.hoisted(() => ({
  createSignedUrls: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ storage: { from: () => ({ createSignedUrls, remove }) } }),
}));

import { deleteVerificationImages, ownsVerificationPath, signVerificationImages } from "../images";

const config = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-role" };
const RIDER = "4e45b6f3-0da4-446b-a547-2cf8138028e0";

beforeEach(() => {
  createSignedUrls.mockReset();
  remove.mockReset().mockResolvedValue({ error: null });
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

/**
 * Rejected applicants' ID photographs are deleted immediately (review
 * 07-privacy, H1; retention decision 2026-08-25). There is no reason to hold a
 * government ID belonging to someone you declined, and this is the most
 * sensitive data Wave stores.
 */
describe("deleteVerificationImages", () => {
  const row = {
    idImagePath: `${RIDER}/id-1730000000000.jpeg`,
    selfiePath: `${RIDER}/selfie-1730000000000.jpeg`,
  };

  test("removes both objects in one call", async () => {
    const result = await deleteVerificationImages(config, row);

    expect(remove).toHaveBeenCalledWith([row.idImagePath, row.selfiePath]);
    expect(result).toEqual({ deleted: true });
  });

  test("reports failure rather than throwing when storage errors", async () => {
    // The review decision must not roll back because a bucket call failed — an
    // orphaned object is recoverable by hand; a lost rejection confuses everyone.
    remove.mockResolvedValue({ error: { message: "bucket unavailable" } });
    const warn = vi.fn();

    const result = await deleteVerificationImages(config, row, { warn });

    expect(result).toEqual({ deleted: false });
    expect(warn).toHaveBeenCalled();
  });

  test("survives the storage client throwing outright", async () => {
    remove.mockRejectedValue(new Error("network down"));
    const warn = vi.fn();

    await expect(deleteVerificationImages(config, row, { warn })).resolves.toEqual({
      deleted: false,
    });
    expect(warn).toHaveBeenCalled();
  });

  test("skips legacy absolute URLs, which cannot be addressed for deletion", async () => {
    const legacy = {
      idImagePath: "https://example.supabase.co/storage/v1/object/public/verifications/x.jpg",
      selfiePath: "https://example.supabase.co/storage/v1/object/public/verifications/y.jpg",
    };

    const result = await deleteVerificationImages(config, legacy);

    expect(remove).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: false });
  });

  test("deletes the one real path when the other is legacy", async () => {
    const mixed = { idImagePath: row.idImagePath, selfiePath: "https://example.com/old.jpg" };

    await deleteVerificationImages(config, mixed);

    expect(remove).toHaveBeenCalledWith([row.idImagePath]);
  });
});
