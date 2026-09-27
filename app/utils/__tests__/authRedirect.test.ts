import { describe, it, expect } from "vitest";
import {
  AUTH_REDIRECT_QUERY_PARAM,
  buildLoginPath,
  getSafeRedirectPath,
} from "../authRedirect";

describe("buildLoginPath", () => {
  it("appends the current path as a return_to query param", () => {
    expect(buildLoginPath("/trips/abc123")).toBe(
      `/login?${AUTH_REDIRECT_QUERY_PARAM}=%2Ftrips%2Fabc123`,
    );
  });

  it("preserves an existing query string on the current path", () => {
    expect(buildLoginPath("/u/abc?tab=guides")).toBe(
      `/login?${AUTH_REDIRECT_QUERY_PARAM}=%2Fu%2Fabc%3Ftab%3Dguides`,
    );
  });

  it("falls back to bare /login when given an empty path", () => {
    expect(buildLoginPath("")).toBe("/login");
  });

  it("falls back to bare /login when already on the login page", () => {
    expect(buildLoginPath("/login")).toBe("/login");
  });
});

describe("getSafeRedirectPath", () => {
  it("accepts a root-relative path", () => {
    expect(getSafeRedirectPath("/trips/abc123")).toBe("/trips/abc123");
  });

  it("accepts a root-relative path with a query string", () => {
    expect(getSafeRedirectPath("/u/abc?tab=guides")).toBe("/u/abc?tab=guides");
  });

  it("rejects a non-string value", () => {
    expect(getSafeRedirectPath(undefined)).toBeNull();
    expect(getSafeRedirectPath(null)).toBeNull();
    expect(getSafeRedirectPath(["/trips"])).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(getSafeRedirectPath("")).toBeNull();
  });

  it("rejects an absolute URL to another origin", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBeNull();
  });

  it("rejects a protocol-relative URL", () => {
    expect(getSafeRedirectPath("//evil.com")).toBeNull();
  });

  it("rejects a backslash-prefixed value browsers may treat as protocol-relative", () => {
    expect(getSafeRedirectPath("/\\evil.com")).toBeNull();
  });

  it("rejects a path with no leading slash", () => {
    expect(getSafeRedirectPath("trips/abc123")).toBeNull();
  });

  it("rejects a tab-hidden protocol-relative URL a browser's URL parser would strip and normalize", () => {
    expect(getSafeRedirectPath("/\t/evil.com")).toBeNull();
  });

  it("rejects a newline-hidden protocol-relative URL a browser's URL parser would strip and normalize", () => {
    expect(getSafeRedirectPath("/\n/evil.com")).toBeNull();
  });

  it("rejects a dot-segment value that normalizes to a protocol-relative output", () => {
    // The origin check alone isn't enough here: "/.//evil.com" resolves
    // against the placeholder origin (so parsed.origin still matches), but
    // the URL parser's own dot-segment collapsing turns its pathname into
    // "//evil.com" - protocol-relative once returned to the caller.
    expect(getSafeRedirectPath("/.//evil.com")).toBeNull();
    expect(getSafeRedirectPath("/..//evil.com")).toBeNull();
  });

  it("rejects a value that resolves back to the login page itself", () => {
    expect(getSafeRedirectPath("/login")).toBeNull();
    expect(getSafeRedirectPath("/login?foo=1")).toBeNull();
  });

  it("rejects login-page variants Vue Router would still match as /login", () => {
    // Vue Router's default matching is case-insensitive and ignores a
    // trailing slash, so these reach the login route despite not being the
    // exact string "/login".
    expect(getSafeRedirectPath("/login/")).toBeNull();
    expect(getSafeRedirectPath("/LOGIN")).toBeNull();
    expect(getSafeRedirectPath("/LOGIN?foo=1")).toBeNull();
  });
});
