"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Button } from "../../../components/ui/Button";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";

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
        hint: "Applied to every order.",
      },
      {
        key: "special_order_surcharge_pct",
        label: "Special order surcharge",
        suffix: "%",
        hint: "Added to the delivery fee for special orders.",
      },
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
    title: "Scheduling",
    keys: [
      {
        key: "special_order_lead_hours",
        label: "Special order lead time",
        suffix: "hours",
        hint: "Minimum notice before a special order's delivery date.",
      },
    ],
  },
];

const KNOWN_KEYS = GROUPS.flatMap((g) => g.keys.map((k) => k.key));

export default function ConfigPage() {
  const { accessToken } = useAdminAuth();
  const [rows, setRows] = useState<ConfigRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    apiFetch<{ config: ConfigRow[] }>("/admin/config", accessToken)
      .then((res) => {
        setRows(res.config);
        setDraft(Object.fromEntries(res.config.map((r) => [r.key, r.value])));
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
      load();
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (!rows) return;
    setDraft(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }

  const other = rows?.filter((r) => !KNOWN_KEYS.includes(r.key)) ?? [];

  return (
    <div className="px-10 py-8">
      <PageHeader title="Config" subtitle="Platform pricing and scheduling" />

      <div className="mb-7 flex max-w-[720px] gap-3 rounded-control bg-wave-lime p-4">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="9" stroke="#009933" strokeWidth="1.7" />
          <path d="M12 11v5.5M12 7.8v.4" stroke="#009933" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
        <p className="text-[12.5px] leading-5 text-wave-500">
          Changes apply to <strong className="font-semibold">new orders only</strong>. Orders already
          placed keep the fee, discount and surcharge they were created with.
        </p>
      </div>

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      {rows === null ? (
        <p className="text-[13.5px] text-muted">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-10">
            {GROUPS.map((group) => (
              <div key={group.title} className="min-w-[300px] flex-1">
                <h2 className="mb-[18px] text-[17px] font-semibold text-ink">{group.title}</h2>
                {group.keys.map((f) => (
                  <div key={f.key} className="mb-5">
                    <label className="mb-2 block text-[12.5px] font-medium text-muted" htmlFor={f.key}>
                      {f.label}
                    </label>
                    <div className="flex h-[46px] max-w-[320px] items-center gap-2 rounded-control border border-border bg-surface px-4 focus-within:border-wave-500">
                      {f.suffix === "GH₵" ? <span className="text-[14px] text-muted">GH₵</span> : null}
                      <input
                        id={f.key}
                        value={draft[f.key] ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        inputMode="decimal"
                        className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
                      />
                      {f.suffix && f.suffix !== "GH₵" ? (
                        <span className="text-[14px] text-muted">{f.suffix}</span>
                      ) : null}
                    </div>
                    <p className="mt-[7px] text-[11.5px] text-muted">{f.hint}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {other.length > 0 ? (
            <div className="mt-2">
              <h2 className="mb-[18px] text-[17px] font-semibold text-ink">Other</h2>
              {other.map((r) => (
                <div key={r.key} className="mb-5">
                  <label className="mb-2 block text-[12.5px] font-medium text-muted" htmlFor={r.key}>
                    {r.description ?? r.key}
                  </label>
                  <input
                    id={r.key}
                    value={draft[r.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value }))}
                    className="h-[46px] w-full max-w-[320px] rounded-control border border-border bg-surface px-4 text-[14px] text-ink outline-none focus:border-wave-500"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex gap-3">
            <Button
              label={saving ? "Saving…" : "Save changes"}
              onClick={handleSave}
              disabled={saving || dirtyKeys.length === 0}
            />
            <Button
              label="Discard"
              variant="secondary"
              onClick={handleDiscard}
              disabled={saving || dirtyKeys.length === 0}
            />
          </div>

          <p className="mt-[22px] text-[12px] text-muted">
            {dirtyKeys.length > 0
              ? `${dirtyKeys.length} unsaved ${dirtyKeys.length === 1 ? "change" : "changes"}.`
              : savedAt
                ? `Last saved ${savedAt}.`
                : "No unsaved changes."}
          </p>
        </>
      )}
    </div>
  );
}
