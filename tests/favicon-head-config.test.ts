import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FAVICON_HEAD_LINKS } from "../favicon-head.config";

const PUBLIC_DIRECTORY = resolve(__dirname, "../public");

function publicFileExists(urlPath: string): boolean {
  return existsSync(resolve(PUBLIC_DIRECTORY, `.${urlPath}`));
}

describe("favicon head config", () => {
  it.each(FAVICON_HEAD_LINKS.map((link) => [link.rel, link.href]))(
    "%s link points at a file in public (%s)",
    (_rel, href) => {
      expect(publicFileExists(href as string)).toBe(true);
    },
  );

  it("links the web manifest", () => {
    const relValues = FAVICON_HEAD_LINKS.map((link) => link.rel);

    expect(relValues).toContain("manifest");
  });

  it("only lists manifest icons that exist in public", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(PUBLIC_DIRECTORY, "site.webmanifest"), "utf8"),
    ) as { icons: { src: string }[] };

    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(publicFileExists(icon.src)).toBe(true);
    }
  });
});
