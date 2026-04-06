import type { RendererObject } from "marked";

const ESCAPED_UNDERSCORE_RE = /\\_/g;
const URL_SCHEME_RE = /^(?:https?:\/\/|mailto:)/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isUrlLikeText(value: string): boolean {
  return URL_SCHEME_RE.test(value);
}

export function normalizeEscapedUrlUnderscores(value: string): string {
  return value.replace(ESCAPED_UNDERSCORE_RE, "_");
}

export function createMarkdownRenderer(
  renderHighlightedCode?: (text: string, lang?: string | null) => string | null,
): RendererObject {
  return {
    code({ text, lang }: { text: string; lang?: string | null }) {
      const language = lang || "";
      const dataAttr = language ? ` data-lang="${escapeHtml(language)}"` : "";
      const highlighted = renderHighlightedCode?.(text, language);

      if (highlighted) {
        return `<div class="code-block"${dataAttr}>${highlighted}</div>`;
      }

      return `<div class="code-block"${dataAttr}><pre><code>${escapeHtml(text)}</code></pre></div>`;
    },
    link({ href, title, tokens }) {
      const safeHref = escapeHtml(normalizeEscapedUrlUnderscores(href));
      const renderedText = this.parser.parseInline(tokens);
      const text = isUrlLikeText(renderedText)
        ? normalizeEscapedUrlUnderscores(renderedText)
        : renderedText;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";

      return `<a href="${safeHref}"${titleAttr}>${text}</a>`;
    },
    image({ href, title, text }) {
      const safeHref = escapeHtml(normalizeEscapedUrlUnderscores(href));
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";

      return `<img src="${safeHref}" alt="${escapeHtml(text)}"${titleAttr}>`;
    },
  };
}
