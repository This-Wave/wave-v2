import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Linking, Platform } from "react-native";
import { openCheckpointInMaps, openMapsAt, openMapsSearch } from "../maps";

/**
 * Checkpoint navigation (review 11-campus, H3).
 *
 * The coordinate guards matter more than the URL formats: a null coerced to 0
 * produces `0,0`, which is a real place in the Gulf of Guinea about 500km off
 * the coast. Sending a rider there silently is worse than not offering
 * navigation at all, so bad input must fail visibly rather than open a map.
 */
const CHECKPOINT = { name: "Quad", latitude: "5.759480", longitude: "-0.220120" };

beforeEach(() => {
  vi.spyOn(Linking, "canOpenURL").mockResolvedValue(true);
  vi.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
  (Platform as { OS: string }).OS = "ios";
});

afterEach(() => {
  vi.restoreAllMocks();
  (Platform as { OS: string }).OS = "ios";
});

describe("openMapsAt — coordinate guards", () => {
  test.each([
    ["null island", 0, 0],
    ["NaN latitude", Number.NaN, -0.22],
    ["NaN longitude", 5.75, Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY, 0.5],
    ["latitude above 90", 91, 0],
    ["latitude below -90", -91, 0],
    ["longitude above 180", 0, 181],
    ["longitude below -180", 0, -181],
  ])("refuses %s and opens nothing", async (_label, lat, lng) => {
    expect(await openMapsAt(lat, lng)).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  test("accepts a real Ashesi coordinate", async () => {
    expect(await openMapsAt(5.75948, -0.22012, "Quad")).toBe(true);
    expect(Linking.openURL).toHaveBeenCalled();
  });

  test("includes the coordinate in the url", async () => {
    await openMapsAt(5.75948, -0.22012, "Quad");
    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toContain("5.75948,-0.22012");
  });

  test("labels the pin", async () => {
    await openMapsAt(5.75948, -0.22012, "Hostel Gate");
    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toContain("Hostel%20Gate");
  });

  test("falls back to a web url when no native scheme opens", async () => {
    vi.mocked(Linking.canOpenURL).mockResolvedValue(false);

    expect(await openMapsAt(5.75948, -0.22012)).toBe(true);
    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toContain("google.com/maps");
  });

  test("uses the android geo scheme on android", async () => {
    (Platform as { OS: string }).OS = "android";

    await openMapsAt(5.75948, -0.22012, "Quad");

    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toMatch(/^geo:/);
  });

  test("reports failure rather than throwing when everything fails", async () => {
    vi.mocked(Linking.canOpenURL).mockResolvedValue(false);
    vi.mocked(Linking.openURL).mockRejectedValue(new Error("no handler"));

    await expect(openMapsAt(5.75948, -0.22012)).resolves.toBe(false);
  });
});

describe("openCheckpointInMaps", () => {
  test("drops a pin when coordinates are recorded", async () => {
    await openCheckpointInMaps(CHECKPOINT);

    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toContain("5.75948");
  });

  test("searches by name when coordinates are missing", async () => {
    // The normal case today — most checkpoints have no coordinates until
    // someone walks the campus with the admin screen open.
    await openCheckpointInMaps({ name: "Quad", latitude: null, longitude: null });

    const url = vi.mocked(Linking.openURL).mock.calls[0]![0];
    expect(url).toContain("Quad");
    expect(url).not.toContain("5.75948");
  });

  test("searches by name when only one coordinate is present", async () => {
    await openCheckpointInMaps({ name: "Quad", latitude: "5.75948", longitude: null });

    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toContain("Quad");
  });

  test("falls back to a search when the coordinates are nonsense", async () => {
    // Bad data must degrade to the old behaviour, not to nothing.
    await openCheckpointInMaps({ name: "Quad", latitude: "0", longitude: "0" });

    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toContain("Quad");
  });

  test("falls back to a search when the coordinates are not numbers", async () => {
    await openCheckpointInMaps({ name: "Quad", latitude: "n/a", longitude: "n/a" });

    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toContain("Quad");
  });
});

describe("openMapsSearch", () => {
  test("refuses an empty query", async () => {
    expect(await openMapsSearch("   ")).toBe(false);
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  test("encodes the query", async () => {
    await openMapsSearch("Berekuso Main Road");
    expect(vi.mocked(Linking.openURL).mock.calls[0]![0]).toContain("Berekuso%20Main%20Road");
  });
});
