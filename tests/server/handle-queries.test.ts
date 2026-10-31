import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import {
  findUserIdByHandle,
  isHandleTaken,
} from "../../server/utils/handle-queries";

const dialect = new PgDialect();

// A chainable stand-in for the drizzle builder that records the WHERE
// condition so the generated SQL can be inspected.
function makeDatabase(rows: unknown[]) {
  let whereCondition: SQL | undefined;
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn((condition: SQL) => {
    whereCondition = condition;
    return { limit };
  });
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = where;
  const database = { select: vi.fn(() => chain) };
  return {
    database: database as never,
    renderedWhere: () => dialect.sqlToQuery(whereCondition as SQL),
  };
}

describe("findUserIdByHandle", () => {
  it("matches case-insensitively on lower(handle), the expression the unique index covers", async () => {
    const { database, renderedWhere } = makeDatabase([{ userId: "u1" }]);

    expect(await findUserIdByHandle(database, "Grimicorn")).toBe("u1");

    const { sql, params } = renderedWhere();
    expect(sql).toContain('lower("user_preferences"."handle") = lower($1)');
    expect(params).toContain("Grimicorn");
  });

  it("ignores soft-deleted accounts", async () => {
    const { database, renderedWhere } = makeDatabase([]);

    await findUserIdByHandle(database, "grimicorn");

    expect(renderedWhere().sql).toContain('"users"."deleted_at" is null');
  });

  it("returns null when nobody holds the handle", async () => {
    const { database } = makeDatabase([]);
    expect(await findUserIdByHandle(database, "nobody")).toBeNull();
  });
});

describe("isHandleTaken", () => {
  it("excludes the asking user and compares case-insensitively", async () => {
    const { database, renderedWhere } = makeDatabase([]);

    await isHandleTaken(database, "Grimicorn", "me-1");

    const { sql, params } = renderedWhere();
    expect(sql).toContain('lower("user_preferences"."handle") = lower($1)');
    expect(sql).toContain('"user_preferences"."user_id" <> $2');
    expect(params).toEqual(["Grimicorn", "me-1"]);
  });

  it("is true when another user holds it and false otherwise", async () => {
    expect(
      await isHandleTaken(makeDatabase([{ userId: "u2" }]).database, "x", "me"),
    ).toBe(true);
    expect(await isHandleTaken(makeDatabase([]).database, "x", "me")).toBe(
      false,
    );
  });
});
