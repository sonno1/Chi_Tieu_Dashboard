export function normalizeText(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}
