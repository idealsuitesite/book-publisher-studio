// Re-export shim (Sprint 7 commit 3, ADR-0033) - the real declaration now lives in
// packages/shared-types, the single canonical source both backend/ and frontend/ depend on.
// Kept here so every existing `from '../dto/InlineDTO'` import in this codebase still resolves
// unchanged - no behavior change, no consumer touched.
export type { InlineDTO } from 'shared-types';
