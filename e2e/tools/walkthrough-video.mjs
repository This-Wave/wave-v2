/**
 * Stitch the walkthrough chapters into one MP4 a person can watch.
 *
 * Run from the repo root, after `npx playwright test -c e2e/playwright.walkthrough.config.ts`:
 *   node e2e/tools/walkthrough-video.mjs
 *
 * Phone chapters are framed on a 1280x800 ink backdrop that names the role and
 * the chapter, with the recording on the right; the dashboard chapter plays
 * full frame. Backdrops and title cards are typeset in Chromium because this
 * ffmpeg build has no drawtext filter.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const RESULTS = "e2e/results";
const OUT = process.env.OUT ?? "screenshots/all-pages/wave-how-it-works.mp4";
const TMP = process.env.SP ? `${process.env.SP}/walkthrough` : join(tmpdir(), "wave-walkthrough");
mkdirSync(TMP, { recursive: true });
const W = 1280, H = 800;

// Title cards and frames in the brand palette (PLAN-THEMES.md): Sacramento
// ground, lime accent, deep-green label on the accent.
const GROUND = "#154b3e";
const ACCENT = "#87ea5c";
const ON_ACCENT = "#0b2a21";
const REPORT = process.env.REPORT ?? `${RESULTS}/walkthrough.json`;

function collect(suite, out) {
  for (const child of suite.suites ?? []) collect(child, out);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests) {
      for (const r of t.results) {
        const video = r.attachments?.find((a) => a.name === "video");
        if (video && existsSync(video.path)) out.push({ project: t.projectName, title: spec.title, file: video.path, status: r.status });
      }
    }
  }
  return out;
}

const report = JSON.parse(readFileSync(REPORT, "utf8"));
const chapters = collect({ suites: report.suites }, [])
  .map((c) => {
    const m = /^@(\w+)\s+(\d+)\s+(.*)$/.exec(c.title);
    return { ...c, n: Number(m?.[2] ?? 0), text: m?.[3] ?? c.title };
  })
  .sort((a, b) => a.n - b.n);

const roleOf = (text) =>
  /dashboard|team/i.test(text) ? "Operator dashboard" : /shop owner/i.test(text) ? "Shop owner app"
    : /Kofi|rider/i.test(text) ? "Rider app" : "Student app";

const FONT = `<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">`;
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const base = `html,body{margin:0;height:100%;background:${GROUND};font-family:'DM Sans',system-ui,sans-serif;color:#fff}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });

async function png(html, file) {
  await page.setContent(`<!doctype html><html><head>${FONT}<style>${base}</style></head><body>${html}</body></html>`, { waitUntil: "networkidle" });
  await page.screenshot({ path: file });
}

const mark = `<svg width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${ACCENT}"/><path d="M14 27c6-6 12-6 18 0s12 6 18 0M14 39c6-6 12-6 18 0s12 6 18 0" stroke="${ON_ACCENT}" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;

await png(
  `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 110px">
     ${mark}
     <h1 style="margin:40px 0 14px;font-size:64px;letter-spacing:-.02em">How Wave works</h1>
     <div style="font-size:26px;opacity:.7;max-width:900px;line-height:1.4">One package, followed from a student's phone to a rider's hands and back, then the shop and the team behind it.</div>
     <div style="margin-top:44px;width:76px;height:5px;background:${ACCENT};border-radius:9999px"></div>
   </div>`,
  `${TMP}/intro.png`,
);

for (const [i, c] of chapters.entries()) {
  const kicker = `Chapter ${i + 1} of ${chapters.length} &middot; ${roleOf(c.text)}`;
  await png(
    `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 110px">
       <div style="font-size:18px;letter-spacing:.16em;text-transform:uppercase;color:${ACCENT};font-weight:500">${kicker}</div>
       <h1 style="margin:24px 0 0;font-size:54px;line-height:1.15;letter-spacing:-.02em;max-width:1000px">${esc(c.text)}</h1>
       <div style="margin-top:40px;width:76px;height:5px;background:${ACCENT};border-radius:9999px"></div>
     </div>`,
    `${TMP}/card-${i}.png`,
  );
  // The frame beside a phone recording: role and chapter stay on screen while it plays.
  await png(
    `<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 0 0 90px;width:640px;box-sizing:border-box">
       <div style="font-size:16px;letter-spacing:.16em;text-transform:uppercase;color:${ACCENT};font-weight:500">${roleOf(c.text)}</div>
       <div style="margin-top:18px;font-size:36px;line-height:1.2;font-weight:700;letter-spacing:-.01em">${esc(c.text)}</div>
       <div style="margin-top:36px;display:flex;align-items:center;gap:14px;font-size:18px;color:rgba(255,255,255,.65)">${mark.replace('width="64" height="64" viewBox', 'width="28" height="28" viewBox')} Wave &middot; Ashesi pilot</div>
     </div>`,
    `${TMP}/frame-${i}.png`,
  );
}
await browser.close();

const enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "25"];
const still = (img, out, secs) =>
  execFileSync("ffmpeg", ["-y", "-v", "error", "-loop", "1", "-t", String(secs), "-i", img, "-vf", "fps=25,setsar=1", ...enc, out]);

const parts = [];
still(`${TMP}/intro.png`, `${TMP}/intro.mp4`, 4);
parts.push(`${TMP}/intro.mp4`);

for (const [i, c] of chapters.entries()) {
  console.log(`[${i + 1}/${chapters.length}] ${c.text} (${c.status})`);
  still(`${TMP}/card-${i}.png`, `${TMP}/card-${i}.mp4`, 2.6);
  const body = `${TMP}/body-${i}.mp4`;
  if (c.project === "phone") {
    // The phone recording at 760px tall on the right, over the chapter frame.
    execFileSync("ffmpeg", ["-y", "-v", "error", "-loop", "1", "-i", `${TMP}/frame-${i}.png`, "-i", c.file,
      "-filter_complex", "[1:v]scale=-2:760,setsar=1[p];[0:v][p]overlay=x=W-w-150:y=20:shortest=1,fps=25,setsar=1",
      ...enc, "-an", body]);
  } else {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", c.file,
      "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x${GROUND.slice(1)},fps=25,setsar=1`,
      ...enc, "-an", body]);
  }
  parts.push(`${TMP}/card-${i}.mp4`, body);
}

writeFileSync(`${TMP}/list.txt`, parts.map((p) => `file '${p}'`).join("\n"));
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${TMP}/list.txt`,
  "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT]);
console.log(`\nwrote ${OUT}`);
