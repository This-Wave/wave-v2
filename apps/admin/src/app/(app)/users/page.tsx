"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "../../../providers/AdminAuthProvider";
import { apiFetch } from "../../../lib/api";
import { FetchErrorBanner } from "../../../components/FetchErrorBanner";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable, FilterTabs, type Column } from "../../../components/ui/DataTable";
import { StatusPill } from "../../../components/ui/StatusPill";
import { RowAction } from "../../../components/ui/Button";

type Role = "student" | "rider" | "shop_owner" | "admin";
type RoleFilter = Role | "all";

interface User {
  id: string;
  fullName: string;
  phone: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "All roles" },
  { key: "student", label: "Students" },
  { key: "rider", label: "Riders" },
  { key: "shop_owner", label: "Shop owners" },
  { key: "admin", label: "Admins" },
];

const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  rider: "Rider",
  shop_owner: "Shop owner",
  admin: "Admin",
};

/** A student who passes rider verification is promoted here. */
const NEXT_ROLE: Partial<Record<Role, Role>> = {
  student: "rider",
  rider: "student",
};

const PAGE_SIZE = 25;

export default function UsersPage() {
  const { accessToken, profile } = useAdminAuth();
  const [role, setRole] = useState<RoleFilter>("all");
  const [search, setSearch] = useState("");
  // Debounced copy of `search`. The list is paged server-side now, so filtering
  // in the browser would only ever search the page you happen to be looking at.
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Any change to what is being asked for starts again at page one — otherwise
  // a filter applied on page 4 lands on an empty page.
  useEffect(() => {
    setPage(1);
  }, [role, query]);

  const load = useCallback(() => {
    if (!accessToken) return;
    setUsers(null);
    setError(null);
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (role !== "all") params.set("role", role);
    if (query) params.set("search", query);
    apiFetch<{ users: User[]; total: number }>(`/admin/users?${params}`, accessToken)
      .then((res) => {
        setUsers(res.users);
        setTotal(res.total);
      })
      .catch(() => {
        setUsers([]);
        setError("Could not load users. Check your connection and try again.");
      });
  }, [accessToken, role, page, query]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  async function patchUser(id: string, path: "role" | "status", body: object) {
    if (!accessToken) return;
    setActioning(id);
    try {
      await apiFetch(`/admin/users/${id}/${path}`, accessToken, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      load();
    } finally {
      setActioning(null);
    }
  }

  const columns: Column<User>[] = [
    {
      header: "Name",
      render: (u) => <span className="font-semibold">{u.fullName}</span>,
    },
    { header: "Phone", render: (u) => <span className="text-muted">{u.phone}</span> },
    {
      header: "Role",
      width: "w-[150px]",
      render: (u) => <StatusPill label={ROLE_LABEL[u.role]} />,
    },
    {
      header: "Joined",
      width: "w-[130px]",
      render: (u) => (
        <span className="text-muted">{new Date(u.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      header: "Status",
      width: "w-[140px]",
      render: (u) => (
        <StatusPill label={u.isActive ? "Active" : "Deactivated"} tone={u.isActive ? "good" : "bad"} />
      ),
    },
    {
      header: "",
      width: "w-[210px]",
      align: "right",
      render: (u) => {
        // The API rejects self-edits; hide the controls rather than offer a
        // button that is guaranteed to fail.
        if (u.id === profile?.id) return <span className="text-[12.5px] text-muted">You</span>;
        const next = NEXT_ROLE[u.role];
        return (
          <div className="flex justify-end gap-4">
            {next ? (
              <RowAction
                label={`Make ${ROLE_LABEL[next].toLowerCase()}`}
                disabled={actioning === u.id}
                onClick={() => patchUser(u.id, "role", { role: next })}
              />
            ) : null}
            <RowAction
              label={u.isActive ? "Deactivate" : "Reactivate"}
              tone={u.isActive ? "danger" : "default"}
              disabled={actioning === u.id}
              onClick={() => patchUser(u.id, "status", { isActive: !u.isActive })}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="px-10 py-8">
      <PageHeader title="Users" subtitle="All platform users across roles" />

      {error ? <FetchErrorBanner message={error} onRetry={load} /> : null}

      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <div className="flex-1">
          <FilterTabs tabs={ROLE_TABS} active={role} onChange={setRole} />
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or phone"
          className="mb-5 h-10 w-[260px] rounded-control border border-border bg-surface px-4 text-[13px] text-ink outline-none placeholder:text-muted focus:border-wave-500"
        />
      </div>

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(u) => u.id}
        emptyMessage={query ? "No users match that search." : "No users yet."}
      />

      {total > PAGE_SIZE ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-[12px] text-muted">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="rounded-tile border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="rounded-tile border border-border bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
