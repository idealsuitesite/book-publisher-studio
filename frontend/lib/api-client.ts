import type { ImportResponseDTO, ManuscriptOptionsDTO } from 'shared-types';

// Sprint 7 Decision 2 (docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md) - the
// backend stays fully stateless, so every function here is its own complete round trip. No
// session, no server-side manuscript cache. Base URL is a dev-only default (backend's own
// documented default port, docs/DEVELOPMENT_WORKFLOW.md) - overridable via
// NEXT_PUBLIC_API_BASE_URL, never hardcoded as the only option.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000';

export async function importManuscript(file: File): Promise<ImportResponseDTO> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/manuscripts/import`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Import failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ImportResponseDTO>;
}

export async function getManuscriptOptions(): Promise<ManuscriptOptionsDTO> {
  const response = await fetch(`${API_BASE_URL}/api/manuscripts/options`);

  if (!response.ok) {
    throw new Error(`Fetching options failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ManuscriptOptionsDTO>;
}

export type ExportFormat = 'docx' | 'pdf' | 'epub';

export interface ExportManuscriptRequest {
  file: File;
  theme?: string;
  format: ExportFormat;
  layout?: string;
}

export async function exportManuscript({ file, theme, format, layout }: ExportManuscriptRequest): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', format);
  if (theme) formData.append('theme', theme);
  if (layout) formData.append('layout', layout);

  const response = await fetch(`${API_BASE_URL}/api/manuscripts/export`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}
