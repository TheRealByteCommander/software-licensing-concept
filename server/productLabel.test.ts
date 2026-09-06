import { describe, expect, it } from "vitest";
import { formatProductLabel } from "@shared/productLabel";
import { mysqlInsertId } from "./mysqlInsert";

describe("formatProductLabel", () => {
  it("shows numeric id and name for pickers and tables", () => {
    expect(formatProductLabel(12, "Desktop App")).toBe("12 · Desktop App");
  });

  it("falls back when the name is missing", () => {
    expect(formatProductLabel(3)).toBe("Product #3");
    expect(formatProductLabel(3, "   ")).toBe("Product #3");
  });
});

describe("mysqlInsertId", () => {
  it("reads insertId from a mysql2 ResultSetHeader", () => {
    expect(mysqlInsertId({ insertId: 42, affectedRows: 1 })).toBe(42);
  });

  it("reads insertId from a [header, fields] tuple", () => {
    expect(mysqlInsertId([{ insertId: 7 }, []])).toBe(7);
  });

  it("rejects missing or zero ids", () => {
    expect(() => mysqlInsertId({})).toThrow(/inserted row ID/i);
    expect(() => mysqlInsertId({ insertId: 0 })).toThrow(/inserted row ID/i);
  });
});
