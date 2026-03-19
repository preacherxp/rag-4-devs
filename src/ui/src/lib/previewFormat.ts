export type TocHeading = { level: number; text: string; slug: string };

export function slugifyForAnchor(text: string): string {
  const s = text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s || "section";
}

function nextUniqueSlug(base: string, counts: Map<string, number>): string {
  const n = (counts.get(base) ?? 0) + 1;
  counts.set(base, n);
  if (n === 1) return base;
  return `${base}-${n - 1}`;
}

export function extractTocFromMarkdown(md: string): TocHeading[] {
  const counts = new Map<string, number>();
  const toc: TocHeading[] = [];
  for (const line of md.split("\n")) {
    const trimmed = line.trimStart();
    const m = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (!m) continue;
    const level = m[1].length;
    let text = m[2]
      .replace(/\s+#+\s*$/, "")
      .replace(/#+\s*$/, "")
      .trim();
    if (!text) continue;
    const base = slugifyForAnchor(text);
    const slug = nextUniqueSlug(base, counts);
    toc.push({ level, text, slug });
  }
  return toc;
}

/** Trailing -digits disambiguator (e.g. Unix ts in filenames). */
const TRAILING_ID_SUFFIX = /-(\d{8,14})$/;

function titleCaseWords(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One path segment: s02e04-foo-bar-1773309028 → S02E04 · Foo Bar */
export function prettyPathSegment(seg: string): string {
  let rest = seg.trim();
  rest = rest.replace(TRAILING_ID_SUFFIX, "");
  const ep = /^s(\d+)e(\d+)-(.*)$/i.exec(rest);
  if (ep) {
    const season = ep[1].padStart(2, "0");
    const episode = ep[2].padStart(2, "0");
    const slug = ep[3].replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    const title = slug ? titleCaseWords(slug) : "";
    return title ? `S${season}E${episode} · ${title}` : `S${season}E${episode}`;
  }
  return titleCaseWords(rest.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim());
}

export function prettyDocumentLabel(label: string): string {
  if (!label.trim()) return "";
  return label.split("/").map(prettyPathSegment).filter(Boolean).join(" › ");
}

export function prettyPreviewTitle(label: string): string {
  if (!label.trim()) return "Document Preview";
  const pretty = prettyDocumentLabel(label);
  return pretty || "Document Preview";
}

export function slugifyWithDedup(text: string, used: Set<string>): string {
  let base = slugifyForAnchor(text);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 1;
  let slug = `${base}-${n}`;
  while (used.has(slug)) {
    n += 1;
    slug = `${base}-${n}`;
  }
  used.add(slug);
  return slug;
}
