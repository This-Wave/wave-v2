"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { FormError, TextField } from "../../../components/ui/Field";

/**
 * Who delivers, and the delivery company (canvas boards 45 and 56).
 *
 * Students never see the company: it collects from shops on its private list
 * link and brings everything to Wave's packing point, and Wave packs and
 * delivers. This page is the whole of the company's setup: switch it on, give
 * it its link, set what it is paid, and see what it is owed this week.
 */

interface Company {
  id: string;
  name: string;
  contactName: string | null;
  contactPhone: string | null;
  isActive: boolean;
  rateType: "flat" | "percent" | null;
  rateValue: string | null;
  hasListLink: boolean;
}
interface CompaniesResponse {
  companies: Company[];
  mode: "independent" | "company";
  company: { id: string; name: string } | null;
  hubAddress: string;
}
interface Statement {
  delivered: number;
  feesTotal: number;
  owedTotal: number | null;
  lines: { orderId: string; date: string; deliveryFee: number; owed: number | null }[];
}

function weekRange(): { from: string; to: string; label: string } {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const f = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10), label: `${f(monday)} – ${f(sunday)}` };
}

const ghs = (n: number) => `GH₵${n.toFixed(2)}`;

export default function DeliveryCompanyPage() {
  const { accessToken, can } = useAdminAuth();
  const [data, setData] = useState<CompaniesResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setLoadError(null);
    apiFetch<CompaniesResponse>("/admin/companies", accessToken)
      .then(setData)
      .catch(() => setLoadError("Could not load the delivery company."));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (!can("companies.manage")) {
    return (
      <div className="px-10 py-8">
        <PageHeader title="Delivery company" />
        <p className="text-[13px] text-muted">Only an owner or the logistics head can manage the delivery company.</p>
      </div>
    );
  }

  const company = data?.companies.find((c) => c.id === data.company?.id) ?? data?.companies[0] ?? null;

  return (
    <div className="max-w-[900px] px-10 py-8">
      <PageHeader title="Delivery company" subtitle="Collects from shops and brings orders to Wave. Students only ever see Wave." />
      {loadError ? <FetchErrorBanner message={loadError} onRetry={load} /> : null}

      {data && !company ? <AddCompany accessToken={accessToken} onDone={load} /> : null}

      {data && company ? (
        <div className="space-y-6">
          <WhoDelivers data={data} company={company} accessToken={accessToken} onDone={load} />
          <ListLink company={company} accessToken={accessToken} onDone={load} />
          <Rate company={company} accessToken={accessToken} onDone={load} />
          <ThisWeek company={company} accessToken={accessToken} />
        </div>
      ) : null}
    </div>
  );
}

function AddCompany({ accessToken, onDone }: { accessToken: string | null; onDone: () => void }) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/admin/companies", accessToken, {
        method: "POST",
        body: JSON.stringify({
          name,
          ...(contactName.trim() ? { contactName } : {}),
          ...(contactPhone.trim() ? { contactPhone } : {}),
        }),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't add the company."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="max-w-[520px] space-y-4 p-6">
      <h2 className="text-[15px] font-semibold">Add the delivery company</h2>
      <TextField label="Company name" value={name} onChange={setName} required />
      <TextField label="Contact person" value={contactName} onChange={setContactName} />
      <TextField label="Contact phone" value={contactPhone} onChange={setContactPhone} inputMode="tel" />
      <FormError message={error} />
      <Button label={busy ? "Adding…" : "Add company"} onClick={save} disabled={busy || name.trim().length < 2} />
    </Card>
  );
}

function WhoDelivers({
  data,
  company,
  accessToken,
  onDone,
}: {
  data: CompaniesResponse;
  company: Company;
  accessToken: string | null;
  onDone: () => void;
}) {
  const [hub, setHub] = useState(data.hubAddress);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isCompany = data.mode === "company";

  async function save(mode: "company" | "independent") {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/admin/delivery-mode", accessToken, {
        method: "PUT",
        body: JSON.stringify({
          mode,
          ...(mode === "company" ? { companyId: company.id } : {}),
          ...(hub.trim() && hub.trim() !== data.hubAddress ? { hubAddress: hub.trim() } : {}),
        }),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't change who delivers."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-[15px] font-semibold">Who delivers</h2>
      <div role="radiogroup" aria-label="Who delivers" className="flex max-w-[460px] gap-1 rounded-full bg-surface-muted p-1">
        {(["company", "independent"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={data.mode === m}
            disabled={busy}
            onClick={() => data.mode !== m && save(m)}
            className={`min-h-[40px] flex-1 rounded-full text-[13.5px] ${data.mode === m ? "bg-surface font-semibold text-ink shadow-sm" : "text-muted"}`}
          >
            {m === "company" ? company.name : "Independent riders"}
          </button>
        ))}
      </div>
      <p className="text-[12.5px] text-muted">
        {isCompany
          ? `${company.name} collects on its list link and brings it to Wave. Wave packs and delivers.`
          : "Riders claim jobs from the open feed."}
      </p>
      <div className="flex max-w-[620px] flex-wrap items-end gap-3">
        <div className="min-w-[280px] flex-1">
          <TextField label="Packing point (shown on the company's list)" value={hub} onChange={setHub} required />
        </div>
        <Button
          label="Save address"
          variant="secondary"
          onClick={() => save(data.mode)}
          disabled={busy || !hub.trim() || hub.trim() === data.hubAddress}
        />
      </div>
      <FormError message={error} />
    </Card>
  );
}

function ListLink({ company, accessToken, onDone }: { company: Company; accessToken: string | null; onDone: () => void }) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ path: string }>(`/admin/companies/${company.id}/list-link`, accessToken, { method: "POST" });
      setFresh(`${window.location.origin}${res.path}`);
      setCopied(false);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't make a link."));
    } finally {
      setBusy(false);
    }
  }
  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/companies/${company.id}/list-link`, accessToken, { method: "DELETE" });
      setFresh(null);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't turn the link off."));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-[15px] font-semibold">Their list link</h2>
      {fresh ? (
        <div className="flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-control border border-border px-3 py-2.5 text-[13px]">{fresh}</code>
          <Button label={copied ? "Copied" : "Copy link"} icon={<Copy size={16} aria-hidden />} onClick={copy} />
        </div>
      ) : null}
      {fresh ? (
        <p className="text-[12.5px] text-muted">Send this to {company.name}. It is shown once; making a new link stops this one.</p>
      ) : company.hasListLink ? (
        <p className="text-[13px] text-ink">A link is live. Make a new one if you need to send it again; the old one stops working.</p>
      ) : (
        <p className="text-[13px] text-muted">No link yet.</p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button label={company.hasListLink || fresh ? "New link" : "Make a link"} variant={company.hasListLink ? "secondary" : "primary"} onClick={make} disabled={busy} />
        {company.hasListLink || fresh ? <Button label="Turn off" variant="danger" onClick={turnOff} disabled={busy} /> : null}
      </div>
      <FormError message={error} />
    </Card>
  );
}

function Rate({ company, accessToken, onDone }: { company: Company; accessToken: string | null; onDone: () => void }) {
  const [type, setType] = useState<"" | "flat" | "percent">(company.rateType ?? "");
  const [value, setValue] = useState(company.rateValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/admin/companies/${company.id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify(type ? { rateType: type, rateValue: Number(value) } : { rateType: null }),
      });
      setSaved(true);
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the rate."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-[15px] font-semibold">Rate per delivery</h2>
      <div role="radiogroup" aria-label="Rate type" className="flex max-w-[420px] gap-1 rounded-full bg-surface-muted p-1">
        {([["", "Not set"], ["flat", "GH₵ each"], ["percent", "% of fee"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={type === k}
            onClick={() => setType(k)}
            className={`min-h-[38px] flex-1 rounded-full text-[13px] ${type === k ? "bg-surface font-semibold text-ink shadow-sm" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {type ? (
        <div className="max-w-[240px]">
          <TextField label={type === "flat" ? "GH₵ per delivery" : "Percent of the delivery fee"} value={value} onChange={setValue} inputMode="decimal" required />
        </div>
      ) : (
        <p className="text-[12.5px] text-muted">Until a rate is set, the statement shows counts and fees only.</p>
      )}
      <div className="flex items-center gap-3">
        <Button label={busy ? "Saving…" : "Save rate"} onClick={save} disabled={busy || (type !== "" && !(Number(value) >= 0 && value.trim() !== ""))} />
        {saved ? <span className="text-[12.5px] text-muted">Saved</span> : null}
      </div>
      <FormError message={error} />
    </Card>
  );
}

function ThisWeek({ company, accessToken }: { company: Company; accessToken: string | null }) {
  const week = weekRange();
  const [st, setSt] = useState<Statement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<Statement>(`/admin/companies/${company.id}/statement?from=${week.from}&to=${week.to}`, accessToken)
      .then(setSt)
      .catch(() => setError("Could not load this week's statement."));
  }, [accessToken, company.id, company.rateType, company.rateValue, week.from, week.to]);

  function download() {
    if (!st) return;
    const lines = [
      "Order,Date,Delivery fee,Owed",
      ...st.lines.map((l) => [l.orderId, l.date.slice(0, 10), l.deliveryFee.toFixed(2), l.owed?.toFixed(2) ?? ""].join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${company.name.replace(/\s+/g, "-").toLowerCase()}-${week.from}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Card className="max-w-[460px] space-y-3 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold">This week</h2>
        <span className="text-[12.5px] text-muted">{week.label}</span>
      </div>
      {error ? <p className="text-[13px] text-danger-text">{error}</p> : null}
      {st ? (
        <dl className="text-[13.5px]">
          <div className="flex justify-between py-1.5"><dt className="text-muted">Delivered</dt><dd className="font-semibold">{st.delivered}</dd></div>
          <div className="flex justify-between py-1.5"><dt className="text-muted">Fees collected</dt><dd className="font-semibold">{ghs(st.feesTotal)}</dd></div>
          <div className="mt-1 flex justify-between border-t border-border pt-3"><dt className="font-semibold">Owed to {company.name}</dt><dd className="text-[17px] font-bold">{st.owedTotal === null ? "Set a rate" : ghs(st.owedTotal)}</dd></div>
        </dl>
      ) : null}
      <Button label="Download statement" variant="secondary" onClick={download} disabled={!st || st.lines.length === 0} />
    </Card>
  );
}
