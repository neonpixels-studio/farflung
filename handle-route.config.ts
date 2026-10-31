import { resolve } from "node:path";

// The slice of Nuxt's page record this hook sets (NuxtPage is not importable
// without depending on @nuxt/schema directly).
interface PageRecord {
  name?: string;
  path?: string;
  file?: string;
}

export const HANDLE_PROFILE_ROUTE_NAME = "handle-profile";
export const HANDLE_PROFILE_ROUTE_PATH = "/@:handle";
const PROFILE_PAGE_RELATIVE_FILE = "app/pages/u/[id].vue";

/**
 * Registers `/@<handle>` as a second route for the existing public profile
 * page (app/pages/u/[id].vue). Done in the `pages:extend` hook rather than a
 * second page file so there is one profile page to maintain. `rootDir` is the
 * project root, which is the working directory for every Nuxt script here.
 */
export function addHandleProfileRoute(
  pages: PageRecord[],
  rootDir: string = process.cwd(),
): void {
  pages.push({
    name: HANDLE_PROFILE_ROUTE_NAME,
    path: HANDLE_PROFILE_ROUTE_PATH,
    file: resolve(rootDir, PROFILE_PAGE_RELATIVE_FILE),
  });
}
