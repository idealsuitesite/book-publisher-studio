import type {
  ImportResponseDTO,
  ManuscriptOptionsDTO,
  ProjectListResponseDTO,
  ProjectDTO,
  ProjectSettingsDTO,
  UpdateProjectSettingsDTO,
  PublishingResponseDTO,
} from 'shared-types';

// Sprint 7 Decision 2 (docs/architecture/diagrams/SPRINT_7_FIRST_DEMONSTRABLE_PRODUCT.md) - the
// backend stays fully stateless, so every function here is its own complete round trip. No
// session, no server-side manuscript cache. Base URL is a dev-only default (backend's own
// documented default port, docs/DEVELOPMENT_WORKFLOW.md) - overridable via
// NEXT_PUBLIC_API_BASE_URL, never hardcoded as the only option.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000';

/**
 * Every request is bounded. Without a timeout a hung connection leaves the UI waiting forever
 * with a spinner and no way out - the user cannot tell a slow export from a dead server.
 *
 * Export and publish are deliberately given far longer than import: they run the real
 * rendering pipeline, and a real 39,913-word manuscript took ~600ms to export while a much
 * larger one could take many seconds. A limit that is too tight would abort work that was
 * about to succeed, which is worse than waiting.
 */
const IMPORT_TIMEOUT_MS = 60_000;
const OPTIONS_TIMEOUT_MS = 10_000;
const EXPORT_TIMEOUT_MS = 180_000;

export class RequestTimeoutError extends Error {
  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${Math.round(timeoutMs / 1000)}s. The server may be busy or unreachable.`);
    this.name = 'RequestTimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(operation: string) {
    super(`${operation} could not reach the server. Check that the backend is running.`);
    this.name = 'NetworkError';
  }
}

/**
 * Distinguishes the three failure modes a caller genuinely needs to tell apart: the request
 * timed out, the network never delivered it, or the server answered with an error. Previously
 * an offline server surfaced as a raw "Failed to fetch", which tells a user nothing.
 */
async function request(url: string, init: RequestInit, operation: string, timeoutMs: number) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new RequestTimeoutError(operation, timeoutMs);
    }
    if (error instanceof TypeError) {
      throw new NetworkError(operation);
    }
    throw error;
  }
}

export async function importManuscript(file: File): Promise<ImportResponseDTO> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request(
    `${API_BASE_URL}/api/manuscripts/import`,
    { method: 'POST', body: formData },
    'Import',
    IMPORT_TIMEOUT_MS
  );

  // ManuscriptController returns a real ImportResponseDTO body on BOTH 200 (report.status ===
  // 'success') and 422 (report.status === 'error', e.g. an empty DOCX) - the import pipeline
  // ran either way, so the caller inspects report.status itself. Only other statuses (400 bad
  // file, 500 server error) are genuine transport failures with a plain { error } body instead.
  if (response.status === 200 || response.status === 422) {
    return response.json() as Promise<ImportResponseDTO>;
  }

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `Import failed: ${response.status} ${response.statusText}`);
}

export async function getManuscriptOptions(): Promise<ManuscriptOptionsDTO> {
  const response = await request(
    `${API_BASE_URL}/api/manuscripts/options`,
    {},
    'Fetching options',
    OPTIONS_TIMEOUT_MS
  );

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

export async function exportManuscript({
  file,
  theme,
  format,
  layout,
}: ExportManuscriptRequest): Promise<Blob> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', format);
  if (theme) formData.append('theme', theme);
  if (layout) formData.append('layout', layout);

  const response = await request(
    `${API_BASE_URL}/api/manuscripts/export`,
    { method: 'POST', body: formData },
    'Export',
    EXPORT_TIMEOUT_MS
  );

  if (!response.ok) {
    // The backend returns a JSON { error } body for 400s (unknown theme, unknown layout,
    // corrupt file). Surfacing it beats a bare status code the user cannot act on.
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Export failed: ${response.status} ${response.statusText}`);
  }

  return response.blob();
}

/* ------------------------------------------------------------------------------------------
 * Project endpoints (HOME_WORKSPACE.md §0). The Workspace operates on a project id; the
 * server holds the book (Decision 6) — no function below ever carries a File.
 * ---------------------------------------------------------------------------------------- */

export async function listProjects(): Promise<ProjectListResponseDTO> {
  const response = await request(`${API_BASE_URL}/api/projects`, {}, 'Loading projects', OPTIONS_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Loading projects failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<ProjectListResponseDTO>;
}

export async function getProject(id: string): Promise<ProjectDTO> {
  const response = await request(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(id)}`,
    {},
    'Opening project',
    IMPORT_TIMEOUT_MS
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Opening project failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<ProjectDTO>;
}

export async function updateProjectSettings(
  id: string,
  patch: UpdateProjectSettingsDTO
): Promise<ProjectSettingsDTO> {
  const response = await request(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(id)}/settings`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) },
    'Updating settings',
    OPTIONS_TIMEOUT_MS
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Updating settings failed: ${response.status} ${response.statusText}`);
  }
  const json = (await response.json()) as { settings: ProjectSettingsDTO };
  return json.settings;
}

export async function exportProject(id: string, format: ExportFormat): Promise<Blob> {
  const response = await request(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(id)}/export?format=${format}`,
    { method: 'POST' },
    'Export',
    EXPORT_TIMEOUT_MS
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Export failed: ${response.status} ${response.statusText}`);
  }
  return response.blob();
}

export async function publishProject(id: string): Promise<PublishingResponseDTO> {
  const response = await request(
    `${API_BASE_URL}/api/projects/${encodeURIComponent(id)}/publish`,
    { method: 'POST' },
    'Publish',
    EXPORT_TIMEOUT_MS
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Publish failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<PublishingResponseDTO>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await request(`${API_BASE_URL}/api/health`, {}, 'Health check', OPTIONS_TIMEOUT_MS);
    return response.ok;
  } catch {
    return false;
  }
}
