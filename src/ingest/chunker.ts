export type Chunk = {
  heading: string;
  content: string;
  chunkIndex: number;
};

const HEADING_RE = /^(#{1,3})\s+(.+)$/;
const CODE_FENCE_RE = /^```/;
const IMAGE_RE = /!\[([^\]]*)\]\([^)]+\)/g;
const TARGET_TOKENS = 512;
const OVERLAP_TOKENS = 64;

/** Rough token count (~4 chars per token). */
function tokenEstimate(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Strip image markdown, keep alt text. */
function stripImages(text: string): string {
  return text.replace(IMAGE_RE, "$1");
}

type Section = { heading: string; lines: string[] };

/** Split markdown into heading-based sections. */
function splitSections(markdown: string): Section[] {
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  let current: Section = { heading: "", lines: [] };

  for (const line of lines) {
    const match = line.match(HEADING_RE);
    if (match) {
      if (current.lines.length > 0) {
        sections.push(current);
      }
      current = { heading: match[2]!, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.length > 0) {
    sections.push(current);
  }

  return sections;
}

/** Split section text into paragraphs, keeping code fences atomic. */
function splitParagraphs(text: string): string[] {
  const lines = text.split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (CODE_FENCE_RE.test(line)) {
      inCodeBlock = !inCodeBlock;
      current.push(line);
      continue;
    }

    if (inCodeBlock) {
      current.push(line);
      continue;
    }

    if (line.trim() === "" && current.length > 0) {
      paragraphs.push(current.join("\n"));
      current = [];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join("\n"));
  }

  return paragraphs;
}

/** Merge small paragraphs into ~TARGET_TOKENS chunks with overlap. */
function mergeIntoChunks(paragraphs: string[], heading: string): Chunk[] {
  if (paragraphs.length === 0) return [];

  const chunks: Chunk[] = [];
  let buffer: string[] = [];
  let bufferTokens = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const paraTokens = tokenEstimate(para);

    // If a single paragraph exceeds target, flush buffer then add it as its own chunk
    if (paraTokens > TARGET_TOKENS && buffer.length > 0) {
      chunks.push({
        heading,
        content: buffer.join("\n\n"),
        chunkIndex: chunkIndex++,
      });
      buffer = [];
      bufferTokens = 0;
    }

    if (bufferTokens + paraTokens > TARGET_TOKENS && buffer.length > 0) {
      chunks.push({
        heading,
        content: buffer.join("\n\n"),
        chunkIndex: chunkIndex++,
      });

      // Overlap: keep the last paragraph if it fits within overlap budget
      const lastPara = buffer[buffer.length - 1]!;
      if (tokenEstimate(lastPara) <= OVERLAP_TOKENS) {
        buffer = [lastPara];
        bufferTokens = tokenEstimate(lastPara);
      } else {
        buffer = [];
        bufferTokens = 0;
      }
    }

    buffer.push(para);
    bufferTokens += paraTokens;
  }

  if (buffer.length > 0) {
    chunks.push({
      heading,
      content: buffer.join("\n\n"),
      chunkIndex: chunkIndex++,
    });
  }

  return chunks;
}

/** Chunk a markdown document into embedding-ready pieces. */
export function chunkMarkdown(markdown: string): Chunk[] {
  const cleaned = stripImages(markdown);
  const sections = splitSections(cleaned);

  const allChunks: Chunk[] = [];
  let globalIndex = 0;

  for (const section of sections) {
    const text = section.lines.join("\n").trim();
    if (!text) continue;

    const paragraphs = splitParagraphs(text);
    const sectionChunks = mergeIntoChunks(paragraphs, section.heading);

    for (const chunk of sectionChunks) {
      allChunks.push({ ...chunk, chunkIndex: globalIndex++ });
    }
  }

  return allChunks;
}
