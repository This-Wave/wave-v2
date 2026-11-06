"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROLE_PERMISSIONS } from "@wave/shared";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Button, RowAction } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { FormError, SelectField, TextField } from "../../../components/ui/Field";
import { Card } from "../../../components/ui/Card";

interface CampusAdmin {
  id: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  updatedAt: string;
  adminUniversity: { id: string; name: string } | null;
}

interface University {
  id: string;
  name: string;
}

const CAN_DO: Record<string, string> = {
  "ops.read": "See their campus's orders, users, shops and checkpoints",
  "pii.read": "See full phone numbers and rider IDs at their campus",
  "riders.verify": "Approve and reject riders",
  "checkpoints.manage": "Manage checkpoints",
  "switches.manage": "Pause and resume ordering at their campus",
  "orders.force_deliver": "Close a stuck delivery without a PIN",
  "shops.manage": "Approve, add and suspend shops",
  "suggestions.manage": "Onboard or reject suggested shops",
  "beta.review": "Approve beta testers from their campus",
  "refunds.request": "Ask HQ to refund an order (HQ approves)",
};

/**
 * University admins. Owner and Support add them here, and adding someone is
 * the approval — there is no pending state to forget about.
 */
export default function CampusAdminsPage() {
  const { accessToken, can } = useAdminAuth();
  const [admins, setAdmins] = useState<CampusAdmin[] | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<CampusAdmin | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    apiFetch<{ admins: CampusAdmin[]; universities: University[] }>("/admin/campus-admins", accessToken)
      .then((res) => {
        setAdmins(res.admins);
        setUniversities(res.universities);
      })
      .catch(() => {
        setAdmins([]);
        setError("Could not load campus admins.");
      });
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const perCampus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of admins ?? []) {
      if (a.adminUniversity) counts.set(a.adminUniversity.id, (counts.get(a.adminUniversity.id) ?? 0) + 1);
    }
    return counts;
  }, [admins]);

  if (!can("campus_admins.manage")) {
    return (
      <div className="px-10 py-8">
        <PageHeader title="Campus admins" />
        <p className="text-[13px] text-muted">Only an owner or Support can manage campus admins.</p>
      </div>
    );
  }

  const columns: Column<CampusAdmin>[] = [
    { header: "Name", render: (a) => <span className="font-semibold">{a.fullName}</span> },
    { header: "University", render: (a) => <span>{a.adminUniversity?.name ?? "—"}</span> },
    { header: "Phone", width: "w-[170px]", render: (a) => <span className="text-muted">{a.phone}</span> },
    {
      header: "Status",
      width: "w-[130px]",
      render: (a) => <StatusPill label={a.isActive ? "Active" : "Deactivated"} tone={a.isActive ? "good" : "bad"} />,
    },
    {
      header: "",
      width: "w-[110px]",
      align: "right",
      render: (a) => <RowAction label="Remove" tone="danger" onClick={() => setRemoving(a)} />,
    },
  ];

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Campus admins"
        subtitle="People who run one university. They see and act on their campus only; refunds they ask for come to HQ."
        action={<Button label="Add campus admin" onClick={() => setAdding(true)} />}
      />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <div className="mb-6 flex flex-wrap gap-3">
        {universities.map((u) => (
          <Card key={u.id} className="min-w-[200px] px-5 py-4">
            <p className="text-[13.5px] font-semibold text-ink">{u.name}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {perCampus.get(u.id) ? `${perCampus.get(u.id)} admin${perCampus.get(u.id) === 1 ? "" : "s"}` : "No admin yet"}
            </p>
          </Card>
        ))}
      </div>

      <DataTable columns={columns} rows={admins} rowKey={(a) => a.id} emptyMessage="No campus admins yet." />

      <h2 className="mb-3 mt-10 text-[15px] font-semibold text-ink">What a campus admin can do</h2>
      <Card className="max-w-[620px] p-5">
        <ul className="space-y-1.5">
          {ROLE_PERMISSIONS.campus_admin.map((p) => (
            <li key={p} className="text-[13px] text-ink">
              {CAN_DO[p] ?? p}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12.5px] leading-5 text-muted">
          They can&apos;t change pricing, feature flags, other campuses, or the every-university pause, and they
          never move money themselves.
        </p>
      </Card>

      <AddModal
        open={adding}
        universities={universities}
        accessToken={accessToken}
        onClose={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          load();
        }}
      />
      <RemoveModal
        admin={removing}
        accessToken={accessToken}
        onClose={() => setRemoving(null)}
        onDone={() => {
          setRemoving(null);
          load();
        }}
      />
    </div>
  );
}

function AddModal({
  open,
  universities,
  accessToken,
  onClose,
  onDone,
}: {
  open: boolean;
  universities: University[];
  accessToken: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && universities.length === 1) setUniversityId(universities[0]!.id);
  }, [open, universities]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/admin/campus-admins", accessToken, {
        method: "POST",
        body: JSON.stringify({ phone, universityId }),
      });
      setPhone("");
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not add that person."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Add a campus admin"
      description="Adding them is the approval. They sign in with the Wave account they already have, and while they are a campus admin that account stops being a student, rider or shop account."
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button label={saving ? "Adding…" : "Add and approve"} disabled={saving || !phone || !universityId} onClick={submit} />
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Phone number" required inputMode="tel" value={phone} onChange={setPhone} placeholder="024 123 4567" />
        <SelectField
          label="University they will run"
          required
          value={universityId}
          onChange={setUniversityId}
          options={universities.map((u) => ({ value: u.id, label: u.name }))}
        />
        <FormError message={error} />
      </div>
    </Modal>
  );
}

function RemoveModal({
  admin,
  accessToken,
  onClose,
  onDone,
}: {
  admin: CampusAdmin | null;
  accessToken: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [revertTo, setRevertTo] = useState("student");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!admin) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/campus-admins/${admin.id}`, accessToken, { method: "DELETE", body: JSON.stringify({ revertTo }) });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not remove them."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={admin !== null}
      title={`Remove ${admin?.fullName ?? ""} as campus admin`}
      description="They lose admin access at once. Their account stays, as the role you choose."
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button label={saving ? "Removing…" : "Remove"} variant="danger" disabled={saving} onClick={submit} />
        </>
      }
    >
      <div className="space-y-4">
        <SelectField
          label="They go back to being a"
          required
          value={revertTo}
          onChange={setRevertTo}
          options={[
            { value: "student", label: "Student" },
            { value: "rider", label: "Rider" },
            { value: "shop_owner", label: "Shop owner" },
          ]}
        />
        <FormError message={error} />
      </div>
    </Modal>
  );
}
