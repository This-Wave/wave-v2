"use client";

import { useEffect, useState } from "react";
import { applyMode, readMode, saveMode, type ThemeMode } from "../lib/theme";
import { FOCUS_RING } from "./ui/Field";

/** Light / Dark / System, in the sidebar footer. PLAN-THEMES.md. */
export function ThemeControl() {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    setMode(readMode());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (readMode() === "system") applyMode("system");
    };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  // Rendered after mount only: the stored choice is not known on the server.
  if (!mode) return null;

  return (
    <div className="mt-2.5">
      <Segmented
        label="Theme"
        options={[
          ["light", "Light"],
          ["dark", "Dark"],
          ["system", "System"],
        ]}
        value={mode}
        onChange={(next) => {
          setMode(next as ThemeMode);
          saveMode(next as ThemeMode);
        }}
      />
    </div>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    // The group is named for screen readers; visually the options say enough,
    // and a heading per row cost the nav above it its last item at 900px.
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-control bg-canvas p-0.5">
        {options.map(([key, text]) => {
          const selected = key === value;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(key)}
              className={`min-h-[24px] flex-1 rounded-[6px] px-1.5 text-[11px] font-medium ${FOCUS_RING} ${
                selected ? "bg-ink text-on-ink" : "text-muted hover:text-ink"
              }`}
            >
              {text}
            </button>
          );
        })}
    </div>
  );
}
