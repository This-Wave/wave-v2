"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "../lib/api";
import { UseMyLocationButton } from "./UseMyLocationButton";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { TextField, SelectField, FormError } from "./ui/Field";

interface University {
  id: string;
  name: string;
}

export function CreateCheckpointModal({
  open,
  accessToken,
  onClose,
  onCreated,
}: {
  open: boolean;
  accessToken: string | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !accessToken) return;
    setLoadError(null);
    apiFetch<{ universities: University[] }>("/universities", accessToken)
      .then((res) => {
        setUniversities(res.universities);
        if (res.universities.length === 1) setUniversityId(res.universities[0]!.id);
      })
      .catch(() => {
        setUniversities([]);
        setLoadError("Could not load universities.");
      });
  }, [open, accessToken]);

  function reset() {
    setName("");
    setDescription("");
    setLatitude("");
    setLongitude("");
    setError(null);
  }

  async function handleSubmit() {
    if (!accessToken || !universityId || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/checkpoints", accessToken, {
        method: "POST",
        body: JSON.stringify({
          universityId,
          name: name.trim(),
          description: description.trim() || undefined,
          // The API takes numbers, and an empty box must stay absent rather
          // than becoming 0 — which is a real coordinate off the coast of Ghana.
          latitude: latitude.trim() ? Number(latitude) : undefined,
          longitude: longitude.trim() ? Number(longitude) : undefined,
        }),
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not create the checkpoint."));
    } finally {
      setSaving(false);
    }
  }

  const coordsPartlyFilled = !!latitude.trim() !== !!longitude.trim();
  const coordsInvalid =
    (latitude.trim() !== "" && Number.isNaN(Number(latitude))) ||
    (longitude.trim() !== "" && Number.isNaN(Number(longitude)));
  const canSubmit =
    !!universityId && name.trim().length > 0 && !coordsPartlyFilled && !coordsInvalid && !saving;

  return (
    <Modal
      open={open}
      title="Add checkpoint"
      description="A campus drop-off point that students choose at checkout and riders deliver to."
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button
            label="Cancel"
            variant="secondary"
            disabled={saving}
            onClick={() => {
              reset();
              onClose();
            }}
          />
          <Button
            label={saving ? "Creating…" : "Create checkpoint"}
            disabled={!canSubmit}
            onClick={handleSubmit}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={loadError ?? error} />
        <SelectField
          label="University"
          required
          value={universityId}
          onChange={setUniversityId}
          options={universities.map((u) => ({ value: u.id, label: u.name }))}
          placeholder={universities.length === 0 ? "No universities found" : "Select a university"}
        />
        <TextField
          label="Name"
          required
          value={name}
          onChange={setName}
          placeholder="e.g. Ashesi Quad"
        />
        <TextField
          label="Location detail"
          value={description}
          onChange={setDescription}
          placeholder="e.g. Main quad, next to the flagpole"
          multiline
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <TextField
              label="Latitude"
              value={latitude}
              onChange={setLatitude}
              placeholder="5.7594"
              inputMode="decimal"
            />
          </div>
          <div className="flex-1">
            <TextField
              label="Longitude"
              value={longitude}
              onChange={setLongitude}
              placeholder="-0.2196"
              inputMode="decimal"
            />
          </div>
        </div>
        <UseMyLocationButton
          onCapture={(lat, lng) => {
            // Six decimal places is roughly 0.1m — well past what a phone can
            // actually resolve, and it matches the Decimal(9,6) the column holds.
            setLatitude(lat.toFixed(6));
            setLongitude(lng.toFixed(6));
          }}
        />
        {coordsPartlyFilled ? (
          <p className="text-[12px] text-warning-text">
            Enter both coordinates or neither — one on its own cannot place a pin.
          </p>
        ) : null}
        {coordsInvalid ? <p className="text-[12px] text-danger-text">Coordinates must be numbers.</p> : null}
      </div>
    </Modal>
  );
}
