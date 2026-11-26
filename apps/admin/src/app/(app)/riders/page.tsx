"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { approvalWait } from "@wave/shared";
import { PageHeader } from "../../../components/ui/PageHeader";
import { FilterTabs } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Button } from "../../../components/ui/Button";
import { localPhone } from "../../../lib/format";

type VerificationStatus = "pending" | "approved" | "rejected";

interface Verification {
  id: string;
  idType: string;
  idNumber: string;
  // Signed per request by the API; null when the object could not be signed.
  idImageUrl: string | null;
  selfieUrl: string | null;
  status: VerificationStatus;
  createdAt: string;
  rider: { id: string; fullName: string; phone: string };
}

const TABS: { key: VerificationStatus; label: string }[] = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Verified" },
  { key: "rejected", label: "Turned down" },
];


export default function RidersPage() {
  const { accessToken, can } = useAdminAuth();
  const [tab, setTab] = useState<VerificationStatus>("pending");
  const [verifications, setVerifications] = useState<Verification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setVerifications(null);
    setError(null);
    apiFetch<{ verifications: Verification[] }>(`/riders/admin/riders?status=${tab}`, accessToken)
      .then((res) => setVerifications(res.verifications))
      .catch(() => {
        setVerifications([]);
        setError("Could not load rider verifications. Check your connection and try again.");
      });
  }, [accessToken, tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReview(id: string, status: "approved" | "rejected") {
    if (!accessToken) return;
    setActioning(id);
    try {
      await apiFetch(`/riders/admin/riders/${id}/verify`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ status, rejectionReason: status === "rejected" ? "Did not meet requirements" : undefined }),
      });
      load();
    } finally {
      setActioning(null);
    }
  }

  const selected = verifications?.find((v) => v.id === picked) ?? verifications?.[0] ?? null;
  const ID_LABEL: Record<string, string> = { ghana_card: "Ghana Card", student_id: "Student ID", passport: "Passport", voter_id: "Voter ID", drivers_license: "Driver's licence" };

  return (
    <div className="px-10 py-8">
      <PageHeader title="Riders" subtitle="Verification and who can work" />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <FilterTabs
        tabs={TABS.map((t) => ({
          key: t.key,
          label: `${t.label}${t.key === "pending" && verifications && tab === "pending" ? ` (${verifications.length})` : ""}`,
        }))}
        active={tab}
        onChange={(k) => {
          setTab(k);
          setPicked(null);
        }}
      />

      {/* v7 canvas: the queue on the left, the chosen rider's documents and the
          decision on the right. */}
      <div className="grid grid-cols-[1fr_1fr] gap-6">
        <div className="overflow-hidden rounded-card border border-border bg-surface">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-border text-[12.5px] font-bold text-ink">
                <th className="h-10 px-4 font-bold">Rider</th>
                <th className="h-10 px-4 font-bold">ID</th>
                <th className="h-10 px-4 font-bold">Sent</th>
                <th className="h-10 px-4 font-bold" />
              </tr>
            </thead>
            <tbody>
              {!verifications ? (
                <tr><td className="px-4 py-6 text-muted" colSpan={4}>Loading…</td></tr>
              ) : verifications.length === 0 ? (
                <tr><td className="px-4 py-6 text-muted" colSpan={4}>No riders here.</td></tr>
              ) : (
                verifications.map((v) => {
                  const wait = approvalWait(v.createdAt);
                  const on = selected?.id === v.id;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setPicked(v.id)}
                      aria-selected={on}
                      className={`cursor-pointer border-b border-border/70 last:border-b-0 ${on ? "bg-wash" : "hover:bg-canvas"}`}
                    >
                      <td className="h-12 px-4 font-bold text-ink">{v.rider.fullName}</td>
                      <td className="px-4 text-ink">{ID_LABEL[v.idType] ?? v.idType.replace(/_/g, " ")}</td>
                      <td className={`px-4 ${v.status === "pending" && wait.overdue ? "font-bold text-danger-text" : "text-ink"}`}>
                        {v.status === "pending" ? wait.label : new Date(v.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4">
                        <StatusPill
                          label={v.status === "pending" ? "Review" : v.status === "approved" ? "Verified" : "Turned down"}
                          tone={v.status === "pending" ? "warn" : v.status === "approved" ? "good" : "bad"}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {selected ? (
          <div className="rounded-card border border-border bg-surface p-5">
            <h2 className="text-[15px] font-bold text-ink">
              {selected.rider.fullName} · {ID_LABEL[selected.idType] ?? selected.idType.replace(/_/g, " ")}
            </h2>
            <p className="mb-4 text-[13px] text-muted">{localPhone(selected.rider.phone)} · {selected.idNumber}</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { url: selected.idImageUrl, alt: "ID" },
                { url: selected.selfieUrl, alt: "Selfie" },
              ].map((d) =>
                d.url ? (
                  <a key={d.alt} href={d.url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URLs */}
                    <img src={d.url} alt={`${selected.rider.fullName}'s ${d.alt}`} className="h-44 w-full rounded-control border border-border object-cover" />
                  </a>
                ) : (
                  <div key={d.alt} className="flex h-44 items-center justify-center rounded-control bg-surface-muted text-[12px] text-muted">
                    No {d.alt.toLowerCase()} photo
                  </div>
                ),
              )}
            </div>
            {selected.status === "pending" && can("riders.verify") ? (
              <div className="mt-4 flex gap-2">
                <Button label="Approve" disabled={actioning === selected.id} onClick={() => void handleReview(selected.id, "approved")} />
                <Button label="Reject" variant="secondary" disabled={actioning === selected.id} onClick={() => void handleReview(selected.id, "rejected")} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
