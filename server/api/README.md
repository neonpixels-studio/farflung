# Server API

Nitro route handlers live here. Every file maps to a route via filename:

| Filename pattern | HTTP method |
| ---------------- | ----------- |
| `*.get.ts`       | GET         |
| `*.post.ts`      | POST        |
| `*.patch.ts`     | PATCH       |
| `*.delete.ts`    | DELETE      |

## Conventions every handler must follow

### 1. Authenticate first

Call `requireUser(event)` from `server/utils/auth.ts` at the top of every
handler. It returns the authenticated `userId` and throws a 401 if the request
has no valid Clerk bearer token.

```ts
import { requireUser } from "../utils/auth";

export default defineEventHandler((event) => {
  const userId = requireUser(event);
  // ... rest of handler
});
```

The server middleware at `server/middleware/auth.ts` already validates the
token and sets `event.context.userId` for all `/api/*` routes; `requireUser`
re-reads that value and throws if it is missing.

The same header also accepts a personal API key (`ff_...`, created in Settings).
Keys are refused with a 403 on the prefixes in `API_KEY_DENIED_PATH_PREFIXES` in
that middleware, so add any new sensitive route prefix there.

### 2. Resolve the DB via getDb()

```ts
import { getDb } from "../db/index";

const db = getDb();
```

Do not instantiate the database connection directly; the factory caches it
across requests.

### 3. Scope every query to userId

Every query that reads or writes user-owned data must include a `userId`
filter. Never fetch rows without a user scope — cross-user data leaks are a
security issue, not just a bug.

Use `loadOwnedOrThrow` from `server/utils/db-helpers.ts` for single-row
lookups; it handles the 404 path and the ownership check in one call.

### 4. Validate inputs

Use the helpers from `server/utils/db-helpers.ts` (`requireString`,
`optionalString`) for primitive field validation. Throw errors with
`createError({ statusCode, statusMessage })` — Nitro serialises these into
structured JSON error responses automatically.

No external validation library is used. The project does not yet have enough
handler complexity to justify adding `zod`. If the number of handlers grows
and the inline validation becomes repetitive, introduce `zod` then and call
it out in the PR.

### 5. Return plain JSON

Return plain objects from handlers. Nitro serialises them. Do not call
`JSON.stringify` manually.

### 6. Surface errors, never swallow them

Do not catch errors to silently return empty data. Let Nitro propagate
unexpected errors as 500s. Catch only what you can handle meaningfully and
re-throw as a `createError` with an appropriate status code.

---

## Client transport

`app/composables/useApiClient.ts` exports `useApiClient()`, a composable that
wraps `$fetch` and injects the Clerk session token as `Authorization: Bearer`
on every call.

```ts
const { apiFetch } = useApiClient();
const data = await apiFetch("/api/health");
```

`getToken` is pulled from `useClerkAuth()` and called fresh per request so
the token auto-refreshes when the Clerk session rotates.

Use `apiFetch` instead of raw `$fetch` whenever calling `/api/*` routes from
components, pages, or stores.

---

## Smoke endpoint

`GET /api/health` — requires auth, returns `{ userId }`. Use it to confirm
the token pipeline is working end to end.
