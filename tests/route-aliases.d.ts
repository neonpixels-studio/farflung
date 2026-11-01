// Type declarations for the vitest-only aliases defined in vitest.config.ts.
// Nitro's bracketed route files ([id]) break Vite's glob-based static import
// analysis, so tests import them through these aliases. TypeScript resolves the
// aliases here by re-exporting the real handler modules.

declare module "@trips-id.get" {
  export { default } from "../server/api/trips/[id].get";
}

declare module "@trips-id.patch" {
  export { default } from "../server/api/trips/[id].patch";
}

declare module "@trips-id.delete" {
  export { default } from "../server/api/trips/[id].delete";
}

declare module "@trips-id-stops-handler/index.post" {
  export { default } from "../server/api/trips/[id]/stops/index.post";
}

declare module "@trips-id-stops-handler/reorder.put" {
  export { default } from "../server/api/trips/[id]/stops/reorder.put";
}

declare module "@trips-id-stopid.patch" {
  export { default } from "../server/api/trips/[id]/stops/[stopId].patch";
}

declare module "@trips-id-stopid.delete" {
  export { default } from "../server/api/trips/[id]/stops/[stopId].delete";
}
