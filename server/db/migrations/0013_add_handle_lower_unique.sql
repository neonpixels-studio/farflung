DO $$
DECLARE
  clashing_handles text;
BEGIN
  SELECT string_agg(lower_handle || ' (' || holders || ' users)', ', ')
    INTO clashing_handles
    FROM (
      SELECT lower("handle") AS lower_handle, count(*) AS holders
        FROM "user_preferences"
       WHERE "handle" IS NOT NULL
       GROUP BY lower("handle")
      HAVING count(*) > 1
    ) AS clashes;

  IF clashing_handles IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot make user_preferences.handle case-insensitively unique. Resolve these clashing handles first: %', clashing_handles;
  END IF;
END
$$;--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_handle_lower_unique" ON "user_preferences" USING btree (lower("handle"));--> statement-breakpoint
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_handle_unique";
