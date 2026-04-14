export function normalizeText(input: unknown): string {
  if (input === null || input === undefined) return "";
  const text = String(input).trim().toLowerCase();
  // Remove Vietnamese diacritics for more forgiving matches
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
