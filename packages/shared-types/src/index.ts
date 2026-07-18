/**
 * Canonical TypeScript type/DTO definitions shared between `backend/` and
 * `frontend/`. `ManuscriptOptionsDTO` is the first real export (Sprint 7
 * commit 2, Decision 5) — a genuinely new type, not a move of an existing
 * one. The pre-existing backend DTOs (`BookDTO`, `ImportReportDTO`, ...)
 * are re-exported here starting commit 3 (ADR-0033).
 */
export type { ThemeOptionDTO, LayoutOptionDTO, ManuscriptOptionsDTO } from './ManuscriptOptionsDTO';
