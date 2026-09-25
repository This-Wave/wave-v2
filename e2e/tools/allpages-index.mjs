/**
 * Turn screenshots/all-pages/manifest.jsonl into index.md and index.html.
 *
 * Run from the repo root after both capture passes (BFM=closed, BFM=open).
 * One row per screen, empty and full side by side; a screen that could not be
 * reached is listed with the reason instead of silently missing.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ROOT = "screenshots/all-pages";
const rows = readFileSync(`${ROOT}/manifest.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));

// Latest capture wins, so a re-run replaces a failed row rather than duplicating it.
const byFile = new Map();
for (const r of rows) byFile.set(r.file, r);

const ROLES = {
  "1-signed-out": "Signed out (sign-up and sign-in)",
  "2-student": "Student app",
  "3-rider": "Rider app",
  "4-shop-owner": "Shop owner app",
  "5-admin": "Admin dashboard (Wave staff)",
};

const title = (s) => s.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** role -> "NN screen" -> { empty, full, default } */
const grouped = {};
for (const r of byFile.values()) {
  const key = `${String(r.n).padStart(2, "0")} ${r.screen}`;
  ((grouped[r.role] ??= {})[key] ??= {})[r.state] = r;
}

let md = `# Wave — every screen\n\nCaptured ${new Date().toISOString().slice(0, 10)} against the local dev API with the demo data from \`packages/db/scripts/seed-demo.ts\`.\n\n`;
md += `- **full**: the real API over the demo data.\n- **empty**: the same API with its lists emptied in flight, i.e. what a brand-new account or campus sees.\n- No suffix: a screen with only one state (a form, a detail page, a confirmation).\n- Buy for me is captured closed (the launch state) and, in rows marked *Buy for me open*, open.\n\n`;
md += `Video: [wave-how-it-works.mp4](wave-how-it-works.mp4)\n\n`;

let html = "";
let total = 0, missing = 0;
for (const [role, label] of Object.entries(ROLES)) {
  const screens = grouped[role];
  if (!screens) continue;
  md += `## ${label}\n\n| # | Screen | Empty | Full / only state |\n|---|---|---|---|\n`;
  html += `<h2>${label}</h2><div class="grid">`;
  for (const key of Object.keys(screens).sort()) {
    const s = screens[key];
    const [num, ...rest] = key.split(" ");
    const name = title(rest.join(" "));
    const cell = (r) => {
      if (!r) return "—";
      total += 1;
      if (!r.ok || !existsSync(`${ROOT}/${r.file}`)) {
        missing += 1;
        return `not reached: ${r.why}`;
      }
      return `[${r.file.split("/")[1]}](${r.file})`;
    };
    md += `| ${num} | ${name} | ${cell(s.empty)} | ${cell(s.full ?? s.default)} |\n`;
    const fig = (r, cap) =>
      r && r.ok ? `<figure><a href="${r.file}"><img loading="lazy" src="${r.file}" alt="${name}, ${cap}"></a><figcaption>${cap}</figcaption></figure>` : "";
    html += `<section class="card"><h3><span>${num}</span> ${name}</h3><div class="pair">${fig(s.empty, "Empty")}${fig(s.full, "Full")}${fig(s.default, "")}</div></section>`;
  }
  md += "\n";
  html += "</div>";
}
md += `\n${total - missing} of ${total} captures present.\n`;
writeFileSync(`${ROOT}/index.md`, md);

writeFileSync(
  `${ROOT}/index.html`,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wave screens</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#083400;--lime:#87ea5c;--canvas:#f7f7f7;--card:#fff;--muted:#6a6a6a}
body{margin:0;background:var(--canvas);color:var(--ink);font-family:'DM Sans',system-ui,sans-serif;padding:32px 16px 80px}
main{max-width:1400px;margin:0 auto}
h1{font-size:34px;margin:0 0 6px}.lede{color:var(--muted);margin:0 0 28px}
h2{margin:44px 0 16px;font-size:22px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.card{background:var(--card);border-radius:12px;padding:14px}
h3{margin:0 0 10px;font-size:15px;font-weight:500}h3 span{background:var(--lime);border-radius:9999px;padding:1px 9px;margin-right:6px;font-size:12px}
.pair{display:flex;gap:10px}figure{margin:0;flex:1;min-width:0}
img{width:100%;border-radius:8px;background:var(--canvas);display:block}
figcaption{font-size:12px;color:var(--muted);margin-top:4px}
video{width:100%;max-width:960px;border-radius:12px;background:#000}
</style></head><body><main>
<h1>Wave — every screen</h1>
<p class="lede">${total - missing} captures, empty and full states, filed by who uses them. Click any image for full size.</p>
<video controls src="wave-how-it-works.mp4"></video>
${html}
</main></body></html>`,
);
console.log(`index written: ${total - missing}/${total} captures present`);
