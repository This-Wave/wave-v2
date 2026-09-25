import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found — Wave Admin",
};

/**
 * The App Router's 404. Without this file Next serves its own black-and-white
 * default, which does not look like Wave and, more importantly, offers no way
 * back — an admin who mistypes a URL is left staring at a dead end.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-[380px] rounded-[14px] border border-border bg-surface p-8 shadow-sm">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink">
          Wave Admin
        </p>
        <h1 className="mb-2 text-[22px] font-extrabold tracking-tight text-ink">Page not found</h1>
        <p className="mb-6 text-[13px] text-muted">
          That address does not exist. It may have been renamed, or the link that brought you here
          may be out of date.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-pill bg-lime px-4 py-2 text-sm font-medium text-admin-text"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
