/**
 * Single source of truth for StyledBook.blockTypography's key convention.
 *
 * Most blocks own exactly one text stream, keyed by their own block.id. Some
 * blocks (List today; Table cells if Table ever gains inline support) own
 * several independent text streams and need one key per stream instead of
 * one key for the whole block - see docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md
 * for the design rationale. Centralized here so no caller hand-builds these
 * strings (TypographyResolver writes them; renderers will read them from
 * commit 5 onward).
 */

export function blockTypographyKey(blockId: string): string {
  return blockId;
}

export function listItemTypographyKey(blockId: string, itemIndex: number): string {
  return `${blockId}::item-${itemIndex}`;
}

// Reserved naming convention, no function yet: Table has no `inlines` field
// today (headers/rows are plain strings), so there is nothing to key by cell.
// If Table ever gains inline support, its per-cell key should follow the same
// `${blockId}::cell-${row}-${col}` shape as listItemTypographyKey above,
// decided once here rather than improvised at that point.
