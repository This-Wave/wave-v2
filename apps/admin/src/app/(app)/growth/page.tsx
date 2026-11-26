"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, FilterTabs, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { StatTile } from "../../../components/ui/Card";

interface Person {
  id: string;
  fullName: string;
  phone: string;
  campus: string | null;
  joinedAt: string;
  installedAt: string | null;
  notificationsOn: boolean;
}
interface Engagement {
  totals: { students: number; installed: number; notificationsOn: number };
  people: Person[];
}
interface GuestVisit {
  id: string;
  firstName: string;
  universityId: string | null;
  createdAt: string;
}
interface Lead {
  id: string;
  fullName: string;
  phone: string;
  businessName: string;
  kind: "bulk_pickup" | "shop_listing";
  details: string | null;
  status: string;
  createdAt: string;
}

type Tab = "app" | "guests" | "leads";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Super admin only (`growth.read`): who has Wave on their home screen and
 * notifications on, who looked around as a guest, and which campus
 * businesses asked to work with Wave.
 */
export default function GrowthPage() {
  const { accessToken } = useAdminAuth();
  const [tab, setTab] = useState<Tab>("app");
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [guests, setGuests] = useState<GuestVisit[] | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    Promise.all([
      apiFetch<Engagement>("/admin/engagement", accessToken),
      apiFetch<{ visits: GuestVisit[] }>("/admin/guest-visits", accessToken),
      apiFetch<{ leads: Lead[] }>("/admin/business-leads", accessToken),
    ])
      .then(([e, g, l]) => {
        setEngagement(e);
        setGuests(g.visits);
        setLeads(l.leads);
      })
      .catch(() => {
        setEngagement({ totals: { students: 0, installed: 0, notificationsOn: 0 }, people: [] });
        setGuests([]);
        setLeads([]);
        setError("Could not load growth data.");
      });
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const peopleColumns: Column<Person>[] = [
    { header: "Student", render: (p) => <span className="font-medium text-ink">{p.fullName}</span> },
    { header: "Phone", width: "w-[150px]", render: (p) => p.phone },
    { header: "Campus", width: "w-[200px]", render: (p) => p.campus ?? "—" },
    {
      header: "Home screen",
      width: "w-[160px]",
      render: (p) => (p.installedAt ? <StatusPill label={`Since ${when(p.installedAt)}`} tone="good" /> : <StatusPill label="Not yet" />),
    },
    {
      header: "Notifications",
      width: "w-[130px]",
      render: (p) => <StatusPill label={p.notificationsOn ? "On" : "Off"} tone={p.notificationsOn ? "good" : "neutral"} />,
    },
  ];
  const guestColumns: Column<GuestVisit>[] = [
    { header: "First name", render: (g) => <span className="font-medium text-ink">{g.firstName}</span> },
    { header: "When", width: "w-[200px]", render: (g) => when(g.createdAt) },
  ];
  const leadColumns: Column<Lead>[] = [
    { header: "Business", render: (l) => <span className="font-medium text-ink">{l.businessName}</span> },
    { header: "Contact", width: "w-[220px]", render: (l) => `${l.fullName} · ${l.phone}` },
    {
      header: "Wants",
      width: "w-[170px]",
      render: (l) => <StatusPill label={l.kind === "bulk_pickup" ? "Bulk pickups" : "Shop on Wave"} tone="warn" />,
    },
    { header: "Notes", render: (l) => l.details ?? "—" },
    { header: "When", width: "w-[150px]", render: (l) => when(l.createdAt) },
  ];

  const t = engagement?.totals;
  return (
    <div>
      <PageHeader title="Growth" subtitle="Home-screen installs, notifications, guests and business leads." />
      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile value={t ? String(t.students) : "…"} label="Students" />
        <StatTile value={t ? String(t.installed) : "…"} label="On home screen" accent />
        <StatTile value={t ? String(t.notificationsOn) : "…"} label="Notifications on" accent />
        <StatTile value={guests ? String(guests.length) : "…"} label="Guests" />
        <StatTile value={leads ? String(leads.length) : "…"} label="Business leads" />
      </div>

      <FilterTabs
        tabs={[
          { key: "app", label: "Installs & notifications" },
          { key: "guests", label: "Guests" },
          { key: "leads", label: "Business leads" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "app" ? (
        <DataTable columns={peopleColumns} rows={engagement?.people ?? null} rowKey={(p) => p.id} emptyMessage="No students yet." />
      ) : tab === "guests" ? (
        <DataTable columns={guestColumns} rows={guests} rowKey={(g) => g.id} emptyMessage="Nobody has looked around as a guest yet." />
      ) : (
        <DataTable columns={leadColumns} rows={leads} rowKey={(l) => l.id} emptyMessage="No business leads yet." />
      )}
    </div>
  );
}
