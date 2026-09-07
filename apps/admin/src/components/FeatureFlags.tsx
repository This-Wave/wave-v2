"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../providers/AdminAuthProvider";
import { apiFetch } from "../lib/api";
import { Card } from "./ui/Card";
import { FOCUS_RING } from "./ui/Field";

interface FlagRow {
  key: string;
  universityId: string | null;
  enabled: boolean;
}

interface Catalogue {
  key: string;
  label: string;
  description: string;
}

interface Payload {
  catalogue: Catalogue[];
  rows: FlagRow[];
  universities: { id: string; name: string }[];
}

const GLOBAL = "__global__";

/**
 * Feature switches, scoped per university with a global default.
 *
 * The catalogue comes from the API rather than being repeated here, so a flag
 * added in `@wave/shared` appears in this screen with no admin change — and a
 * flag deleted there stops being offered, instead of leaving a switch that
 * writes a row nothing reads.
 *
 * Every flag is off until someone turns it on, including flags that have no row
 * at all. That is why the "Global default" tab shows switches for keys with no
 * database row: they are off, and flipping one creates the row.
 */
export function FeatureFlags() {
  const { accessToken } = useAdminAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [scope, setScope] = useState<string>(GLOBAL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    apiFetch<Payload>("/admin/features", accessToken)
      .then(setData)
      .catch(() =>
        setError("Could not load feature flags. Check your connection and try again."),
      );
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">Features</h2>
        <p role="status" aria-live="polite" className="mt-2 text-[13px] text-muted">
          {error ?? "Loading…"}
        </p>
      </Card>
    );
  }

  const universityId = scope === GLOBAL ? null : scope;

  function stateOf(key: string): { on: boolean; overridden: boolean; globalOn: boolean } {
    const rows = data!.rows.filter((r) => r.key === key);
    const globalRow = rows.find((r) => r.universityId === null);
    const globalOn = globalRow?.enabled ?? false;
    if (universityId === null) return { on: globalOn, overridden: false, globalOn };

    const scoped = rows.find((r) => r.universityId === universityId);
    return { on: scoped?.enabled ?? globalOn, overridden: !!scoped, globalOn };
  }

  async function set(key: string, enabled: boolean) {
    if (!accessToken) return;
    setBusy(key);
    setError(null);
    try {
      await apiFetch("/admin/features", accessToken, {
        method: "PUT",
        body: JSON.stringify({ key, universityId, enabled }),
      });
      load();
    } catch {
      setError(`Could not change “${key}”. Your other settings are unchanged.`);
    } finally {
      setBusy(null);
    }
  }

  async function clearOverride(key: string) {
    if (!accessToken || universityId === null) return;
    setBusy(key);
    try {
      await apiFetch("/admin/features", accessToken, {
        method: "DELETE",
        body: JSON.stringify({ key, universityId }),
      });
      load();
    } catch {
      setError(`Could not clear the override for “${key}”.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">Features</h2>
      <p className="mb-5 mt-1 text-[12.5px] leading-5 text-muted">
        Switches for work that is built but not yet released. Everything is off until someone
        turns it on.
      </p>

      <div className="mb-5">
        <label className="mb-1.5 block text-[12px] font-semibold text-muted" htmlFor="flag-scope">
          Applies to
        </label>
        <select
          id="flag-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className={`min-h-[42px] rounded-control border border-border bg-surface px-3.5 py-2 text-[13.5px] text-ink ${FOCUS_RING}`}
        >
          <option value={GLOBAL}>Global default — every university</option>
          {data.universities.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-control border border-danger-border bg-danger-bg px-3.5 py-2.5 text-[12.5px] text-danger-text"
        >
          {error}
        </div>
      ) : null}

      <ul className="flex flex-col divide-y divide-border">
        {data.catalogue.map((flag) => {
          const { on, overridden, globalOn } = stateOf(flag.key);
          return (
            <li key={flag.key} className="flex items-start gap-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-ink">{flag.label}</p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{flag.description}</p>
                {universityId !== null ? (
                  <p className="mt-1 text-[12px] text-muted">
                    {overridden ? (
                      <>
                        Overriding the global default ({globalOn ? "on" : "off"}).{" "}
                        <button
                          type="button"
                          onClick={() => clearOverride(flag.key)}
                          className={`rounded-control px-1 font-semibold text-ink underline ${FOCUS_RING}`}
                        >
                          Use the default
                        </button>
                      </>
                    ) : (
                      <>Following the global default ({globalOn ? "on" : "off"}).</>
                    )}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={flag.label}
                disabled={busy === flag.key}
                onClick={() => set(flag.key, !on)}
                className={`mt-0.5 inline-flex h-[26px] w-[44px] flex-shrink-0 items-center rounded-pill p-0.5 disabled:opacity-50 ${FOCUS_RING} ${
                  on ? "justify-end bg-ink" : "justify-start border border-muted bg-surface"
                }`}
              >
                {/* Ink knob when off, white when on — a white knob on a pale
                    track is ~1.1:1 and disappears, so "off" would look broken
                    rather than off. Same reasoning as the mobile Switch. */}
                <span
                  className={`block h-[20px] w-[20px] rounded-pill ${on ? "bg-surface" : "bg-muted"}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
