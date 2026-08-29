import { readFileSync } from "node:fs";
const env = {};
for (const l of readFileSync("packages/api/.env","utf8").split("\n")) { const m=/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(l); if(m) env[m[1]]=m[2].trim().replace(/^["'](.*)["']$/,"$1"); }
const API = "http://127.0.0.1:4010/v1";
const ACC = { admin:["+233271234567","WaveAdmin123!"], student:["+233241234567","WaveDev123!"], rider:["+233551234567","WaveRider123!"], shop:["+233201234567","WaveShop123!"] };
const tok = {};
for (const [role,[phone,password]] of Object.entries(ACC)) {
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:"POST",headers:{apikey:env.SUPABASE_ANON_KEY,"Content-Type":"application/json"},body:JSON.stringify({phone,password})});
  tok[role] = (await r.json()).access_token;
}
const call = (role, path, opts={}) => fetch(API+path, { ...opts, headers: { Authorization: `Bearer ${tok[role]}`, "Content-Type":"application/json", ...(opts.headers||{}) } });
const show = async (name, p) => { const r = await p; let b=""; try { b = JSON.stringify(await r.json()).slice(0,180);} catch{} console.log(`${r.status}`.padEnd(4), name, "->", b); return r; };

console.log("\n--- role gates (each should be 403) ---");
await show("student -> GET /admin/stats      ", call("student","/admin/stats"));
await show("rider   -> GET /admin/stats      ", call("rider","/admin/stats"));
await show("shop    -> GET /admin/stats      ", call("shop","/admin/stats"));
await show("student -> GET /orders/available ", call("student","/orders/available"));
await show("student -> GET /shops/my         ", call("student","/shops/my"));
await show("rider   -> POST /orders          ", call("rider","/orders",{method:"POST",body:"{}"}));

console.log("\n--- unauthenticated (should be 401) ---");
for (const p of ["/admin/stats","/orders/my","/shops/my","/orders/available"]) {
  const r = await fetch(API+p); console.log(`${r.status}`.padEnd(4), "anon ->", p);
}

console.log("\n--- price integrity ---");
const shops = (await (await fetch(API+"/shops")).json()).shops;
const shop = shops.find(s=>s.name==="Mama Put Kitchen");
const prods = (await (await fetch(`${API}/shops/${shop.id}/products`)).json());
const list = prods.products ?? prods;
const p0 = list[0];
console.log("real product price:", p0.name, p0.price);
const cps = (await (await call("student","/checkpoints")).json().catch(()=>({})));
const uni = (await (await call("student","/universities")).json().catch(()=>({})));
// find a checkpoint id from an existing order
const mine = (await (await call("student","/orders/my")).json()).orders;
const cpId = mine.find(o=>o.checkpointId)?.checkpointId;
const nextSunday = (() => { const d=new Date(); d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7)); return d.toISOString().slice(0,10); })();
const body = {
  orderType:"buy_for_me", shopId: shop.id, checkpointId: cpId,
  items:[{ productId: p0.id, quantity: 1, price: 0.01, unitPrice: 0.01, totalAmount: 0.01 }],
  deliveryDay:"sunday", scheduledDate: nextSunday, isSpecialOrder:false,
  totalAmount: 0.01, deliveryFee: 0, itemPrice: 0.01,
};
const r = await call("student","/orders",{method:"POST", body: JSON.stringify(body)});
const created = await r.json();
console.log("POST /orders with forged prices ->", r.status);
if (created.order) {
  const o = created.order;
  console.log(`  server stored: itemPrice=${o.itemPrice} deliveryFee=${o.deliveryFee} total=${o.totalAmount}`);
  console.log(`  forged values were itemPrice=0.01 deliveryFee=0 total=0.01`);
  console.log(`  VERDICT: ${Number(o.itemPrice) === Number(p0.price) ? "server recalculated — forgery ignored" : "!! client price accepted"}`);
  console.log("  created order id:", o.id, "status:", o.status);
} else console.log("  ", JSON.stringify(created).slice(0,300));

console.log("\n--- cross-tenant read ---");
const otherId = mine[0]?.id;
await show(`rider reads a student order not assigned to them`, call("rider", `/orders/${otherId}`));
await show(`shop  reads a student order`, call("shop", `/orders/${otherId}`));
