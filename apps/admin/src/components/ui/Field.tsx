import type { ReactNode } from "react";

const CONTROL =
  "h-[42px] w-full rounded-control border border-border bg-surface px-3.5 text-[13.5px] text-ink " +
  "outline-none placeholder:text-faint focus:border-wave-500 disabled:opacity-50";

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

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-control border border-danger-border bg-danger-bg px-3.5 py-2.5 text-[12.5px] text-danger-text">
      {message}
    </div>
  );
}
