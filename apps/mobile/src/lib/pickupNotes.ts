/**
 * Pickup notes are stored as one line, " · "-joined, by the Send flow:
 *   "<building, floor x> · Landmark: <..> · Handover: <..> · <instructions>"
 * This splits them back into the rows the rider canvas shows.
 */
export interface PickupDetails {
  building: string | null;
  landmark: string | null;
  handover: string | null;
  instructions: string | null;
}

export function parsePickupNotes(notes?: string | null): PickupDetails {
  const out: PickupDetails = { building: null, landmark: null, handover: null, instructions: null };
  if (!notes) return out;
  const parts = notes.split(" · ").map((p) => p.trim()).filter(Boolean);
  const rest: string[] = [];
  parts.forEach((p, i) => {
    const m = /^(Landmark|Handover):\s*(.*)$/i.exec(p);
    if (m) {
      if (m[1]!.toLowerCase() === "landmark") out.landmark = m[2] || null;
      else out.handover = m[2] || null;
    } else if (i === 0) {
      out.building = p;
    } else {
      rest.push(p);
    }
  });
  out.instructions = rest.join(" · ") || null;
  return out;
}
