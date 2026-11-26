import { describe, expect, it } from "vitest";
import { parsePickupNotes } from "../pickupNotes";

describe("parsePickupNotes", () => {
  it("splits the Send flow's line back into rows", () => {
    expect(
      parsePickupNotes("Shell station, floor 2 · Landmark: Opposite Legon gate · Handover: Meet outside · Call when you arrive"),
    ).toEqual({
      building: "Shell station, floor 2",
      landmark: "Opposite Legon gate",
      handover: "Meet outside",
      instructions: "Call when you arrive",
    });
  });

  it("copes with missing parts and empty notes", () => {
    expect(parsePickupNotes("Handover: At the door")).toEqual({ building: null, landmark: null, handover: "At the door", instructions: null });
    expect(parsePickupNotes(null)).toEqual({ building: null, landmark: null, handover: null, instructions: null });
  });
});
