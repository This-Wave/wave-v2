import type { ReactNode } from "react";

/**
 * `outline-none` used to strip the browser's focus ring and replace it with a
 * 1px border-colour change — invisible in practice and short of 1.4.11's 3:1.
 * The ring is drawn explicitly instead, and only on keyboard focus so mouse
 * users don't see it.
 *
 * min-h rather than a fixed h-[42px]: at a browser zoom or a large default font
 * the text grew and the box didn't. 1.4.4.
 */
export const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface";

const CONTROL =
  "min-h-[42px] w-full rounded-control border border-border bg-surface px-3.5 py-2 text-[13.5px] text-ink " +
  // #a8a8a8 on white is 2.5:1; placeholders are text and owe 4.5:1.
  `placeholder:text-muted focus:border-ink disabled:opacity-50 ${FOCUS_RING}`;

function Label({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-muted">
        {label}
        {required ? null : <span className="ml-1 font-normal text-faint">optional</span>}
      </span>
      {children}
    </label>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  inputMode?: "text" | "decimal" | "tel";
  /** Offered as a datalist. The field stays free text — these only nudge. */
  suggestions?: string[];
  hint?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  multiline,
  inputMode = "text",
  suggestions,
  hint,
}: TextFieldProps) {
  const listId = suggestions?.length ? `${label.replace(/\s+/g, "-").toLowerCase()}-suggestions` : undefined;
  return (
    <Label label={label} required={required}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className={`${CONTROL} h-auto resize-none py-2.5 leading-5`}
        />
      ) : (
        <>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            inputMode={inputMode}
            list={listId}
            className={CONTROL}
          />
          {listId ? (
            <datalist id={listId}>
              {suggestions?.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          ) : null}
          {hint ? <span className="mt-1.5 block text-[12px] leading-4 text-muted">{hint}</span> : null}
        </>
      )}
    </Label>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "Select…",
  required,
  disabled,
  hint,
}: SelectFieldProps) {
  return (
    <div>
      <Label label={label} required={required}>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || options.length === 0}
          className={CONTROL}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Label>
      {hint ? <p className="mt-1.5 text-[12px] leading-4 text-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Form-level error. `role="alert"` because it appears without moving focus —
 * a keyboard user submits, the request fails, and nothing would otherwise tell
 * them. 4.1.3.
 */
export function FormError({ message, id }: { message: string | null; id?: string }) {
  if (!message) return null;
  return (
    <div
      id={id}
      role="alert"
      className="rounded-control border border-danger-border bg-danger-bg px-3.5 py-2.5 text-[12.5px] text-danger-text"
    >
      {message}
    </div>
  );
}
