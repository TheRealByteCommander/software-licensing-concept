/** Display label for product pickers and tables: "12 · Desktop App". */
export function formatProductLabel(id: number, name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed ? `${id} · ${trimmed}` : `Product #${id}`;
}
