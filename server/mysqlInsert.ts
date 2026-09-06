/** Extract auto-increment id from a drizzle/mysql2 insert result. */
export function mysqlInsertId(result: unknown): number {
  if (result && typeof result === "object") {
    if ("insertId" in result) {
      const id = Number((result as { insertId: unknown }).insertId);
      if (Number.isFinite(id) && id > 0) return id;
    }
    if (Array.isArray(result) && result[0] && typeof result[0] === "object" && "insertId" in result[0]) {
      const id = Number((result[0] as { insertId: unknown }).insertId);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }
  throw new Error("Failed to determine inserted row ID");
}
