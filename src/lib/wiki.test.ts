import { describe, expect, it } from "vitest";
import { extractWikiLinks, renderMarkdownWithWikiLinks } from "./wiki";

describe("extractWikiLinks", () => {
  it("finds and dedupes links", () => {
    expect(extractWikiLinks("see [[Nmap Basics]] and [[nmap basics]] again [[Nmap Basics]]")).toEqual([
      "Nmap Basics",
      "nmap basics",
    ]);
  });

  it("ignores empty brackets", () => {
    expect(extractWikiLinks("[[]] and [[]] real [[Real]]")).toEqual(["Real"]);
  });
});

describe("renderMarkdownWithWikiLinks", () => {
  const resolve = (t: string) => (t === "Known" ? "abc123" : null);

  it("links resolved targets", () => {
    const html = renderMarkdownWithWikiLinks("<p>[[Known]]</p>", resolve);
    expect(html).toContain('href="/kb/abc123"');
    expect(html).toContain("wiki-link");
  });

  it("marks broken links and offers creation", () => {
    const html = renderMarkdownWithWikiLinks("<p>[[Missing]]</p>", resolve);
    expect(html).toContain("wiki-broken");
    expect(html).toContain(encodeURIComponent("Missing"));
  });
});
