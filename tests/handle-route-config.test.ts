import { describe, it, expect } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import {
  HANDLE_PROFILE_ROUTE_NAME,
  HANDLE_PROFILE_ROUTE_PATH,
  addHandleProfileRoute,
} from "../handle-route.config";

describe("addHandleProfileRoute", () => {
  it("registers /@:handle against the existing profile page file", () => {
    const pages: { name?: string; path?: string; file?: string }[] = [];

    addHandleProfileRoute(pages, "/project");

    expect(pages).toEqual([
      {
        name: HANDLE_PROFILE_ROUTE_NAME,
        path: "/@:handle",
        file: "/project/app/pages/u/[id].vue",
      },
    ]);
  });

  it("keeps the existing pages", () => {
    const pages = [{ name: "u-id", path: "/u/:id()" }];
    addHandleProfileRoute(pages, "/project");
    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({ name: "u-id", path: "/u/:id()" });
  });

  describe("the registered path", () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/u/:id()", component: {} },
        {
          name: HANDLE_PROFILE_ROUTE_NAME,
          path: HANDLE_PROFILE_ROUTE_PATH,
          component: {},
        },
      ],
    });

    it("captures the handle, preserving its casing", () => {
      const resolved = router.resolve("/@Grimicorn");
      expect(resolved.name).toBe(HANDLE_PROFILE_ROUTE_NAME);
      expect(resolved.params.handle).toBe("Grimicorn");
    });

    it("does not capture nested paths or the id route", () => {
      expect(router.resolve("/@dan/extra").name).toBeUndefined();
      expect(router.resolve("/u/abc").params.handle).toBeUndefined();
    });
  });
});
