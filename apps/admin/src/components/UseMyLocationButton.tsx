"use client";

import { useState } from "react";
import { Button } from "./ui/Button";

/**
 * Fills a pair of coordinate fields from the device's own position.
 *
 * Checkpoint coordinates are the highest-value hour of fieldwork available
 * before launch: the rider app already navigates to an exact pin when one
 * exists, and not one checkpoint has coordinates, so every rider gets a name
 * search — which on a campus is roughly "somewhere over there".
 *
 * Typing latitude and longitude by hand is why that hour never happens. Standing
 * at the checkpoint with the admin open on a phone and pressing one button is a
 * job someone will actually do.
 *
 * Accuracy is shown rather than hidden. A phone indoors or under trees can be
 * eighty metres out, which on a campus is the wrong building — and a confidently
 * wrong pin is worse than no pin, because the rider stops looking.
 */
const GOOD_ACCURACY_M = 25;

export function UseMyLocationButton({
  onCapture,
  label = "Use my current location",
}: {
  onCapture: (latitude: number, longitude: number) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function capture() {
    setError(null);
    setAccuracy(null);

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This browser can't report a location.");
      return;
    }

    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        setAccuracy(position.coords.accuracy);
        onCapture(position.coords.latitude, position.coords.longitude);
      },
      (positionError) => {
        setBusy(false);
        // The three cases differ in what the person should do next, so they are
        // not collapsed into one message.
        setError(
          positionError.code === positionError.PERMISSION_DENIED
            ? "Location permission was refused. Allow it for this site and try again."
            : positionError.code === positionError.POSITION_UNAVAILABLE
              ? "No position available. Step outside and try again."
              : "Took too long to get a position. Try again.",
        );
      },
      // enableHighAccuracy asks for GPS rather than a wifi/IP estimate, which is
      // the difference between a usable pin and one that lands on the campus in
      // general. maximumAge 0 refuses a cached fix from wherever the phone was
      // last, which would otherwise silently pin the previous checkpoint.
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  return (
    <div>
      <Button label={busy ? "Getting position…" : label} onClick={capture} disabled={busy} />
      {accuracy !== null ? (
        <p
          className={`mt-1.5 text-[12px] ${
            accuracy > GOOD_ACCURACY_M ? "text-warning-text" : "text-muted"
          }`}
        >
          {accuracy > GOOD_ACCURACY_M
            ? `Accurate to about ${Math.round(accuracy)}m — that may be the wrong building. Step outside and press it again.`
            : `Accurate to about ${Math.round(accuracy)}m.`}
        </p>
      ) : null}
      {error ? <p className="mt-1.5 text-[12px] text-danger-text">{error}</p> : null}
    </div>
  );
}
