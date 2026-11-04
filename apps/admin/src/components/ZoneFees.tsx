"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../lib/api";
import { Button } from "./ui/Button";
import { FetchErrorBanner } from "./FetchErrorBanner";

interface Zone {
  id: string;
  code: string;
  name: string;
  city: string;
  deliveryFee: string;
  isActive: boolean;
}

/**
 * The Accra pickup zones and what each costs.
 *
 * A pickup collected in a zone is charged the zone's fee instead of the base
 * fee. Zones are city-wide, so every campus reads the same fee — which is why
 * only HQ (`config.write`) may change them. Saved one row at a time: each is a
 * separate price, and a half-saved batch would be harder to reason about.
 */
export function ZoneFees() {
  const { accessToken, can } = useAdminAuth();
  const canEdit = can("config.write");
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    apiFetch<{ zones: Zone[] }>("/admin/zones", accessToken)
      .then((res) => {
        setZones(res.zones);
        setDraft((current) =>
          Object.keys(current).length === 0
            ? Object.fromEntries(res.zones.map((z) => [z.id, Number(z.deliveryFee).toFixed(2)]))
            : current,
        );
      })
      .catch(() => {
        setZones([]);
        setError("Could not load zones. Check your connection and try again.");
      });
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(zone: Zone, patch: { deliveryFee?: number; isActive?: boolean }) {
    if (!accessToken) return;
    setSavingId(zone.id);
    setError(null);
    try {
      const res = await apiFetch<{ zone: Zone }>(`/admin/zones/${zone.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setZones((list) => list?.map((z) => (z.id === zone.id ? res.zone : z)) ?? null);
      setDraft((d) => ({ ...d, [zone.id]: Number(res.zone.deliveryFee).toFixed(2) }));
    } catch (e) {
      setError(errorMessage(e, "Could not save that zone. Try again."));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section className="max-w-[720px]">
      <h2 className="mb-1 text-[17px] font-semibold text-ink">Accra zones</h2>
      <p className="mb-[18px] text-[12.5px] text-muted">
        A pickup collected in a zone costs that zone&rsquo;s fee instead of the base fee. Deliveries
        always end at a campus checkpoint.
      </p>
      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}
      {zones === null ? (
        <p className="text-[13.5px] text-muted">Loading…</p>
      ) : zones.length === 0 ? (
        <p className="text-[13.5px] text-muted">No zones yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {zones.map((z) => {
            const value = draft[z.id] ?? "";
            const dirty = Number(value) !== Number(z.deliveryFee);
            const busy = savingId === z.id;
            return (
              <li key={z.id} className="flex items-center gap-4 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wave-lime text-[12.5px] font-semibold text-ink">
                  {z.code}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{z.name}</p>
                  <p className="text-[11.5px] text-muted">
                    {z.city}
                    {z.isActive ? "" : " · not collecting"}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`zone-${z.id}`}>
                  {`Fee for zone ${z.code}`}
                </label>
                <div className="flex h-[40px] w-[130px] items-center gap-2 rounded-control border border-border bg-canvas px-3 focus-within:border-wave-500">
                  <span className="text-[13px] text-muted">GH₵</span>
                  <input
                    id={`zone-${z.id}`}
                    value={value}
                    readOnly={!canEdit}
                    inputMode="decimal"
                    onChange={(e) => setDraft((d) => ({ ...d, [z.id]: e.target.value }))}
                    className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
                  />
                </div>
                {canEdit ? (
                  <>
                    <Button
                      label={busy ? "Saving…" : "Save"}
                      onClick={() => save(z, { deliveryFee: Number(value) })}
                      disabled={busy || !dirty || !Number.isFinite(Number(value))}
                    />
                    <Button
                      label={z.isActive ? "Stop" : "Resume"}
                      variant="secondary"
                      onClick={() => save(z, { isActive: !z.isActive })}
                      disabled={busy}
                    />
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
