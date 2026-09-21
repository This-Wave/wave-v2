"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PAUSE_MESSAGE, resolveSwitch, type ServiceSwitchKey, type ServiceSwitchRow } from "@wave/shared";
import { useAdminAuth } from "../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../lib/api";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { FOCUS_RING, FormError, TextField } from "./ui/Field";
import { StatusPill } from "./ui/StatusPill";

interface Payload {
  catalogue: { key: ServiceSwitchKey; label: string; description: string }[];
  rows: (ServiceSwitchRow & { updatedAt: string })[];
  universities: { id: string; name: string }[];
}

const GLOBAL = "__global__";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The kill switches: stop new Buy-for-me or Pickup orders, or everything.
 *
 * Deliberately heavier than a feature toggle. A flag switch flips on one tap;
 * a pause opens a dialog, because one tap here stops every sale on a campus
 * and the students affected are owed a sentence explaining why. Resuming is one
 * tap — getting back to normal should never be the hard direction.
 */
export function ServiceSwitches() {
  const { accessToken, can } = useAdminAuth();
  const canManage = can("switches.manage");
  const [data, setData] = useState<Payload | null>(null);
  const [scope, setScope] = useState<string>(GLOBAL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pausing, setPausing] = useState<Payload["catalogue"][number] | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    apiFetch<Payload>("/admin/switches", accessToken)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Could not load the ordering switches."));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <Card className="p-6">
        <h2 className="text-[17px] font-semibold tracking-tight text-ink">Ordering</h2>
        <p role="status" aria-live="polite" className="mt-2 text-[13px] text-muted">
          {error ?? "Loading…"}
        </p>
      </Card>
    );
  }

  const universityId = scope === GLOBAL ? null : scope;

  function ownRow(key: string) {
    return data!.rows.find((r) => r.key === key && r.universityId === universityId);
  }

  async function resume(key: ServiceSwitchKey) {
    if (!accessToken) return;
    setBusy(key);
    setError(null);
    try {
      await apiFetch("/admin/switches", accessToken, {
        method: "PUT",
        body: JSON.stringify({ key, universityId, paused: false }),
      });
      load();
    } catch (err) {
      setError(errorMessage(err, "Could not resume. Nothing was changed."));
    } finally {
      setBusy(null);
    }
  }

  async function followGlobal(key: ServiceSwitchKey) {
    if (!accessToken || universityId === null) return;
    setBusy(key);
    try {
      await apiFetch("/admin/switches", accessToken, {
        method: "DELETE",
        body: JSON.stringify({ key, universityId }),
      });
      load();
    } catch (err) {
      setError(errorMessage(err, "Could not clear the campus setting."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-[17px] font-semibold tracking-tight text-ink">Ordering</h2>
      <p className="mb-5 mt-1 text-[12.5px] leading-5 text-muted">
        Pause new orders when operations need it. Orders already paid for still get delivered.
      </p>

      <div className="mb-5">
        <label className="mb-1.5 block text-[12px] font-semibold text-muted" htmlFor="switch-scope">
          Applies to
        </label>
        <select
          id="switch-scope"
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className={`min-h-[42px] rounded-control border border-border bg-surface px-3.5 py-2 text-[13.5px] text-ink ${FOCUS_RING}`}
        >
          <option value={GLOBAL}>Every university</option>
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
        {data.catalogue.map((sw) => {
          const effective = resolveSwitch(sw.key, universityId, data.rows);
          const own = ownRow(sw.key);
          const inherited = universityId !== null && !own;
          return (
            <li key={sw.key} className="flex items-start gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13.5px] font-semibold text-ink">{sw.label}</p>
                  <StatusPill label={effective.paused ? "Paused" : "Taking orders"} tone={effective.paused ? "bad" : "good"} />
                </div>
                <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{sw.description}</p>
                {effective.paused ? (
                  <p className="mt-1.5 text-[12.5px] leading-5 text-ink">
                    Students see: &ldquo;{effective.message}&rdquo;
                    {effective.resumeAt ? <> Resumes by itself {formatWhen(effective.resumeAt)}.</> : null}
                  </p>
                ) : null}
                {universityId !== null ? (
                  <p className="mt-1 text-[12px] text-muted">
                    {inherited ? (
                      <>Following the every-university setting.</>
                    ) : (
                      <>
                        Set for this campus only.{" "}
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => followGlobal(sw.key)}
                            className={`rounded-control px-1 font-semibold text-ink underline ${FOCUS_RING}`}
                          >
                            Follow every-university setting
                          </button>
                        ) : null}
                      </>
                    )}
                  </p>
                ) : null}
              </div>

              {canManage ? (
                effective.paused && !inherited ? (
                  <Button
                    label={busy === sw.key ? "Resuming…" : "Resume"}
                    variant="secondary"
                    disabled={busy === sw.key}
                    onClick={() => resume(sw.key)}
                  />
                ) : effective.paused ? null : (
                  <Button label="Pause" variant="danger" disabled={busy === sw.key} onClick={() => setPausing(sw)} />
                )
              ) : null}
            </li>
          );
        })}
      </ul>

      <PauseModal
        target={pausing}
        universityId={universityId}
        scopeLabel={universityId ? (data.universities.find((u) => u.id === universityId)?.name ?? "this campus") : "every university"}
        accessToken={accessToken}
        onClose={() => setPausing(null)}
        onDone={() => {
          setPausing(null);
          load();
        }}
      />
    </Card>
  );
}

function PauseModal({
  target,
  universityId,
  scopeLabel,
  accessToken,
  onClose,
  onDone,
}: {
  target: { key: ServiceSwitchKey; label: string } | null;
  universityId: string | null;
  scopeLabel: string;
  accessToken: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [message, setMessage] = useState("");
  const [resumeAt, setResumeAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMessage("");
    setResumeAt("");
    setError(null);
  }, [target]);

  async function submit() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/admin/switches", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          key: target.key,
          universityId,
          paused: true,
          message: message.trim() || null,
          // datetime-local has no zone; the browser's is the admin's, which is Ghana's.
          resumeAt: resumeAt ? new Date(resumeAt).toISOString() : null,
        }),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not pause. Nothing was changed."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={target !== null}
      title={`Pause ${target?.label ?? ""}`}
      description={`New orders stop at ${scopeLabel} as soon as you confirm. Orders already paid for are still delivered.`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button label={saving ? "Pausing…" : "Pause new orders"} variant="danger" disabled={saving} onClick={submit} />
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="What students see"
          multiline
          value={message}
          onChange={setMessage}
          placeholder={DEFAULT_PAUSE_MESSAGE}
          hint="Say why and when you'll be back, e.g. “Exams week — orders reopen Monday.”"
        />
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-muted">Resume by itself at (optional)</span>
          <input
            type="datetime-local"
            value={resumeAt}
            onChange={(e) => setResumeAt(e.target.value)}
            className={`min-h-[42px] w-full rounded-control border border-border bg-surface px-3.5 py-2 text-[13.5px] text-ink ${FOCUS_RING}`}
          />
        </label>
        <FormError message={error} />
      </div>
    </Modal>
  );
}
