"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Button } from "../../../components/ui/Button";
import { FormError } from "../../../components/ui/Field";

/**
 * Wave's packing point (canvas board 59). The delivery company brings the
 * day's orders here; staff tick a batch "Received at Wave", pack each into a
 * Wave bag labelled with its order number, then "Packed, send to checkpoints".
 * Each step tells the students in Wave's words. Grouped by checkpoint, which
 * is the order bags go out in.
 */

interface HubOrder {
  id: string;
  ref: string;
  status: string;
  itemDescription: string;
  shop: { name: string } | null;
  suggestion: { name: string } | null;
  originCheckpoint: { name: string } | null;
  checkpoint: { id: string; name: string } | null;
  university: { name: string } | null;
  student: { fullName: string } | null;
}
interface HubDay {
  date: string;
  collecting: HubOrder[];
  packing: HubOrder[];
  ready: HubOrder[];
  delivered: HubOrder[];
}
type Stage = "collecting" | "packing" | "ready" | "delivered";

const TABS: { key: Stage; label: string }[] = [
  { key: "collecting", label: "Coming in" },
  { key: "packing", label: "Packing" },
  { key: "ready", label: "At checkpoints" },
  { key: "delivered", label: "Delivered" },
];

const ACTION: Partial<Record<Stage, { label: string; path: string }>> = {
  collecting: { label: "Received at Wave", path: "/admin/hub/received" },
  packing: { label: "Packed, send to checkpoints", path: "/admin/hub/ready" },
};

function isoDay(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function PackingPage() {
  const { accessToken, can } = useAdminAuth();
  const [offset, setOffset] = useState(0);
  const [day, setDay] = useState<HubDay | null>(null);
  const [stage, setStage] = useState<Stage>("collecting");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const date = isoDay(offset);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoadError(null);
    apiFetch<HubDay>(`/admin/hub?date=${date}`, accessToken)
      .then((d) => {
        setDay(d);
        setSelected(new Set());
      })
      .catch(() => setLoadError("Could not load the packing point."));
  }, [accessToken, date]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => day?.[stage] ?? [], [day, stage]);
  // Everything in the tab starts selected: the usual case is "all of it came in".
  useEffect(() => {
    setSelected(new Set(rows.map((r) => r.id)));
  }, [rows]);

  const groups = useMemo(() => {
    const map = new Map<string, HubOrder[]>();
    for (const r of rows) {
      const k = r.checkpoint?.name ?? "No checkpoint";
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  if (!can("hub.manage")) {
    return (
      <div className="px-10 py-8">
        <PageHeader title="Packing point" />
        <p className="text-[13px] text-muted">Your staff role can&apos;t use the packing point.</p>
      </div>
    );
  }

  const action = ACTION[stage];

  async function advance() {
    if (!action || selected.size === 0) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch(action.path, accessToken, {
        method: "POST",
        body: JSON.stringify({ orderIds: [...selected] }),
      });
      load();
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't move those orders."));
    } finally {
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Packing point"
        subtitle="Orders the delivery company brings in. Pack each into a Wave bag labelled with its order number."
        action={
          <div className="flex gap-1 rounded-full bg-surface-muted p-1">
            {[0, 1].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOffset(o)}
                aria-pressed={offset === o}
                className={`min-h-[36px] rounded-full px-4 text-[13px] font-semibold ${offset === o ? "bg-ink text-white" : "text-muted"}`}
              >
                {o === 0 ? "Today" : "Tomorrow"}
              </button>
            ))}
          </div>
        }
      />
      {loadError ? <FetchErrorBanner message={loadError} onRetry={load} /> : null}

      <div role="tablist" aria-label="Stage" className="mb-5 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={stage === t.key}
            type="button"
            onClick={() => setStage(t.key)}
            className={`min-h-[42px] px-3 text-[13.5px] ${stage === t.key ? "font-semibold text-ink shadow-[inset_0_-2px_0_#083400]" : "text-muted"}`}
          >
            {t.label} · {day?.[t.key].length ?? 0}
          </button>
        ))}
      </div>

      {action && rows.length > 0 ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
          <label className="flex items-center gap-2 text-[13.5px] font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4 accent-ink"
              checked={selected.size === rows.length}
              onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
            />
            {selected.size} selected
          </label>
          <div className="ml-auto">
            <Button label={busy ? "Working…" : action.label} onClick={advance} disabled={busy || selected.size === 0} />
          </div>
        </div>
      ) : null}
      <FormError message={actionError} />

      {day && rows.length === 0 ? <p className="text-[13px] text-muted">Nothing here.</p> : null}

      <div className="space-y-6">
        {groups.map(([checkpoint, list]) => (
          <section key={checkpoint}>
            <h2 className="mb-2 text-[14px] font-semibold text-ink">
              {checkpoint} · {list.length}
            </h2>
            <div className="overflow-x-auto rounded-card border border-border bg-surface">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    {action ? <th className="w-10 px-4 py-2.5"><span className="sr-only">Select</span></th> : null}
                    <th className="px-3 py-2.5 font-normal">Bag label</th>
                    <th className="px-3 py-2.5 font-normal">Student</th>
                    <th className="px-3 py-2.5 font-normal">Items</th>
                    <th className="px-3 py-2.5 font-normal">From</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0">
                      {action ? (
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-ink"
                            checked={selected.has(o.id)}
                            onChange={() => toggle(o.id)}
                            aria-label={`Select ${o.ref}`}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5 font-bold tracking-wide">{o.ref}</td>
                      <td className="px-3 py-2.5">{o.student?.fullName ?? ""}</td>
                      <td className="px-3 py-2.5">{o.itemDescription}</td>
                      <td className="px-3 py-2.5 text-muted">
                        {o.shop?.name ?? o.suggestion?.name ?? o.originCheckpoint?.name ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
