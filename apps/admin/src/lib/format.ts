/** "+233245550101" → "024 555 0101", the way Ghanaians write a number. */
export function localPhone(phone?: string | null): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  const local = d.startsWith("233") ? `0${d.slice(3)}` : d;
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : phone;
}

/** "20 Nov", the canvas date for tables. */
export function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
