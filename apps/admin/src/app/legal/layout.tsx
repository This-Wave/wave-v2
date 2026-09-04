import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Public shell for /legal/*.
 *
 * These render server-side per request rather than as prerendered HTML, because
 * the root layout sets `force-dynamic` and a child segment cannot opt back into
 * static. Don't "fix" that by moving the root's flag: it is a server component,
 * while `(app)/layout.tsx`, `page.tsx` and `login/page.tsx` are all `"use
 * client"`, where `export const dynamic` is silently ignored. Removing it from
 * the root therefore turns the whole dashboard static rather than relocating the
 * opt-out. It costs these two pages nothing — they touch no session and no API,
 * so the work per request is rendering fixed text.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas px-5 py-10">
      <div className="mx-auto w-full max-w-[680px]">
        <header className="mb-8 flex items-baseline justify-between gap-4">
          <Link href="/legal" className="text-[15px] font-semibold tracking-tight text-ink">
            Wave
          </Link>
          <nav className="flex gap-4 text-[13px] text-muted">
            <Link className="hover:text-ink" href="/legal/terms">
              Terms
            </Link>
            <Link className="hover:text-ink" href="/legal/privacy">
              Privacy
            </Link>
          </nav>
        </header>
        <main className="rounded-card bg-surface px-6 py-8">{children}</main>
        <p className="mt-6 text-[12px] text-muted">Wave — campus delivery, Ashesi University, Berekuso, Ghana.</p>
      </div>
    </div>
  );
}
