import { readFileSync } from "node:fs";
import { pool } from "../db/pool.js";
import { sourceLabel } from "./paths.js";

export type DocumentListItem = {
  id: number;
  filePath: string;
  label: string;
  updatedAt: string;
};

export type DocumentPreview = DocumentListItem & {
  content: string;
};

type DocumentRow = {
  id: number;
  file_path: string;
  updated_at: Date | string;
};

function mapDocument(row: DocumentRow): DocumentListItem {
  return {
    id: row.id,
    filePath: row.file_path,
    label: sourceLabel(row.file_path),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  const result = await pool.query<DocumentRow>(
    `SELECT id, file_path, updated_at
     FROM documents
     ORDER BY updated_at DESC, file_path ASC`,
  );

  return result.rows.map(mapDocument);
}

export async function deleteDocument(documentId: number): Promise<boolean> {
  const result = await pool.query("DELETE FROM documents WHERE id = $1 RETURNING id", [documentId]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getDocumentPreview(documentId: number): Promise<DocumentPreview | null> {
  const result = await pool.query<DocumentRow>(
    `SELECT id, file_path, updated_at
     FROM documents
     WHERE id = $1`,
    [documentId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const document = mapDocument(row);
  const content = readFileSync(document.filePath, "utf-8");

  return {
    ...document,
    content,
  };
}
