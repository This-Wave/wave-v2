"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * v5 admin dialog: neutral overlay, card radius, hairline border. No coloured
 * shadow — the elevation is the same `shadow-card` every other surface uses.
 */
export function Modal({ open, title, description, onClose, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Was a hardcoded id="modal-title": two mounted modals emitted duplicate ids
  // and aria-labelledby resolved to whichever the browser saw first.
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useEffect(() => {
    if (!open) return;

    // Focus has to come back where it started, or closing a dialog dumps a
    // keyboard user at the top of the document. 2.4.3.
    const opener = document.activeElement as HTMLElement | null;

    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function focusable(): HTMLElement[] {
      return Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // Trap. Without this, Tab walks straight out of the dialog and into the
      // page behind it, which aria-modal hides from assistive tech but not from
      // the Tab key.
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    // Without this the page behind keeps scrolling under the overlay.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first control so the dialog is usable from the keyboard alone.
    (panelRef.current?.querySelector<HTMLElement>("input, select, textarea") ??
      focusable()[0] ??
      panelRef.current)?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6 py-10"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="max-h-full w-full max-w-[520px] overflow-y-auto rounded-card border border-border bg-surface shadow-card"
      >
        <div className="border-b border-border px-6 py-5">
          <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-ink">{title}</h2>
          {description ? (
            <p id={descriptionId} className="mt-1 text-[12.5px] leading-5 text-muted">
              {description}
            </p>
          ) : null}
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer ? <div className="border-t border-border px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
