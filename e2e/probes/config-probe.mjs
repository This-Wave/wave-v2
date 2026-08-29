import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const env = {};
for (const l of readFileSync("packages/api/.env","utf8").split("\n")) { const m=/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(l); if(m) env[m[1]]=m[2].trim().replace(/^["'](.*)["']$/,"$1"); }
const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {method:"POST",headers:{apikey:env.SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({phone:"+233271234567",password:"WaveAdmin123!"})});
const j = await r.json();
const session = { ...j, expires_at: Math.floor(Date.now()/1000)+(j.expires_in??3600) };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v), [`sb-${new URL(env.SUPABASE_URL).hostname.split(".")[0]}-auth-token`, JSON.stringify(session)]);
const page = await ctx.newPage();
let fetches = 0;
page.on("request", (rq) => { if (rq.url().includes("/admin/config")) { fetches++; console.log(`  fetch #${fetches} of /admin/config at t+${Date.now()-t0}ms`); } });
const t0 = Date.now();
await page.goto("http://127.0.0.1:3100/config", { waitUntil: "load" });
await page.locator("#delivery_fee_base").waitFor();
await page.waitForFunction(() => (document.querySelector("#delivery_fee_base")).value !== "");
console.log("field seeded at t+" + (Date.now()-t0) + "ms, value =", await page.locator("#delivery_fee_base").inputValue());
// Type like a human would, immediately after the form appears.
await page.locator("#delivery_fee_base").fill("999999");
console.log("typed 999999");
for (const ms of [200, 600, 1200, 2500, 5000]) {
  await page.waitForTimeout(ms === 200 ? 200 : ms - 0);
  console.log(`  t+${Date.now()-t0}ms  field now = "${await page.locator("#delivery_fee_base").inputValue()}"  saveDisabled=${await page.getByRole("button",{name:/save/i}).first().isDisabled()}`);
}
console.log("total /admin/config fetches:", fetches);
await b.close();
