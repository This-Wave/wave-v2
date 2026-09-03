"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "../lib/api";
import { UseMyLocationButton } from "./UseMyLocationButton";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { TextField, FormError } from "./ui/Field";

/**
 * Put coordinates on a checkpoint that already exists.
 *
 * The create form has had latitude and longitude since checkpoints were built,
 * but every checkpoint in the pilot was created without them and there was no
 * way to add them afterwards — so the rider app's turn-by-turn navigation, which
 * is written and working, has never once been used.
 *
 * Meant to be used standing at the checkpoint on a phone, which is why the
 * capture button comes first and the number fields are a fallback rather than
 * the main event.
 */
export interface CheckpointForLocation {
  id: string;
  name: string;
  latitude: number | string | null;
  longitude: number | string | null;
}

export function SetCheckpointLocationModal({
  checkpoint,
  accessToken,
  onClose,
  onSaved,
}: {
  checkpoint: CheckpointForLocation | null;
  accessToken: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reload the fields whenever a different checkpoint is opened, or the modal
  // shows the previous one's coordinates.
  useEffect(() => {
    setLatitude(checkpoint?.latitude != null ? String(checkpoint.latitude) : "");
    setLongitude(checkpoint?.longitude != null ? String(checkpoint.longitude) : "");
    setError(null);
  }, [checkpoint]);

  const bothBlank = !latitude.trim() && !longitude.trim();
  const partlyFilled = !!latitude.trim() !== !!longitude.trim();
  const invalid =
    (latitude.trim() !== "" && Number.isNaN(Number(latitude))) ||
    (longitude.trim() !== "" && Number.isNaN(Number(longitude)));
  // A pin outside these ranges is a typo, and it would send a rider off-planet
  // rather than merely to the wrong building.
  const outOfRange =
    !bothBlank &&
    !invalid &&
    (Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180);

  async function save() {
    if (!accessToken || !checkpoint || partlyFilled || invalid || outOfRange) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/checkpoints/${checkpoint.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          latitude: bothBlank ? undefined : Number(latitude),
          longitude: bothBlank ? undefined : Number(longitude),
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!checkpoint}
      title={checkpoint ? `Location — ${checkpoint.name}` : "Location"}
      description="Riders get turn-by-turn directions to a checkpoint that has a pin."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button label="Cancel" variant="secondary" disabled={saving} onClick={onClose} />
          <Button
            label={saving ? "Saving…" : "Save location"}
            disabled={saving || partlyFilled || invalid || outOfRange || bothBlank}
            onClick={save}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />

        <p className="text-[13px] text-muted">
          Stand where a rider should hand the order over, then press the button. Riders get
          turn-by-turn directions to a checkpoint that has a pin, and a name search to one that
          doesn&apos;t.
        </p>

        <UseMyLocationButton
          onCapture={(lat, lng) => {
            setLatitude(lat.toFixed(6));
            setLongitude(lng.toFixed(6));
          }}
          label="I'm standing here"
        />

        <div className="flex gap-3">
          <div className="flex-1">
            <TextField label="Latitude" value={latitude} onChange={setLatitude} inputMode="decimal" />
          </div>
          <div className="flex-1">
            <TextField label="Longitude" value={longitude} onChange={setLongitude} inputMode="decimal" />
          </div>
        </div>

        {partlyFilled ? (
          <p className="text-[12px] text-warning-text">
            Enter both coordinates or neither — one on its own cannot place a pin.
          </p>
        ) : null}
        {invalid ? <p className="text-[12px] text-danger-text">Coordinates must be numbers.</p> : null}
        {outOfRange ? (
          <p className="text-[12px] text-danger-text">
            That is not a real place. Latitude is −90 to 90, longitude −180 to 180.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
