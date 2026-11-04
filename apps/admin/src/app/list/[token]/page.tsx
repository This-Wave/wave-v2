"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { API_URL } from "../../../lib/api";

/**
 * The delivery company's collection list (canvas board 57). Public, no login:
 * the link itself is the key. It shows what to collect and where to bring it,
 * and nothing about the students. Phone-first, because that is where a
 * dispatcher or rider will open it; prints cleanly for a company on paper.
 */

interface Row {
  ref: string;
  cancelled: boolean;
  delivered: boolean;
  from: string;
  fromDetail: string | null;
  campus: string;
  items: string;
  kind: string;
}
interface Sheet {
  company: { name: string };
  date: string;
  bringTo: string;
  counts: { toCollect: number; done: number; cancelled: number };
  orders: Row[];
}

function isoDay(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function CompanyListPage() {
  const { token } = useParams<{ token: string }>();
  const [offset, setOffset] = useState(0);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "dead" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const date = isoDay(offset);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`${API_URL}/company-list/${encodeURIComponent(token)}?date=${date}`, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setState("dead");
        if (!res.ok) return setState("error");
        setSheet((await res.json()) as Sheet);
        setState("ok");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [token, date, attempt]);

  // Grouped by where to collect, so one rider can take a whole stop.
  const groups = useMemo(() => {
    const map = new Map<string, { from: string; where: string | null; rows: Row[] }>();
    for (const r of sheet?.orders ?? []) {
      const g = map.get(r.from) ?? { from: r.from, where: r.fromDetail, rows: [] };
      g.rows.push(r);
      map.set(r.from, g);
    }
    return [...map.values()];
  }, [sheet]);

  return (
    <main className="min-h-screen bg-surface text-ink print:bg-white">
      <header className="bg-ink px-5 pb-5 pt-5 text-white print:bg-white print:text-ink">
        <div className="mx-auto max-w-[720px]">
          <p className="text-[14px] opacity-80">
            Wave collections{sheet ? ` for ${sheet.company.name}` : ""}
          </p>
          <h1 className="mt-2 text-[28px] font-bold tracking-tight">
            {offset === 0 ? "Today" : "Tomorrow"}, {dayLabel(date)}
          </h1>
          {state === "dead" ? null : (
          <nav aria-label="Day" className="mt-4 inline-flex gap-1 rounded-full bg-white/10 p-1 print:hidden">
            {[0, 1].map((o) => (
              <button
                key={o}
                type="button"
                aria-current={offset === o ? "page" : undefined}
                onClick={() => setOffset(o)}
                className={`min-h-[40px] rounded-full px-4 text-[14px] font-semibold ${
                  offset === o ? "bg-white text-ink" : "text-white"
                }`}
              >
                {o === 0 ? "Today" : "Tomorrow"}
              </button>
            ))}
          </nav>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[720px] px-5 py-5">
        {state === "loading" ? (
          <p role="status" className="py-10 text-[15px] text-muted">
            Loading…
          </p>
        ) : null}
        {state === "dead" ? (
          <div className="py-10">
            <h2 className="text-[22px] font-bold">This link doesn&apos;t work</h2>
            <p className="mt-2 text-[16px] text-muted">Ask Wave for a new one.</p>
          </div>
        ) : null}
        {state === "error" ? (
          <div className="py-10">
            <h2 className="text-[22px] font-bold">Couldn&apos;t load the list</h2>
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-4 min-h-[44px] rounded-full border-2 border-ink px-5 text-[15px] font-semibold"
            >
              Try again
            </button>
          </div>
        ) : null}

        {state === "ok" && sheet ? (
          <div className="space-y-5">
            <p className="text-[16px]">
              <strong className="text-[20px]">{sheet.counts.toCollect} to collect</strong>
              <span className="text-muted">
                {" "}
                · {sheet.counts.done} brought in · {sheet.counts.cancelled} cancelled
              </span>
            </p>
            <div className="rounded-card border-2 border-ink px-4 py-3">
              <p className="text-[13px] font-semibold text-muted">Bring everything to</p>
              <p className="text-[17px] font-bold">{sheet.bringTo}</p>
            </div>
            <div className="flex gap-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border-2 border-ink text-[15px] font-semibold"
              >
                <Printer size={18} aria-hidden /> Print
              </button>
              <a
                href={`${API_URL}/company-list/${encodeURIComponent(token)}?date=${date}&format=csv`}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border-2 border-ink text-[15px] font-semibold"
              >
                <Download size={18} aria-hidden /> Spreadsheet
              </a>
            </div>

            {groups.length === 0 ? (
              <p className="py-6 text-[16px] text-muted">Nothing to collect yet.</p>
            ) : (
              groups.map((g) => (
                <section key={g.from} className="break-inside-avoid">
                  <h2 className="text-[17px] font-bold">
                    {g.from} · {g.rows.length}
                  </h2>
                  {g.where ? <p className="text-[14px] text-muted">{g.where}</p> : null}
                  <ul className="mt-1">
                    {g.rows.map((r) => (
                      <li
                        key={r.ref}
                        className={`flex gap-3 border-b border-border py-3 ${r.cancelled ? "opacity-60" : ""}`}
                      >
                        <span className="w-[108px] shrink-0 whitespace-nowrap text-[14px] font-bold tracking-wide">{r.ref}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className={`text-[16px] font-semibold ${r.cancelled ? "line-through" : ""}`}>
                            {r.items}
                          </span>
                          {r.cancelled ? (
                            <span className="self-start rounded-full border-[1.5px] border-danger-text px-2.5 text-[13px] font-bold text-danger-text">
                              Cancelled, don&apos;t collect
                            </span>
                          ) : null}
                          {r.delivered ? (
                            <span className="self-start rounded-full bg-lime px-2.5 text-[13px] font-bold text-ink">
                              Brought in
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
            <p className="text-[14px] text-muted">Write the order number on each bag.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
