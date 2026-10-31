import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";
import { userPreferences } from "../../server/db/schema";

const MIGRATIONS_DIR = resolve(__dirname, "../../server/db/migrations");
const MIGRATION_TAG = "0013_add_handle_lower_unique";
const INDEX_NAME = "user_preferences_handle_lower_unique";

const migrationSql = readFileSync(
  resolve(MIGRATIONS_DIR, `${MIGRATION_TAG}.sql`),
  "utf8",
);

describe("handle case-insensitive uniqueness", () => {
  it("declares a unique index on lower(handle) in the schema", () => {
    const { indexes } = getTableConfig(userPreferences);
    const index = indexes.find(
      (candidate) => candidate.config.name === INDEX_NAME,
    );
    expect(index?.config.unique).toBe(true);
  });

  it("no longer declares the case-sensitive unique constraint", () => {
    const { uniqueConstraints } = getTableConfig(userPreferences);
    expect(uniqueConstraints).toHaveLength(0);
  });

  it("is registered in the migration journal", () => {
    const journal = JSON.parse(
      readFileSync(resolve(MIGRATIONS_DIR, "meta/_journal.json"), "utf8"),
    ) as { entries: { tag: string }[] };
    expect(journal.entries.map((entry) => entry.tag)).toContain(MIGRATION_TAG);
  });

  it("has a snapshot alongside the migration", () => {
    expect(() =>
      readFileSync(resolve(MIGRATIONS_DIR, "meta/0013_snapshot.json"), "utf8"),
    ).not.toThrow();
  });

  it("creates the lower(handle) unique index", () => {
    expect(migrationSql).toContain(
      `CREATE UNIQUE INDEX "${INDEX_NAME}" ON "user_preferences" USING btree (lower("handle"))`,
    );
  });

  describe("fails safe when existing rows clash", () => {
    const guardPosition = migrationSql.indexOf("RAISE EXCEPTION");
    const createPosition = migrationSql.indexOf("CREATE UNIQUE INDEX");
    const dropPosition = migrationSql.indexOf("DROP CONSTRAINT");

    it("checks for clashes first and aborts with a message that names them", () => {
      expect(guardPosition).toBeGreaterThan(-1);
      expect(guardPosition).toBeLessThan(createPosition);
      expect(migrationSql).toContain("HAVING count(*) > 1");
      expect(migrationSql).toContain("Resolve these clashing handles first");
    });

    it("only drops the old constraint after the new index exists, so a failure never leaves handles unprotected", () => {
      expect(dropPosition).toBeGreaterThan(createPosition);
    });

    it("never deletes or rewrites user data", () => {
      expect(migrationSql).not.toMatch(/\b(DELETE|UPDATE|TRUNCATE)\b/i);
    });
  });
});
