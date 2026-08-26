const WIKI_LINK = /\[\[([^\]]+)\]\]/g;

/** All [[wiki-link]] targets in a markdown body, trimmed, deduped. */
export function extractWikiLinks(body: string): string[] {
  const out = new Set<string>();
  for (const match of body.matchAll(WIKI_LINK)) {
    const target = match[1].trim();
    if (target) out.add(target);
  }
  return [...out];
}

/**
 * Render markdown to HTML with [[wiki-links]] turned into anchors.
 * Broken links get class "wiki-broken". `resolve` maps a title to its note id (or null).
 */
export function renderMarkdownWithWikiLinks(
  html: string,
  resolve: (title: string) => string | null
): string {
  return html.replace(WIKI_LINK, (_m, raw: string) => {
    const title = raw.trim();
    const id = resolve(title);
    if (id) return `<a href="/kb/${id}" class="wiki-link">${escapeHtml(title)}</a>`;
    return `<a href="/kb/new?title=${encodeURIComponent(title)}" class="wiki-broken" title="broken link — click to create">${escapeHtml(title)}</a>`;
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
