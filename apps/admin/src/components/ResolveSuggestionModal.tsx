"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "../lib/api";
import { Modal } from "./ui/Modal";
import { Button } from "./ui/Button";
import { SelectField, FormError } from "./ui/Field";
import type { Suggestion } from "../app/(app)/suggestions/page";

interface Shop {
  id: string;
  name: string;
  universityId: string;
}

/**
 * Links a suggested place to a shop that now exists on Wave.
 *
 * Resolving is a fan-out, not a single edit: every student who asked for this
 * place gets their suggestion marked onboarded and is emailed and pushed. The
 * dialog says how many people that is before the button is pressed, because
 * "notify 14 students" and "notify 1 student" deserve different amounts of care.
 *
 * Only shops on the same campus are offered — the API rejects a cross-campus
 * link, and offering one here would just produce a 400 the admin can't act on.
 */
export function ResolveSuggestionModal({
  suggestion,
  accessToken,
  onClose,
  onResolved,
}: {
  suggestion: Suggestion | null;
  accessToken: string | null;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [shopId, setShopId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!suggestion || !accessToken) return;
    setShopId("");
    setError(null);
    setLoadError(null);
    apiFetch<{ shops: Shop[] }>("/admin/shops", accessToken)
      .then((res) => setShops(res.shops.filter((s) => s.universityId === suggestion.universityId)))
      .catch(() => {
        setShops([]);
        setLoadError("Could not load shops for this campus.");
      });
  }, [suggestion, accessToken]);

  async function handleResolve() {
    if (!accessToken || !suggestion || !shopId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/admin/shop-suggestions/resolve", accessToken, {
        method: "POST",
        body: JSON.stringify({
          normalizedName: suggestion.normalizedName,
          universityId: suggestion.universityId,
          shopId,
        }),
      });
      onResolved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!suggestion}
      title={`Onboard ${suggestion?.displayName ?? ""}`}
      description={
        suggestion
          ? `${suggestion.students} student${
              suggestion.students === 1 ? "" : "s"
            } asked for this place. Linking it to a shop tells all of them it's live.`
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label={saving ? "Onboarding…" : "Onboard & notify"}
            onClick={handleResolve}
            disabled={!shopId || saving}
          />
        </>
      }
    >
      <div className="grid gap-4">
        <SelectField
          label="Which shop is this?"
          value={shopId}
          onChange={setShopId}
          required
          options={(shops ?? []).map((s) => ({ value: s.id, label: s.name }))}
          placeholder={
            shops === null
              ? "Loading shops…"
              : shops.length === 0
                ? "No shops on this campus yet"
                : "Select a shop"
          }
          hint={
            shops?.length === 0
              ? "Create the shop on the Shops page first, then come back here to link it."
              : `${suggestion?.locationText ?? "No location was given"} — use this to check it's the right place.`
          }
        />

        <FormError message={loadError ?? error} />
      </div>
    </Modal>
  );
}
