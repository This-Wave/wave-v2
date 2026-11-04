import { useEffect, useState } from "react";
import { nextRunCutoff, upcomingRunDays } from "./pricing";

/**
 * A "Wave" is one scheduled delivery run — every day since 2026-11-04, orders
 * locking at noon on the day. The product name for it is the Wave; `run` is
 * only ever an internal word now.
 */

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface WaveInfo {
  /** The delivery date itself. */
  date: Date;
  /** Moment ordering closes — noon on the delivery day. */
  cutoff: Date;
  /** "Sunday's Wave" */
  name: string;
  /** "Sunday 9 Aug" */
  dateLabel: string;
  msLeft: number;
  /** "2d 4h" · "6h 12m" · "48m" — coarse at distance, precise when it matters. */
  countdown: string;
  /** Under six hours: the point where "later" stops being a safe assumption. */
  closingSoon: boolean;
  closed: boolean;
  /** 0–1 through the booking window, for the urgency rail. */
  elapsed: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Today" / "Tomorrow" / weekday — daily Waves make the relative word clearer. */
function relativeDayName(date: Date, now: Date): string {
  const a = new Date(date); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const diff = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return DAY_NAMES[date.getDay()];
}

export function describeWave(now: Date = new Date()): WaveInfo | null {
  const date = upcomingRunDays(now, 1)[0];
  if (!date) return null;
  const cutoff = nextRunCutoff(now);
  const msLeft = cutoff.getTime() - now.getTime();

  // The window opens when the previous Wave closes — a day earlier now that
  // Wave runs daily — which is what makes the rail mean something.
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const elapsed = Math.max(0, Math.min(1, 1 - msLeft / WINDOW_MS));

  return {
    date,
    cutoff,
    name: `${relativeDayName(date, now)}'s Wave`,
    dateLabel: `${DAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`,
    msLeft,
    countdown: formatCountdown(msLeft),
    closingSoon: msLeft > 0 && msLeft < 6 * 60 * 60 * 1000,
    closed: msLeft <= 0,
    elapsed,
  };
}

/** One unit of the countdown, as the counter draws it: `3` over `days`. */
export interface CountdownPart {
  value: number;
  /** Already singularised — "1 day", not "1 days". */
  unit: string;
}

/**
 * The countdown split into the two coarsest units that still have a value.
 *
 * Two, not three: "3 days 22 hours 14 minutes" invites a precision the schedule
 * does not have — the Wave leaves at noon whatever the minutes say — and three
 * blocks do not fit beside a label on a 390pt screen. The pair shifts down as
 * the deadline approaches (d/h, then h/m, then m alone), so the unit on display
 * is always the one a student would act on.
 *
 * Empty when the window has closed, which is the caller's cue to say so in
 * words instead of showing zeros.
 */
export function countdownParts(ms: number): CountdownPart[] {
  if (ms <= 0) return [];

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const unit = (value: number, name: string) => ({
    value,
    unit: value === 1 ? name : `${name}s`,
  });

  if (days > 0) return [unit(days, "day"), unit(hours, "hour")];
  if (hours > 0) return [unit(hours, "hour"), unit(minutes, "minute")];
  return [unit(minutes, "minute")];
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "closed";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Recomputes the Wave on a timer so the countdown is live.
 *
 * One 1s interval, but state is only replaced when the rendered countdown
 * string actually changes. Two days out that is once a minute; inside the last
 * hour it is once a minute still, because `formatCountdown` stops at minutes.
 * So the component re-renders exactly when a user could perceive a difference,
 * and the effect keeps an honest empty dependency list.
 */
export function useWave(): WaveInfo | null {
  const [wave, setWave] = useState<WaveInfo | null>(() => describeWave());

  useEffect(() => {
    const id = setInterval(() => {
      setWave((prev) => {
        const next = describeWave();
        if (!prev || !next) return next;
        const same =
          prev.countdown === next.countdown &&
          prev.closed === next.closed &&
          prev.closingSoon === next.closingSoon;
        return same ? prev : next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return wave;
}
