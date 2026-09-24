"use client";

import { useCallback, useEffect, useState } from "react";
import { ROLE_PERMISSIONS, STAFF_ROLES, staffRoleLabel, type StaffRole } from "@wave/shared";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch, errorMessage } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Button, RowAction } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { FormError, SelectField, TextField } from "../../../components/ui/Field";

interface StaffMember {
  id: string;
  fullName: string;
  phone: string;
  staffRole: StaffRole | null;
  isActive: boolean;
  updatedAt: string;
}

// HQ roles only: a campus admin needs a university, so they are added on the
// Campus admins page.
const ROLE_OPTIONS = STAFF_ROLES.filter((r) => r.key !== "campus_admin").map((r) => ({ value: r.key, label: r.label }));

const PERMISSION_LABEL: Record<string, string> = {
  "ops.read": "See orders, users, shops",
  "pii.read": "See full phone numbers and rider IDs",
  "orders.force_deliver": "Close a delivery without a PIN",
  "refunds.issue": "Issue refunds",
  "refunds.request": "Ask HQ to refund an order",
  "refunds.approve": "Approve refund requests from campuses",
  "campus_admins.manage": "Add and remove campus admins",
  "payments.read": "See payment references",
  "payments.sweep": "Run the abandoned-checkout sweep",
  "config.write": "Change pricing",
  "riders.verify": "Approve and reject riders",
  "checkpoints.manage": "Manage checkpoints",
  "switches.manage": "Pause and resume ordering",
  "flags.manage": "Turn features on and off",
  "users.ban": "Deactivate and reactivate customers",
  "users.role": "Move people between student and rider",
  "shops.manage": "Create and edit shops",
  "suggestions.manage": "Onboard or reject suggested shops",
  "beta.review": "Approve beta testers",
  "audit.read_all": "Read the whole audit log",
  "staff.manage": "Add and remove HQ staff",
};

export default function StaffPage() {
  const { accessToken, profile, can } = useAdminAuth();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [removing, setRemoving] = useState<StaffMember | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    setError(null);
    apiFetch<{ staff: StaffMember[] }>("/admin/staff", accessToken)
      .then((res) => setStaff(res.staff))
      .catch(() => {
        setStaff([]);
        setError("Could not load staff. Check your connection and try again.");
      });
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (!can("staff.manage")) {
    return (
      <div className="px-10 py-8">
        <PageHeader title="Staff" />
        <p className="text-[13px] text-muted">Only an owner can manage staff.</p>
      </div>
    );
  }

  const columns: Column<StaffMember>[] = [
    {
      header: "Name",
      render: (s) => <span className="font-semibold">{s.fullName}</span>,
    },
    {
      header: "Phone",
      width: "w-[170px]",
      render: (s) => <span className="text-muted">{s.phone}</span>,
    },
    {
      header: "Role",
      width: "w-[170px]",
      render: (s) => (
        <StatusPill label={staffRoleLabel(s.staffRole)} tone={s.staffRole === "owner" ? "good" : "neutral"} />
      ),
    },
    {
      header: "Status",
      width: "w-[130px]",
      render: (s) => (
        <StatusPill label={s.isActive ? "Active" : "Deactivated"} tone={s.isActive ? "good" : "bad"} />
      ),
    },
    {
      header: "",
      width: "w-[190px]",
      align: "right",
      render: (s) =>
        s.id === profile?.id ? (
          <span className="text-[12.5px] text-muted">You</span>
        ) : (
          <div className="flex justify-end gap-4">
            <RowAction label="Change role" onClick={() => setEditing(s)} />
            <RowAction label="Remove" tone="danger" onClick={() => setRemoving(s)} />
          </div>
        ),
    },
  ];

  return (
    <div className="px-10 py-8">
      <PageHeader
        title="Staff"
        subtitle="Who works at Ride the Wave Logistics, and what each role can do"
        action={<Button label="Add staff" onClick={() => setAdding(true)} />}
      />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <DataTable columns={columns} rows={staff} rowKey={(s) => s.id} emptyMessage="No staff yet." />

      <h2 className="mb-3 mt-10 text-[15px] font-semibold text-ink">What each role can do</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {STAFF_ROLES.map((role) => (
          <div key={role.key} className="rounded-card border border-border bg-surface p-5">
            <p className="text-[14px] font-semibold text-ink">{role.label}</p>
            <p className="mb-3 mt-1 text-[12.5px] leading-5 text-muted">{role.description}</p>
            <ul className="space-y-1">
              {ROLE_PERMISSIONS[role.key].map((p) => (
                <li key={p} className="text-[12.5px] text-ink">
                  {PERMISSION_LABEL[p] ?? p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <AddStaffModal
        open={adding}
        accessToken={accessToken}
        onClose={() => setAdding(false)}
        onDone={() => {
          setAdding(false);
          load();
        }}
      />
      <ChangeRoleModal
        member={editing}
        accessToken={accessToken}
        onClose={() => setEditing(null)}
        onDone={() => {
          setEditing(null);
          load();
        }}
      />
      <RemoveStaffModal
        member={removing}
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

function AddStaffModal({
  open,
  accessToken,
  onClose,
  onDone,
}: {
  open: boolean;
  accessToken: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/admin/staff", accessToken, {
        method: "POST",
        body: JSON.stringify({ phone, staffRole }),
      });
      setPhone("");
      setStaffRole("");
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
      title="Add staff"
      description="They sign in with the Wave account they already have. While they are staff, that account stops being a student, rider or shop account."
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label={saving ? "Adding…" : "Add"}
            disabled={saving || !phone || !staffRole}
            onClick={submit}
          />
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Phone number"
          required
          inputMode="tel"
          value={phone}
          onChange={setPhone}
          placeholder="024 123 4567"
        />
        <SelectField label="Role" required value={staffRole} onChange={setStaffRole} options={ROLE_OPTIONS} />
        <FormError message={error} />
      </div>
    </Modal>
  );
}

function ChangeRoleModal({
  member,
  accessToken,
  onClose,
  onDone,
}: {
  member: StaffMember | null;
  accessToken: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [staffRole, setStaffRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStaffRole(member?.staffRole ?? "");
    setError(null);
  }, [member]);

  async function submit() {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/staff/${member.id}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify({ staffRole }),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not change the role."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={member !== null}
      title={`Change ${member?.fullName ?? ""}'s role`}
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label={saving ? "Saving…" : "Save"}
            disabled={saving || !staffRole || staffRole === member?.staffRole}
            onClick={submit}
          />
        </>
      }
    >
      <div className="space-y-4">
        <SelectField label="Role" required value={staffRole} onChange={setStaffRole} options={ROLE_OPTIONS} />
        <FormError message={error} />
      </div>
    </Modal>
  );
}

function RemoveStaffModal({
  member,
  accessToken,
  onClose,
  onDone,
}: {
  member: StaffMember | null;
  accessToken: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [revertTo, setRevertTo] = useState("student");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/staff/${member.id}`, accessToken, {
        method: "DELETE",
        body: JSON.stringify({ revertTo }),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not remove them."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={member !== null}
      title={`Remove ${member?.fullName ?? ""} from staff`}
      description="They lose admin access at once. Their account stays, as the role you choose."
      onClose={onClose}
      footer={
        <>
          <Button label="Cancel" variant="secondary" onClick={onClose} />
          <Button
            label={saving ? "Removing…" : "Remove"}
            variant="danger"
            disabled={saving}
            onClick={submit}
          />
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
