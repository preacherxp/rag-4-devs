import type { Document, DocumentPreview } from "./types";

export interface PreviewScrollPosition {
  top: number;
  progress: number;
}

const PREVIEW_SCROLL_POSITIONS_KEY = "preview-scroll-positions";

type PreviewScrollMap = Record<string, PreviewScrollPosition>;

function isValidPosition(value: unknown): value is PreviewScrollPosition {
  if (!value || typeof value !== "object") return false;
  const top = (value as PreviewScrollPosition).top;
  const progress = (value as PreviewScrollPosition).progress;
  return Number.isFinite(top) && Number.isFinite(progress);
}

function readScrollPositions(): PreviewScrollMap {
  if (typeof localStorage === "undefined") return {};

  try {
    const raw = localStorage.getItem(PREVIEW_SCROLL_POSITIONS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const positions: PreviewScrollMap = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (isValidPosition(value)) {
        positions[key] = {
          top: Math.max(0, value.top),
          progress: Math.min(1, Math.max(0, value.progress)),
        };
      }
    }

    return positions;
  } catch {
    return {};
  }
}

function writeScrollPositions(positions: PreviewScrollMap) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PREVIEW_SCROLL_POSITIONS_KEY, JSON.stringify(positions));
}

export function getDocumentScrollKey(
  doc:
    | Pick<Document, "id" | "filePath">
    | Pick<DocumentPreview, "id" | "filePath">
    | null
    | undefined,
): string | null {
  if (!doc) return null;
  const filePath = doc.filePath.trim();
  return filePath ? `path:${filePath}` : `id:${doc.id}`;
}

export function readDocumentScrollPosition(scrollKey: string | null): PreviewScrollPosition | null {
  if (!scrollKey) return null;
  return readScrollPositions()[scrollKey] ?? null;
}

export function saveDocumentScrollPosition(
  scrollKey: string | null,
  position: PreviewScrollPosition,
) {
  if (!scrollKey) return;

  const positions = readScrollPositions();
  positions[scrollKey] = {
    top: Math.max(0, position.top),
    progress: Math.min(1, Math.max(0, position.progress)),
  };
  writeScrollPositions(positions);
}

export function clearDocumentScrollPosition(scrollKey: string | null) {
  if (!scrollKey) return;

  const positions = readScrollPositions();
  if (!(scrollKey in positions)) return;
  delete positions[scrollKey];
  writeScrollPositions(positions);
}
