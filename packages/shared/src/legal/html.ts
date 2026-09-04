/**
 * Renders a `LegalDoc` to a standalone HTML page.
 *
 * Used by `apps/mobile/scripts/build-legal-html.ts` to emit the canonical pages
 * into `apps/mobile/public/legal/`, which Vercel serves as static files. The
 * output is deliberately self-contained — inline CSS, no fonts fetched, no
 * script — because these are the pages a student taps at signup on a phone
 * network, and the pages an app store reviewer fetches. Nothing about them
 * should be able to fail to load.
 *
 * Styling follows the v6 system: ink `#083400` on canvas `#f7f7f7`, white card,
 * 12px card radius, no gradient, no shadow, no emoji.
 */
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_REVIEWED,
  type LegalBlock,
  type LegalDoc,
} from "./content";

/** Escapes text for HTML body context. Content is ours, but it contains `&`. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBlock(block: LegalBlock): string {
  switch (block.kind) {
    case "p":
      return `<p>${esc(block.text)}</p>`;
    case "ul":
      return `<ul>${block.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
    case "table":
      return [
        '<div class="scroll"><table>',
        `<thead><tr><th>${esc(block.head[0])}</th><th>${esc(block.head[1])}</th></tr></thead>`,
        "<tbody>",
        block.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join(""),
        "</tbody></table></div>",
      ].join("");
  }
}

const STYLES = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #f7f7f7;
  color: #083400;
  font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.6;
}
.wrap { max-width: 680px; margin: 0 auto; padding: 40px 20px; }
header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 32px; }
header .brand { font-size: 15px; font-weight: 600; text-decoration: none; color: #083400; }
header nav a { font-size: 13px; color: #6a6a6a; text-decoration: none; margin-left: 16px; }
header nav a:hover { color: #083400; }
main { background: #ffffff; border-radius: 12px; padding: 32px 24px; }
h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
.updated { font-size: 13px; color: #6a6a6a; margin: 4px 0 0; }
h2 { font-size: 15px; font-weight: 600; margin: 32px 0 8px; }
p, li { font-size: 14px; }
ul { padding-left: 20px; margin: 12px 0; }
li { margin-bottom: 4px; }
a { color: #083400; }
.draft {
  border: 1px solid #EFE0C2;
  background: #FDF4E3;
  color: #8A6A24;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 32px;
  font-size: 13px;
}
.scroll { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; margin: 12px 0; }
th { color: #6a6a6a; font-weight: 500; padding: 8px 16px 8px 0; border-bottom: 1px solid #ebebeb; }
td { padding: 8px 16px 8px 0; border-bottom: 1px solid #ebebeb; vertical-align: top; }
footer { margin-top: 24px; font-size: 12px; color: #6a6a6a; }
`.trim();

const DRAFT_BANNER = `<div class="draft"><strong>Draft — not yet reviewed.</strong> This document describes how Wave actually works today, but it has not been checked by a qualified adviser and is not final. Do not rely on it as a statement of your legal rights until this notice is removed.</div>`;

export function renderLegalHtml(doc: LegalDoc): string {
  const body = doc.sections
    .map((section) => `<h2>${esc(section.title)}</h2>${section.blocks.map(renderBlock).join("")}`)
    .join("");

  const contact = [
    "<h2>Contact</h2>",
    `<p>Questions about this document, or a request about your own data, go to `,
    `<a href="mailto:${esc(LEGAL_CONTACT_EMAIL)}">${esc(LEGAL_CONTACT_EMAIL)}</a>.</p>`,
  ].join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wave — ${esc(doc.title)}</title>
<meta name="description" content="${esc(doc.description)}">
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
<header>
<a class="brand" href="/legal/terms.html">Wave</a>
<nav><a href="/legal/terms.html">Terms</a><a href="/legal/privacy.html">Privacy</a></nav>
</header>
<main>
${LEGAL_REVIEWED ? "" : DRAFT_BANNER}
<h1>${esc(doc.title)}</h1>
<p class="updated">Last updated ${esc(LEGAL_LAST_UPDATED)}</p>
${body}
${contact}
</main>
<footer>Wave — campus delivery, Ashesi University, Berekuso, Ghana.</footer>
</div>
</body>
</html>
`;
}
