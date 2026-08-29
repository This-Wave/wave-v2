import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const env = {};
for (const l of readFileSync("packages/api/.env","utf8").split("\n")) { const m=/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(l); if(m) env[m[1]]=m[2].trim().replace(/^["'](.*)["']$/,"$1"); }
const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:env.SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({phone:"+233271234567",password:"WaveAdmin123!"})});
const j = await r.json();
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1280,height:900} });
await ctx.addInitScript(([k,v])=>localStorage.setItem(k,v), [`sb-${new URL(env.SUPABASE_URL).hostname.split(".")[0]}-auth-token`, JSON.stringify({...j, expires_at: Math.floor(Date.now()/1000)+3600})]);
for (const route of ["/dashboard","/orders","/riders","/shops","/users","/checkpoints","/config","/suggestions"]) {
  const page = await ctx.newPage();
  const counts = {};
  page.on("request", (rq) => { const u = rq.url(); if (u.includes(":4010/v1/")) { const k = u.split(":4010/v1")[1].split("?")[0]; counts[k]=(counts[k]??0)+1; } });
  await page.goto("http://127.0.0.1:3100"+route, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const dupes = Object.entries(counts).filter(([,n]) => n > 1);
  console.log(route.padEnd(14), dupes.length ? "DUPLICATED: " + dupes.map(([k,n])=>`${k} x${n}`).join(", ") : "single fetch each  " + JSON.stringify(counts));
  await page.close();
}
await b.close();
