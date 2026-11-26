"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, FilterTabs, type Column } from "../../../components/ui/DataTable";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Modal } from "../../../components/ui/Modal";
import { FormError, SelectField, TextField } from "../../../components/ui/Field";
import { StatusPill } from "../../../components/ui/StatusPill";

type Channel = "push" | "sms";
type AudienceType = "everyone" | "campus" | "phones";

interface Sent {
  id: string;
  channel: Channel;
  audience: string;
  title: string | null;
  body: string;
  recipients: number;
  delivered: number;
  failed: number;
  createdAt: string;
}
interface University {
  id: string;
  name: string;
}

const BODY_MAX = 300;

/**
 * Super admin only (`messages.send`): send a push notification or an SMS to
 * every student, one campus, or numbers typed in. Push reaches only people who
 * turned notifications on; SMS reaches every number. Each send asks to confirm
 * first and lands in the history below with how many it reached.
 */
export default function MessagesPage() {
  const { accessToken } = useAdminAuth();
  const [channel, setChannel] = useState<Channel>("push");
  const [audienceType, setAudienceType] = useState<AudienceType>("everyone");
  const [universityId, setUniversityId] = useState("");
  const [phones, setPhones] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [history, setHistory] = useState<Sent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    apiFetch<{ messages: Sent[] }>("/admin/messages", accessToken)
      .then((r) => setHistory(r.messages))
      .catch(() => {
        setHistory([]);
        setError("Could not load sent messages.");
      });
    apiFetch<University[] | { universities: University[] }>("/universities", accessToken)
      .then((r) => setUniversities(Array.isArray(r) ? r : r.universities))
      .catch(() => setUniversities([]));
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const phoneList = phones
    .split(/[\s,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const ready =
    body.trim().length > 0 &&
    body.length <= BODY_MAX &&
    (channel === "sms" || title.trim().length > 0) &&
    (audienceType !== "campus" || !!universityId) &&
    (audienceType !== "phones" || phoneList.length > 0);

  const audienceLabel =
    audienceType === "everyone"
      ? "every active student"
      : audienceType === "campus"
        ? `students at ${universities.find((u) => u.id === universityId)?.name ?? "this campus"}`
        : `${phoneList.length} number${phoneList.length === 1 ? "" : "s"}`;

  async function send() {
    if (!accessToken) return;
    setSending(true);
    setSendError(null);
    try {
      const audience =
        audienceType === "everyone"
          ? { type: "everyone" as const }
          : audienceType === "campus"
            ? { type: "campus" as const, universityId }
            : { type: "phones" as const, phones: phoneList };
      const res = await apiFetch<{ message: Sent }>("/admin/messages", accessToken, {
        method: "POST",
        body: JSON.stringify({ channel, audience, title: channel === "push" ? title.trim() : undefined, body: body.trim() }),
      });
      setConfirming(false);
      setResult(`Sent to ${res.message.delivered} of ${res.message.recipients}.`);
      setBody("");
      setTitle("");
      load();
    } catch (err) {
      setSendError(errorMessage(err, "Could not send."));
    } finally {
      setSending(false);
    }
  }

  const columns: Column<Sent>[] = [
    { header: "When", width: "w-[150px]", render: (m) => new Date(m.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) },
    { header: "Type", width: "w-[90px]", render: (m) => <StatusPill label={m.channel === "sms" ? "SMS" : "Push"} /> },
    { header: "Message", render: (m) => (m.title ? `${m.title}: ${m.body}` : m.body) },
    { header: "To", width: "w-[140px]", render: (m) => (m.audience.startsWith("campus:") ? "One campus" : m.audience === "phones" ? "Numbers" : "Everyone") },
    {
      header: "Reached",
      width: "w-[110px]",
      align: "right",
      render: (m) => <StatusPill label={`${m.delivered}/${m.recipients}`} tone={m.failed > 0 ? "warn" : "good"} />,
    },
  ];

  return (
    <div>
      <PageHeader title="Messages" subtitle="Send a push notification or an SMS to students." />
      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <Card className="mb-8 max-w-[720px] p-6">
        <FilterTabs
          tabs={[
            { key: "push", label: "Push notification" },
            { key: "sms", label: "SMS" },
          ]}
          active={channel}
          onChange={setChannel}
        />
        <p className="mb-5 text-[13px] text-muted">
          {channel === "push"
            ? "Reaches only students who turned on notifications. Free."
            : "Reaches every phone number. Each text uses an SMS credit."}
        </p>
        <div className="grid gap-4">
          <SelectField
            label="Send to"
            value={audienceType}
            onChange={(v) => setAudienceType(v as AudienceType)}
            options={[
              { value: "everyone", label: "Every active student" },
              { value: "campus", label: "One campus" },
              { value: "phones", label: "Phone numbers I type" },
            ]}
          />
          {audienceType === "campus" ? (
            <SelectField
              label="Campus"
              value={universityId}
              onChange={setUniversityId}
              options={universities.map((u) => ({ value: u.id, label: u.name }))}
            />
          ) : null}
          {audienceType === "phones" ? (
            <TextField label="Phone numbers" value={phones} onChange={setPhones} multiline placeholder="0241234567, 0551234567" hint="Separate with commas, spaces or new lines." />
          ) : null}
          {channel === "push" ? <TextField label="Title" value={title} onChange={setTitle} placeholder="Your parcel is on its way" /> : null}
          <TextField
            label="Message"
            value={body}
            onChange={setBody}
            multiline
            hint={`${body.length}/${BODY_MAX}${channel === "sms" && body.length > 160 ? " · sends as 2 texts" : ""}`}
          />
        </div>
        {result ? <p className="mt-4 text-[13px] text-ink" role="status">{result}</p> : null}
        <div className="mt-5">
          <Button label="Review and send" disabled={!ready} onClick={() => { setResult(null); setConfirming(true); }} />
        </div>
      </Card>

      <h2 className="mb-3 text-[15px] font-semibold text-ink">Sent</h2>
      <DataTable columns={columns} rows={history} rowKey={(m) => m.id} emptyMessage="Nothing sent yet." />

      <Modal
        open={confirming}
        title={channel === "push" ? "Send this notification?" : "Send this SMS?"}
        description={`To ${audienceLabel}. This can't be undone.`}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button label="Cancel" variant="secondary" onClick={() => setConfirming(false)} />
            <Button label={sending ? "Sending…" : "Send"} disabled={sending} onClick={() => void send()} />
          </>
        }
      >
        {channel === "push" ? <p className="mb-1 font-semibold text-ink">{title}</p> : null}
        <p className="whitespace-pre-wrap text-[14px] text-ink">{body}</p>
        <FormError message={sendError} />
      </Modal>
    </div>
  );
}
