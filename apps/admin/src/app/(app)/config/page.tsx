"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Button } from "../../../components/ui/Button";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { FeatureFlags } from "../../../components/FeatureFlags";
import { ServiceSwitches } from "../../../components/ServiceSwitches";
import { ZoneFees } from "../../../components/ZoneFees";

interface ConfigRow {
  key: string;
  value: string;
  description: string | null;
  updatedAt?: string;
}

/**
 * The keys the platform actually reads, grouped for display. Anything seeded but
 * not listed here still round-trips — it just renders under "Other".
 */
const GROUPS: { title: string; keys: { key: string; label: string; suffix?: string; hint: string }[] }[] = [
  {
    title: "Pricing",
    keys: [
      {
        key: "delivery_fee_base",
        label: "Base delivery fee",
        suffix: "GH₵",
        hint: "Used when an order has no package size (older app, suggested shop). A zone add-on is added on top.",
      },
    ],
  },
  {
    title: "Package sizes",
    keys: [
      { key: "size_price_ripple", label: "Ripple", suffix: "GH₵", hint: "Price before the zone add-on." },
      { key: "size_price_wave", label: "Wave", suffix: "GH₵", hint: "Price before the zone add-on." },
      { key: "size_price_swell", label: "Swell", suffix: "GH₵", hint: "Price before the zone add-on." },
      { key: "size_price_tide", label: "Tide", suffix: "GH₵", hint: "Price before the zone add-on." },
    ],
  },
  {
    title: "Loyalty",
    keys: [
      {
        key: "loyalty_discount_pct",
        label: "Loyalty discount",
        suffix: "%",
        hint: "Off the delivery fee once the threshold is met.",
      },
      {
        key: "loyalty_threshold",
        label: "Deliveries required",
        hint: "Completed deliveries before the discount unlocks.",
      },
    ],
  },
  {
    title: "Safety limits",
    keys: [
      {
        key: "goods_cost_max_ghs",
        label: "Max goods total",
        suffix: "GH₵",
        hint: "Largest till total a rider may record on a suggested-shop order. Above this they are asked to re-check rather than charging the student.",
      },
    ],
  },
  {
    title: "Payouts",
    keys: [
      {
        key: "rider_earning_pct",
        label: "Rider share of the delivery fee",
        suffix: "%",
        hint: "Credited to the rider when a delivery is closed with the student's PIN. Applied to the standard fee, so a student's loyalty discount does not reduce what the rider earns.",
      },
    ],
  },
];

// Retired 2026-11-04 when every day became a delivery day: no rush orders, so
// no surcharge or lead time. Rows may still exist in the table; keep them off
// the page so nobody edits a setting that does nothing.
const RETIRED_KEYS = ["special_order_surcharge_pct", "special_order_lead_hours"];
const KNOWN_KEYS = [...GROUPS.flatMap((g) => g.keys.map((k) => k.key)), ...RETIRED_KEYS];

export default function ConfigPage() {
  const { accessToken, can } = useAdminAuth();
  const canEdit = can("config.write");
  const [rows, setRows] = useState<ConfigRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    apiFetch<{ config: ConfigRow[] }>("/admin/config", accessToken)
      .then((res) => {
        setRows(res.config);
        // Seed the form only when it is untouched. This effect re-runs whenever
        // `accessToken` changes identity, and Supabase mints a new token on its
        // hourly refresh (and on tab focus) — which used to overwrite whatever
        // the admin had typed, revert the field and re-disable Save with no
        // indication at all that their edit had been thrown away.
        setDraft((current) =>
          Object.keys(current).length === 0
            ? Object.fromEntries(res.config.map((r) => [r.key, r.value]))
            : current,
        );
      })
      .catch(() => {
        setRows([]);
        setError("Could not load platform config. Check your connection and try again.");
      });
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const dirtyKeys = rows
    ? rows.filter((r) => draft[r.key] !== undefined && draft[r.key] !== r.value).map((r) => r.key)
    : [];

  async function handleSave() {
    if (!accessToken || dirtyKeys.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      // PUT /config upserts a single key, so a multi-field save is one call per
      // changed key. Only changed keys are sent.
      for (const key of dirtyKeys) {
        await apiFetch("/admin/config", accessToken, {
          method: "PUT",
          body: JSON.stringify({ key, value: draft[key] }),
        });
      }
      setSavedAt(new Date().toLocaleString());
      // Clear the draft so the reload below re-seeds it: `load` now refuses to
      // overwrite a non-empty draft, and the server may normalise what it
      // stored ("20" -> "20.00"), which would otherwise leave the form showing
      // unsaved changes forever.
      setDraft({});
      load();
    } catch (err) {
      // The API validates these now — a mistyped fee is a 400 naming the field.
      // Swallowing it would leave the admin looking at their own bad value with
      // no indication it was refused, which is worse than the old behaviour of
      // accepting it. `load()` is deliberately not called: the draft is kept so
      // the number can be corrected rather than silently reverted.
      setSaveError(errorMessage(err, "Could not save. Check the values and try again."));
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!rows) return;
    setDraft(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }

  const other = rows?.filter((r) => !KNOWN_KEYS.includes(r.key)) ?? [];
  const SIZES = [
    { key: "size_price_ripple", name: "Ripple" },
    { key: "size_price_wave", name: "Wave" },
    { key: "size_price_swell", name: "Swell" },
    { key: "size_price_tide", name: "Tide" },
  ];
  const input = (key: string, prefix?: string, suffix?: string) => (
    <div className="flex h-10 w-[130px] items-center gap-1 rounded-control border-2 border-line bg-surface px-3 focus-within:border-ink">
      {prefix ? <span className="text-[13px] text-muted">{prefix}</span> : null}
      <input
        id={key}
        aria-label={key.replace(/_/g, " ")}
        value={draft[key] ?? ""}
        onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
        readOnly={!canEdit}
        inputMode="decimal"
        className="min-w-0 flex-1 bg-transparent text-[14px] font-bold text-ink outline-none"
      />
      {suffix ? <span className="text-[13px] text-muted">{suffix}</span> : null}
    </div>
  );
  const row = (label: string, control: React.ReactNode, hint?: string) => (
    <div className="flex items-center justify-between gap-4 border-b border-border/70 py-3 last:border-b-0">
      <div>
        <p className="text-[14px] text-ink">{label}</p>
        {hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
      </div>
      {control}
    </div>
  );

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Config"
        subtitle="Prices, schedule and services. Changes apply to new orders only."
        action={
          canEdit ? (
            <div className="flex items-center gap-2">
              {dirtyKeys.length > 0 ? (
                <Button label="Discard" variant="secondary" onClick={handleDiscard} disabled={saving} />
              ) : null}
              <Button
                label={saving ? "Saving" : "Save changes"}
                onClick={handleSave}
                disabled={saving || dirtyKeys.length === 0}
              />
            </div>
          ) : null
        }
      />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}
      {saveError ? (
        <p role="alert" className="mb-5 rounded-control border border-danger-border bg-danger-bg px-4 py-3 text-[13px] text-danger-text">
          {saveError}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-[13.5px] text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-[1fr_380px] gap-6">
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 text-[15px] font-bold text-ink">Package sizes</h2>
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                <table className="w-full text-left text-[13.5px]">
                  <thead>
                    <tr className="border-b border-border text-[12.5px] font-bold text-ink">
                      <th className="h-10 px-4">Size</th>
                      <th className="h-10 px-4">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SIZES.map((sz) => (
                      <tr key={sz.key} className="border-b border-border/70 last:border-b-0">
                        <td className="h-14 px-4 font-bold text-ink">{sz.name}</td>
                        <td className="px-4">{input(sz.key, "GH₵")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[12px] text-muted">Before the pickup zone add-on.</p>
            </section>

            <section>
              <h2 className="mb-3 text-[15px] font-bold text-ink">Discounts</h2>
              <div className="rounded-card border border-border bg-surface px-4">
                {row("Loyalty discount", input("loyalty_discount_pct", undefined, "%"), "Off the delivery fee only")}
                {row("Deliveries before it unlocks", input("loyalty_threshold"))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-[15px] font-bold text-ink">Pricing and payouts</h2>
              <div className="rounded-card border border-border bg-surface px-4">
                {row("Base delivery fee", input("delivery_fee_base", "GH₵"), "When an order has no size")}
                {row("Rider share of the fee", input("rider_earning_pct", undefined, "%"), "Paid when the student's code closes the delivery")}
                {row("Max goods total", input("goods_cost_max_ghs", "GH₵"), "Suggested-shop till limit")}
                {other.map((r) => row(r.description ?? r.key, input(r.key)))}
              </div>
              {!canEdit ? <p className="mt-2 text-[12.5px] text-muted">Your role can see pricing but not change it.</p> : null}
              <p className="mt-2 text-[12px] text-muted">
                {dirtyKeys.length > 0
                  ? `${dirtyKeys.length} unsaved ${dirtyKeys.length === 1 ? "change" : "changes"}.`
                  : savedAt
                    ? `Last saved ${savedAt}.`
                    : "No unsaved changes."}
              </p>
            </section>
          </div>

          <aside className="space-y-6">
            <section>
              <h2 className="mb-3 text-[15px] font-bold text-ink">Services</h2>
              <ServiceSwitches />
            </section>
            <section>
              <h2 className="mb-3 text-[15px] font-bold text-ink">Schedule</h2>
              <div className="rounded-card border border-border bg-surface px-4">
                {row("Delivery days", <span className="text-[14px] font-bold text-ink">Every day</span>)}
                {row("Order cutoff", <span className="text-[14px] font-bold text-ink">12 noon</span>)}
              </div>
            </section>
          </aside>
        </div>
      )}

      <div className="mt-8">
        <ZoneFees />
      </div>

      <div className="mt-8">
        <FeatureFlags />
      </div>
    </div>
  );
}
