/**
 * Stitch the run's per-test recordings into one walkthrough a person can watch.
 *
 * Run from the repo root, after `npx playwright test --config=e2e/playwright.config.ts`:
 *   node e2e/tools/stitch-video.mjs
 *
 * Titles come from the JSON reporter rather than the artifact directory names,
 * which Playwright truncates and hashes once they get long.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { chromium } from "@playwright/test";

const RESULTS = "e2e/results";
const OUT = `${RESULTS}/wave-full-walkthrough.mp4`;
const TMP = process.env.SP ? `${process.env.SP}/clips` : join(tmpdir(), "wave-walkthrough");
mkdirSync(TMP, { recursive: true });

/** Flatten the reporter's nested suites into (project, title, video) rows. */
function collect(suite, out) {
  for (const child of suite.suites ?? []) collect(child, out);
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      for (const result of test.results) {
        const video = result.attachments?.find((a) => a.name === "video");
        if (video) out.push({ project: test.projectName, title: spec.title, file: video.path, status: result.status });
      }
    }
  }
  return out;
}

const report = JSON.parse(readFileSync(`${RESULTS}/results.json`, "utf8"));
const all = collect({ suites: report.suites }, []);

/** The role a clip belongs to, read from its artifact folder. */
const roleOf = (file) => {
  const dir = dirname(file).split("/").pop() ?? "";
  return dir.startsWith("admin") ? "admin" : dir.startsWith("student") ? "student"
    : dir.startsWith("rider") ? "rider" : "shop";
};
const LABEL = { admin: "Admin dashboard", student: "Student app", rider: "Rider app", shop: "Shop owner app" };
const RANK = { admin: 0, student: 1, rider: 2, shop: 3 };

const clipsIn = all
  .filter((c) => existsSync(c.file))
  .sort((a, b) => RANK[roleOf(a.file)] - RANK[roleOf(b.file)]);

const W = 1280, H = 800;

// Title cards are rendered in Chromium, in the v6 palette. This ffmpeg build
// has no drawtext filter (no libfreetype), and a browser typesets better anyway.
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

for (const [i, clip] of clipsIn.entries()) {
  await page.setContent(`<!doctype html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
      html,body{margin:0;height:100%;background:#083400;font-family:'DM Sans',-apple-system,system-ui,sans-serif}
      .wrap{height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box}
      .step{font-size:18px;letter-spacing:.16em;text-transform:uppercase;color:#87ea5c;font-weight:500}
      .role{margin:28px 0 16px;font-size:25px;color:#fff;opacity:.6}
      h1{margin:0;font-size:50px;line-height:1.16;color:#fff;font-weight:700;letter-spacing:-.02em}
      .rule{width:76px;height:5px;background:#87ea5c;border-radius:9999px;margin-top:40px}
    </style></head><body><div class="wrap">
      <div class="step">Wave walkthrough &middot; ${String(i + 1).padStart(2, "0")} of ${clipsIn.length}</div>
      <div class="role">${LABEL[roleOf(clip.file)]}</div>
      <h1>${escapeHtml(clip.title.charAt(0).toUpperCase() + clip.title.slice(1))}</h1>
      <div class="rule"></div>
    </div></body></html>`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${TMP}/card-${i}.png` });
}
await browser.close();

const parts = [];
for (const [i, clip] of clipsIn.entries()) {
  console.log(`[${i + 1}/${clipsIn.length}] ${LABEL[roleOf(clip.file)]} — ${clip.title}`);

  const card = `${TMP}/card-${i}.mp4`;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-loop", "1", "-t", "2.4", "-i", `${TMP}/card-${i}.png`,
    "-vf", "fps=25,setsar=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", card]);

  // One canvas for everything: the admin clips are 1280x800, the phone screens
  // 390x844, and concat needs a single geometry.
  const body = `${TMP}/clip-${i}.mp4`;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", clip.file,
    "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x101010,fps=25,setsar=1`,
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", body]);

  parts.push(card, body);
}

writeFileSync(`${TMP}/list.txt`, parts.map((p) => `file '${p}'`).join("\n"));
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${TMP}/list.txt`,
  "-c:v", "libx264", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT]);
console.log(`\nwrote ${OUT}`);
