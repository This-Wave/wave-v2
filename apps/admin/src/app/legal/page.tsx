import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL_DOCS, LEGAL_LAST_UPDATED } from "@wave/shared";

export const metadata: Metadata = {
  title: "Wave — Legal",
  description: "Wave's terms of service, privacy policy and refund policy.",
};

// Driven off LEGAL_DOCS rather than a hand-listed pair, so a document added to
// the shared source appears here without anyone remembering to add it.
const DOCS = LEGAL_DOCS.map((doc) => ({
  href: `/legal/${doc.slug}`,
  title: doc.title,
  blurb: doc.description,
}));

export default function LegalIndex() {
  return (
    <>
      <h1 className="text-[22px] font-semibold tracking-tight text-ink">Legal</h1>
      <p className="mt-1 text-[13px] text-muted">Last updated {LEGAL_LAST_UPDATED}</p>
      <div className="mt-6 space-y-3">
        {DOCS.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="block rounded-card border border-border px-4 py-3 hover:border-ink"
          >
            <span className="text-[14px] font-medium text-ink">{doc.title}</span>
            <span className="mt-0.5 block text-[13px] text-muted">{doc.blurb}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
