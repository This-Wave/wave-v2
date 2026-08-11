"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { RowAction } from "../../../components/ui/Button";
import { ResolveSuggestionModal } from "../../../components/ResolveSuggestionModal";

export interface Suggestion {
  normalizedName: string;
  universityId: string;
  displayName: string;
  universityName: string | null;
  count: number;
  students: number;
  lastSuggestedAt: string | null;
  locationText: string | null;
  category: string | null;
  status: "pending" | "onboarded" | "rejected";
  resolvedShop: { id: string; name: string } | null;
}

/**
 * Which shop should Wave onboard next.
 *
 * The ranking is by **distinct students**, not raw suggestion count, so one
 * very keen person cannot outrank a real crowd. Rows are grouped server-side on
 * a normalized name, which is what makes "Melcom", "melcom " and "MELCOM
 * Berekuso" one row of three rather than three rows of one.
 *
 * Resolving a row links every pending suggestion for that place to a real shop
 * and emails/notifies everyone who asked for it.
 */
export default function SuggestionsPage() {
  const { accessToken } = useAdminAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");
  const [resolving, setResolving] = useState<Suggestion | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setSuggestions(null);
    apiFetch<{ suggestions: Suggestion[] }>(
      `/admin/shop-suggestions?status=${statusFilter}`,
      accessToken,
    )
      .then((res) => setSuggestions(res.suggestions))
      .catch(() => setSuggestions([]));
  }, [accessToken, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function reject(suggestion: Suggestion) {
    if (!accessToken) return;
    setActioning(suggestion.normalizedName);
    try {
      await apiFetch("/admin/shop-suggestions/reject", accessToken, {
        method: "POST",
        body: JSON.stringify({
          normalizedName: suggestion.normalizedName,
          universityId: suggestion.universityId,
        }),
      });
      load();
    } finally {
      setActioning(null);
    }
  }

  const columns: Column<Suggestion>[] = [
    {
      header: "Place",
      render: (s) => (
        <div>
          <div className="font-semibold">{s.displayName}</div>
          <div className="text-[12px] text-muted">{s.locationText ?? "No location given"}</div>
        </div>
      ),
    },
    {
      header: "Demand",
      width: "w-[130px]",
      render: (s) => (
        <div>
          <div className="font-semibold">
            {s.students} student{s.students === 1 ? "" : "s"}
          </div>
          {s.count !== s.students ? (
            <div className="text-[12px] text-muted">{s.count} requests</div>
          ) : null}
        </div>
      ),
    },
    {
      header: "Campus",
      width: "w-[160px]",
      render: (s) => <span className="text-muted">{s.universityName ?? "—"}</span>,
    },
    {
      header: "Last asked",
      width: "w-[130px]",
      render: (s) => (
        <span className="text-muted">
          {s.lastSuggestedAt ? new Date(s.lastSuggestedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      header: "Status",
      width: "w-[140px]",
      render: (s) =>
        s.status === "onboarded" ? (
          <StatusPill label={s.resolvedShop?.name ?? "Onboarded"} tone="good" />
        ) : s.status === "rejected" ? (
          <StatusPill label="Rejected" tone="bad" />
        ) : (
          <StatusPill label="Pending" tone="warn" />
        ),
    },
    {
      header: "",
      width: "w-[190px]",
      align: "right",
      render: (s) =>
        s.status === "pending" ? (
          <div className="flex justify-end gap-2">
            <RowAction
              label="Onboard"
              disabled={actioning === s.normalizedName}
              onClick={() => setResolving(s)}
            />
            <RowAction
              label="Reject"
              tone="danger"
              disabled={actioning === s.normalizedName}
              onClick={() => reject(s)}
            />
          </div>
        ) : null,
    },
  ];

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Suggested shops"
        subtitle="What students are asking for, ranked by how many asked"
        action={
          <button
            onClick={() => setStatusFilter((f) => (f === "pending" ? "all" : "pending"))}
            className="h-9 rounded-control border border-border px-4 text-[13px] font-medium text-ink hover:bg-canvas"
          >
            {statusFilter === "pending" ? "Show all" : "Show pending only"}
          </button>
        }
      />

      <ResolveSuggestionModal
        suggestion={resolving}
        accessToken={accessToken}
        onClose={() => setResolving(null)}
        onResolved={() => {
          setResolving(null);
          load();
        }}
      />

      <DataTable
        columns={columns}
        rows={suggestions}
        rowKey={(s) => `${s.universityId}:${s.normalizedName}`}
        emptyMessage={
          statusFilter === "pending"
            ? "No open suggestions. Every place students asked for has been dealt with."
            : "Nobody has suggested a shop yet."
        }
      />
    </div>
  );
}
