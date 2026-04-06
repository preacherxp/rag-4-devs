import { marked } from "marked";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { createMarkdownRenderer } from "./markdown.js";

let highlighter: HighlighterCore | null = null;
let _ready = $state(false);

export function isHighlighterReady() {
  return _ready;
}

createHighlighterCore({
  themes: [import("shiki/themes/vitesse-dark")],
  langs: [
    import("shiki/langs/javascript"),
    import("shiki/langs/typescript"),
    import("shiki/langs/python"),
    import("shiki/langs/json"),
    import("shiki/langs/html"),
    import("shiki/langs/css"),
    import("shiki/langs/bash"),
    import("shiki/langs/sql"),
    import("shiki/langs/markdown"),
    import("shiki/langs/yaml"),
    import("shiki/langs/go"),
    import("shiki/langs/rust"),
  ],
  engine: createOnigurumaEngine(import("shiki/wasm")),
}).then((h) => {
  highlighter = h;
  _ready = true;
});

const renderer = createMarkdownRenderer((text, language) => {
  if (!highlighter || !language) return null;

  try {
    return highlighter.codeToHtml(text, {
      lang: language,
      theme: "vitesse-dark",
    });
  } catch {
    // Unknown language — fall through to plain rendering
    return null;
  }
});

marked.use({ breaks: true, gfm: true, renderer });

export function parseMarkdown(md: string): string {
  return marked.parse(md) as string;
}
