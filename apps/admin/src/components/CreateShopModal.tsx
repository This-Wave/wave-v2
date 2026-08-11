"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "../lib/api";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { TextField, SelectField, FormError } from "./ui/Field";

interface University {
  id: string;
  name: string;
}

interface Owner {
  id: string;
  fullName: string;
  phone: string;
}

export function CreateShopModal({
  open,
  accessToken,
  onClose,
  onCreated,
  existingCategories,
}: {
  open: boolean;
  accessToken: string | null;
  onClose: () => void;
  onCreated: () => void;
  /**
   * Categories already in use. `Shop.category` is free text and the mobile
   * shop-picker builds its filter rail from the distinct values it finds, so a
   * typo silently creates a new one-shop category. Suggesting what exists keeps
   * the rail tidy without inventing a taxonomy the schema doesn't have.
   */
  existingCategories: string[];
}) {
  const [universities, setUniversities] = useState<University[]>([]);
  const [owners, setOwners] = useState<Owner[] | null>(null);
  const [universityId, setUniversityId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [locationText, setLocationText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !accessToken) return;
    apiFetch<{ universities: University[] }>("/universities", accessToken)
      .then((res) => {
        setUniversities(res.universities);
        if (res.universities.length === 1) setUniversityId(res.universities[0]!.id);
      })
      .catch(() => setUniversities([]));
    // The API rejects an owner without the shop_owner role, so only offer those.
    apiFetch<{ users: Owner[] }>("/admin/users?role=shop_owner", accessToken)
      .then((res) => setOwners(res.users))
      .catch(() => setOwners([]));
  }, [open, accessToken]);

  function reset() {
    setName("");
    setDescription("");
    setPhone("");
    setLocationText("");
    setOwnerId("");
    setCategory("");
    setError(null);
  }

  async function handleSubmit() {
    if (!accessToken || !universityId || !ownerId || !name.trim() || !category.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/admin/shops", accessToken, {
        method: "POST",
        body: JSON.stringify({
          universityId,
          ownerId,
          name: name.trim(),
          category: category.trim(),
          description: description.trim() || undefined,
          phone: phone.trim() || undefined,
          locationText: locationText.trim() || undefined,
        }),
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not create the shop."));
    } finally {
      setSaving(false);
    }
  }

  const noOwners = owners !== null && owners.length === 0;
  const canSubmit =
    !!universityId && !!ownerId && name.trim().length > 0 && category.trim().length > 0 && !saving;

  return (
    <Modal
      open={open}
      title="Add shop"
      description="Creates the storefront on an existing shop-owner account. The owner maintains its products themselves."
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
          <Button label={saving ? "Creating…" : "Create shop"} disabled={!canSubmit} onClick={handleSubmit} />
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormError message={error} />
        <SelectField
          label="Owner"
          required
          value={ownerId}
          onChange={setOwnerId}
          options={(owners ?? []).map((o) => ({ value: o.id, label: `${o.fullName} · ${o.phone}` }))}
          placeholder={
            owners === null ? "Loading owners…" : noOwners ? "No shop-owner accounts" : "Select an owner"
          }
          hint={
            noOwners
              ? "A shop needs an owner with the shop_owner role. Promote a user on the Users page first."
              : undefined
          }
        />
        <SelectField
          label="University"
          required
          value={universityId}
          onChange={setUniversityId}
          options={universities.map((u) => ({ value: u.id, label: u.name }))}
          placeholder={universities.length === 0 ? "No universities found" : "Select a university"}
        />
        <TextField label="Name" required value={name} onChange={setName} placeholder="e.g. Mama Put Kitchen" />
        <TextField
          label="Category"
          required
          value={category}
          onChange={setCategory}
          placeholder="e.g. food"
          suggestions={existingCategories}
          hint={
            existingCategories.length > 0
              ? "Reuse an existing category where you can — students filter shops by it."
              : undefined
          }
        />
        <TextField
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="What the shop sells"
          multiline
        />
        <TextField
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="+233201234567"
          inputMode="tel"
        />
        <TextField
          label="Location"
          value={locationText}
          onChange={setLocationText}
          placeholder="e.g. Berekuso Town Center"
        />
      </div>
    </Modal>
  );
}
