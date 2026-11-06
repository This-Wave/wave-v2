"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AUDIT_CATEGORIES, staffRoleLabel, type AuditEventDto } from "@wave/shared";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { API_URL, apiFetch } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { StatusPill } from "../../../components/ui/StatusPill";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { FOCUS_RING } from "../../../components/ui/Field";

interface Filters {
  q: string;
  category: string;
  outcome: string;
  actorType: string;
  from: string;
  to: string;
  entityType: string;
  entityId: string;
  actorId: string;
}

const EMPTY: Filters = { q: "", category: "", outcome: "", actorType: "", from: "", to: "", entityType: "", entityId: "", actorId: "" };

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(AUDIT_CATEGORIES.map((c) => [c.key, c.label]));

const ACTOR_TYPES = [
  { value: "staff", label: "Staff" },
  { value: "user", label: "Students, riders, shops" },
  { value: "system", label: "Wave (automatic)" },
  { value: "webhook", label: "Paystack / Supabase" },
  { value: "anonymous", label: "Not signed in" },
];

const ROLE_LABEL: Record<string, string> = { student: "Student", rider: "Rider", shop_owner: "Shop owner" };

/** "order.cancelled_by_shop" → "Order cancelled by shop". */
function describeAction(action: string): string {
  const words = action.replace(/^http\./, "request ").replace(/[._]/g, " ").trim();
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return sentence.replace(/\bPii\b/, "Personal data").replace(/\bpin\b/g, "PIN").replace(/\bcsv\b/gi, "CSV");
}

function toQuery(f: Filters): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.category) params.set("category", f.category);
  if (f.outcome) params.set("outcome", f.outcome);
  if (f.actorType) params.set("actorType", f.actorType);
  // Dates are picked as local days; the whole of the `to` day is included.
  if (f.from) params.set("from", new Date(`${f.from}T00:00:00`).toISOString());
  if (f.to) params.set("to", new Date(`${f.to}T23:59:59.999`).toISOString());
  if (f.entityType) params.set("entityType", f.entityType);
  if (f.entityId) params.set("entityId", f.entityId);
  if (f.actorId) params.set("actorId", f.actorId);
  return params;
}

function time(iso: string): { clock: string; day: string } {
  const d = new Date(iso);
  return {
    clock: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    day: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  };
}

/**
 * Everything that happens on Wave, as it happens.
 *
 * The live stream and the table share one filter: a row that arrives while you
 * are filtered to "Refunds" appears only if it is a refund, exactly as it would
 * after a reload. Pausing holds new rows back behind a counter instead of
 * dropping them, so reading a row never costs you the ones that arrived meanwhile.
 */
export default function AuditPage() {
  const { accessToken, can, profile } = useAdminAuth();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [draftQ, setDraftQ] = useState("");
  const [events, setEvents] = useState<AuditEventDto[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [scope, setScope] = useState<"all" | "campus" | "own">("all");
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [held, setHeld] = useState<AuditEventDto[]>([]);
  const [streamState, setStreamState] = useState<"connecting" | "live" | "retrying" | "off">("connecting");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const liveRef = useRef(live);
  liveRef.current = live;

  const query = useMemo(() => toQuery(filters).toString(), [filters]);

  // Debounced search, so the stream isn't reopened on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === draftQ ? f : { ...f, q: draftQ })), 350);
    return () => clearTimeout(t);
  }, [draftQ]);

  // Filters change faster than responses arrive; only the newest may write.
  const latest = useRef(0);

  const load = useCallback(() => {
    if (!accessToken) return;
    const request = ++latest.current;
    setEvents(null);
    setHeld([]);
    setError(null);
    apiFetch<{ events: AuditEventDto[]; hasMore: boolean; scope: "all" | "campus" | "own" }>(`/admin/audit?${query}`, accessToken)
      .then((res) => {
        if (request !== latest.current) return;
        setEvents(res.events);
        setHasMore(res.hasMore);
        setScope(res.scope);
      })
      .catch(() => {
        if (request !== latest.current) return;
        setEvents([]);
        setError("Could not load the activity log.");
      });
  }, [accessToken, query]);

  useEffect(() => {
    load();
  }, [load]);

  // The live stream: fetch + a stream reader, because EventSource can't send
  // the Authorization header. Reconnects with backoff when the connection drops.
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    let attempt = 0;
    let stopped = false;

    async function connect() {
      while (!stopped) {
        setStreamState(attempt === 0 ? "connecting" : "retrying");
        try {
          const res = await fetch(`${API_URL}/admin/audit/stream?${query}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal,
          });
          if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
          setStreamState("live");
          attempt = 0;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let split: number;
            while ((split = buffer.indexOf("\n\n")) !== -1) {
              const chunk = buffer.slice(0, split);
              buffer = buffer.slice(split + 2);
              const data = chunk
                .split("\n")
                .filter((l) => l.startsWith("data: "))
                .map((l) => l.slice(6))
                .join("\n");
              if (!data) continue;
              try {
                receive(JSON.parse(data) as AuditEventDto);
              } catch {
                // A malformed frame is skipped, not fatal.
              }
            }
          }
        } catch {
          if (stopped) return;
        }
        attempt += 1;
        setStreamState("retrying");
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** attempt)));
      }
    }

    function receive(event: AuditEventDto) {
      if (liveRef.current) {
        setEvents((prev) => (prev && !prev.some((e) => e.id === event.id) ? [event, ...prev] : prev));
        setFresh((prev) => new Set(prev).add(event.id));
        setTimeout(
          () =>
            setFresh((prev) => {
              const next = new Set(prev);
              next.delete(event.id);
              return next;
            }),
          4000,
        );
      } else {
        setHeld((prev) => (prev.some((e) => e.id === event.id) ? prev : [event, ...prev]));
      }
    }

    void connect();
    return () => {
      stopped = true;
      controller.abort();
      setStreamState("off");
    };
  }, [accessToken, query]);

  function releaseHeld() {
    setEvents((prev) => {
      const ids = new Set((prev ?? []).map((e) => e.id));
      return [...held.filter((e) => !ids.has(e.id)), ...(prev ?? [])];
    });
    setHeld([]);
  }

  function toggleLive() {
    if (!live) releaseHeld();
    setLive((v) => !v);
  }

  async function loadMore() {
    if (!accessToken || !events?.length) return;
    const last = events[events.length - 1]!;
    const res = await apiFetch<{ events: AuditEventDto[]; hasMore: boolean }>(
      `/admin/audit?${query}&before=${last.id}`,
      accessToken,
    );
    setEvents((prev) => [...(prev ?? []), ...res.events]);
    setHasMore(res.hasMore);
  }

  async function exportCsv() {
    if (!accessToken) return;
    setExporting(true);
    try {
      const res = await fetch(`${API_URL}/admin/audit/export.csv?${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "wave-audit.csv";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The export failed. Try a narrower date range.");
    } finally {
      setExporting(false);
    }
  }

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const anyFilter = JSON.stringify({ ...filters, q: draftQ }) !== JSON.stringify(EMPTY);

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Activity log"
        subtitle={
          scope === "own"
            ? "Everything you have done on Wave. Only an owner or auditor sees everyone's."
            : scope === "campus"
              ? `Everything that happens at ${profile?.campus?.name ?? "your campus"}, as it happens.`
              : "Everything that happens on Wave, as it happens. Kept permanently; nobody can edit or delete a row."
        }
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleLive}
              aria-pressed={live}
              className={`inline-flex min-h-[42px] items-center gap-2 rounded-pill border px-4 text-[13px] font-semibold ${FOCUS_RING} ${
                live ? "border-transparent bg-lime text-ink" : "border-border bg-surface text-ink"
              }`}
            >
              <span
                aria-hidden
                className={`h-2 w-2 rounded-pill ${live && streamState === "live" ? "bg-ink" : "border border-ink"}`}
              />
              {live ? (streamState === "live" ? "Live" : streamState === "retrying" ? "Reconnecting…" : "Connecting…") : "Paused"}
            </button>
            {can("audit.read_all") || scope !== "all" ? (
              <Button label={exporting ? "Exporting…" : "Export CSV"} variant="secondary" disabled={exporting} onClick={exportCsv} />
            ) : null}
          </div>
        }
      />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <div className="mb-4 flex flex-wrap items-end gap-2.5" role="search" aria-label="Filter the activity log">
        <FilterInput label="Search" wide>
          <input
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Name, action, order id, IP"
            className={CONTROL}
          />
        </FilterInput>
        <FilterInput label="Area">
          <select value={filters.category} onChange={(e) => set({ category: e.target.value })} className={CONTROL}>
            <option value="">Everything</option>
            {AUDIT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </FilterInput>
        <FilterInput label="Who">
          <select value={filters.actorType} onChange={(e) => set({ actorType: e.target.value })} className={CONTROL}>
            <option value="">Anyone</option>
            {ACTOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </FilterInput>
        <FilterInput label="Result">
          <select value={filters.outcome} onChange={(e) => set({ outcome: e.target.value })} className={CONTROL}>
            <option value="">Any</option>
            <option value="success">Succeeded</option>
            <option value="denied">Refused</option>
            <option value="failed">Failed</option>
          </select>
        </FilterInput>
        <FilterInput label="From">
          <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={CONTROL} />
        </FilterInput>
        <FilterInput label="To">
          <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={CONTROL} />
        </FilterInput>
        {anyFilter ? (
          <button
            type="button"
            onClick={() => {
              setFilters(EMPTY);
              setDraftQ("");
            }}
            className={`mb-[3px] min-h-[38px] rounded-control px-2 text-[12.5px] font-semibold text-ink underline ${FOCUS_RING}`}
          >
            Clear filters
          </button>
        ) : null}
      </div>

      {filters.entityId || filters.actorId ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.entityId ? (
            <Chip
              label={`${filters.entityType || "Item"} ${filters.entityId.slice(0, 8)} — its whole history`}
              onClear={() => set({ entityId: "", entityType: "" })}
            />
          ) : null}
          {filters.actorId ? <Chip label={`One person: ${filters.actorId.slice(0, 8)}`} onClear={() => set({ actorId: "" })} /> : null}
        </div>
      ) : null}

      {held.length > 0 ? (
        <button
          type="button"
          onClick={releaseHeld}
          className={`mb-3 w-full rounded-control border border-border bg-surface py-2.5 text-[13px] font-semibold text-ink ${FOCUS_RING}`}
        >
          {held.length} new {held.length === 1 ? "event" : "events"} — show
        </button>
      ) : null}

      <Card>
        <table className="w-full table-fixed border-collapse text-left">
          <caption className="sr-only">Activity, newest first</caption>
          <thead>
            <tr className="border-b border-border bg-canvas">
              <Th className="w-[128px]">When</Th>
              <Th className="w-[220px]">Who</Th>
              <Th>What</Th>
              <Th className="w-[190px]">On</Th>
              <Th className="w-[110px]">Result</Th>
            </tr>
          </thead>
          <tbody aria-live="off">
            {events === null ? (
              <tr>
                <td colSpan={5} className="px-[22px] py-7 text-[13.5px] text-muted">
                  Loading…
                </td>
              </tr>
            ) : events.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-[22px] py-7 text-[13.5px] text-muted">
                  {anyFilter ? "Nothing matches these filters." : "Nothing has happened yet."}
                </td>
              </tr>
            ) : (
              events.map((e) => {
                const t = time(e.occurredAt);
                const open = expanded === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr
                      className={`border-b border-border align-top ${fresh.has(e.id) ? "bg-lime/25" : ""} ${open ? "bg-canvas" : ""}`}
                    >
                      <td className="px-[22px] py-3">
                        <p className="whitespace-nowrap text-[13px] tabular-nums text-ink">{t.clock}</p>
                        <p className="text-[11.5px] text-muted">{t.day}</p>
                      </td>
                      <td className="px-[22px] py-3">
                        {e.actorId ? (
                          <button
                            type="button"
                            onClick={() => set({ actorId: e.actorId! })}
                            className={`block max-w-full truncate rounded-control text-left text-[13px] font-semibold text-ink hover:underline ${FOCUS_RING}`}
                            title="Show everything this person did"
                          >
                            {e.actorName ?? e.actorId.slice(0, 8)}
                          </button>
                        ) : (
                          <p className="truncate text-[13px] font-semibold text-ink">
                            {e.actorName ?? (e.actorType === "anonymous" ? "Not signed in" : "Wave")}
                          </p>
                        )}
                        <p className="truncate text-[11.5px] text-muted">
                          {e.actorType === "staff"
                            ? staffRoleLabel(e.actorStaffRole)
                            : e.actorType === "user"
                              ? (ROLE_LABEL[e.actorRole ?? ""] ?? e.actorRole)
                              : e.actorType === "system"
                                ? "Automatic"
                                : e.actorType === "webhook"
                                  ? "Webhook"
                                  : (e.ip ?? "")}
                        </p>
                      </td>
                      <td className="px-[22px] py-3">
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : e.id)}
                          aria-expanded={open}
                          className={`block max-w-full rounded-control text-left ${FOCUS_RING}`}
                        >
                          <span className="block truncate text-[13.5px] font-medium text-ink">{describeAction(e.action)}</span>
                          <span className="block truncate text-[11.5px] text-muted">
                            {CATEGORY_LABEL[e.category] ?? e.category} · {open ? "hide details" : "details"}
                          </span>
                        </button>
                      </td>
                      <td className="px-[22px] py-3">
                        {e.entityId ? (
                          <button
                            type="button"
                            onClick={() => set({ entityType: e.entityType ?? "", entityId: e.entityId! })}
                            className={`block max-w-full truncate rounded-control text-left font-mono text-[12px] text-ink hover:underline ${FOCUS_RING}`}
                            title="Show this item's whole history"
                          >
                            {e.entityType ? `${e.entityType.replace(/_/g, " ")} ` : ""}
                            {e.entityId.length > 12 ? e.entityId.slice(0, 8) : e.entityId}
                          </button>
                        ) : (
                          <span className="text-[12px] text-muted">—</span>
                        )}
                      </td>
                      <td className="px-[22px] py-3">
                        <StatusPill
                          label={e.outcome === "success" ? "OK" : e.outcome === "denied" ? "Refused" : "Failed"}
                          tone={e.outcome === "success" ? "neutral" : e.outcome === "denied" ? "warn" : "bad"}
                        />
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-border bg-canvas">
                        <td colSpan={5} className="px-[22px] pb-5 pt-1">
                          <EventDetail event={e} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {hasMore ? (
        <div className="mt-4">
          <Button label="Load older" variant="secondary" onClick={() => void loadMore()} />
        </div>
      ) : null}
    </div>
  );
}

const CONTROL = `min-h-[38px] w-full rounded-control border border-border bg-surface px-3 text-[13px] text-ink ${FOCUS_RING}`;

function FilterInput({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? "w-[260px]" : "w-[160px]"}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</span>
      {children}
    </label>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`h-11 px-[22px] text-[11px] font-semibold uppercase tracking-[0.06em] text-muted ${className}`}>
      {children}
    </th>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-pill border border-border bg-surface py-1 pl-3 pr-1 text-[12.5px] text-ink">
      {label}
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove filter: ${label}`}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-pill text-[14px] text-ink hover:bg-canvas ${FOCUS_RING}`}
      >
        ×
      </button>
    </span>
  );
}

/** The before → after of a change, only the keys that differ first. */
function EventDetail({ event }: { event: AuditEventDto }) {
  const before = (event.before ?? {}) as Record<string, unknown>;
  const after = (event.after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const show = (v: unknown) => (v === undefined ? "—" : v === null ? "empty" : typeof v === "object" ? JSON.stringify(v) : String(v));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div>
        {keys.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Change</p>
            <table className="w-full text-[12.5px]">
              <tbody>
                {keys.map((k) => (
                  <tr key={k} className="align-top">
                    <td className="w-[160px] py-1 pr-3 font-mono text-muted">{k}</td>
                    <td className="py-1 pr-3 text-muted line-through decoration-muted/60">{show(before[k])}</td>
                    <td className="py-1 font-semibold text-ink">{show(after[k])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {event.metadata ? (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Details</p>
            <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap break-all rounded-control border border-border bg-surface p-3 font-mono text-[11.5px] leading-5 text-ink">
              {JSON.stringify(event.metadata, null, 2)}
            </pre>
          </div>
        ) : null}
        {keys.length === 0 && !event.metadata ? <p className="text-[12.5px] text-muted">No further detail recorded.</p> : null}
      </div>
      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[12px]">
        <Meta label="Action" value={event.action} mono />
        <Meta label="Exact time" value={new Date(event.occurredAt).toISOString()} mono />
        <Meta label="Actor id" value={event.actorId} mono />
        <Meta label="IP" value={event.ip} mono />
        <Meta label="Request" value={event.method && event.path ? `${event.method} ${event.path}` : null} mono />
        <Meta label="Status" value={event.statusCode ? String(event.statusCode) : null} />
        <Meta label="Device" value={event.userAgent} />
        <Meta label="Request id" value={event.requestId} mono />
        <Meta label="Event id" value={event.id} mono />
      </dl>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={`break-all text-ink ${mono ? "font-mono text-[11.5px]" : ""}`}>{value}</dd>
    </>
  );
}
