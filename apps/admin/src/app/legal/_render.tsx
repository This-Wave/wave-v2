/**
 * Renders a `LegalDoc` from `@wave/shared` as React.
 *
 * This is the *mirror*. The canonical copies are the static files the Expo web
 * build writes to `apps/mobile/public/legal/`, which is where
 * `EXPO_PUBLIC_TERMS_URL` and `EXPO_PUBLIC_PRIVACY_URL` point — Vercel serves
 * those with no cold start, while this dashboard sits on Render's free tier and
 * took 53 seconds to answer a cold request when it was measured.
 *
 * Both renderers read the same data, so there is no copy to keep in sync: edit
 * `packages/shared/src/legal/content.ts` and both follow.
 */
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_REVIEWED,
  type LegalBlock,
  type LegalDoc,
} from "@wave/shared";

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return <p>{block.text}</p>;
    case "ul":
      return (
        <ul className="list-disc space-y-1 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium text-muted">{block.head[0]}</th>
                <th className="py-2 font-medium text-muted">{block.head[1]}</th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map(([what, why]) => (
                <tr key={what} className="border-b border-border align-top">
                  <td className="py-2 pr-4 text-ink">{what}</td>
                  <td className="py-2 text-ink">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function LegalDocView({ doc }: { doc: LegalDoc }) {
  return (
    <>
      {!LEGAL_REVIEWED && (
        <div className="mb-8 rounded-card border border-warning-border bg-warning-bg px-4 py-3">
          <p className="text-[13px] leading-relaxed text-warning-text">
            <strong className="font-semibold">Draft — not yet reviewed.</strong> This document describes how Wave
            actually works today, but it has not been checked by a qualified adviser and is not final. Do not
            rely on it as a statement of your legal rights until this notice is removed.
          </p>
        </div>
      )}

      <h1 className="text-[22px] font-semibold tracking-tight text-ink">{doc.title}</h1>
      <p className="mt-1 text-[13px] text-muted">Last updated {LEGAL_LAST_UPDATED}</p>

      {doc.sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-[15px] font-semibold text-ink">{section.title}</h2>
          <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-ink">
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink">Contact</h2>
        <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-ink">
          <p>
            Questions about this document, or a request about your own data, go to{" "}
            <a className="underline underline-offset-2" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
