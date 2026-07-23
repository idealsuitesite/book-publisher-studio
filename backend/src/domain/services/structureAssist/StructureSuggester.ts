import type { Book, Content, Block } from '../../models/Book';
import { classifyMarker, type MarkerKind } from './structureTaxonomy';
import { repeatedEditorialKeys } from './repeatedEditorialMarkers';

/**
 * One proposed chapter boundary — a candidate, never an applied change (STRUCTURE_ASSIST_DR.md §3).
 * Carries the EVIDENCE that triggered it (the manuscript's own text), the ADR-0049 honest-finding
 * shape: an author confirms a suggestion they can see the reason for.
 */
export interface StructureSuggestion {
  /** The block the author would promote to a chapter (via the existing promoteToChapter op). */
  blockId: string;
  /** The proposed chapter title (the marker text itself). */
  proposedTitle: string;
  kind: MarkerKind;
  /** Taxonomy key: an editorial category, or 'chapter' for a numbered marker. */
  key: string;
  /** The exact source text that triggered the suggestion — shown to the author as the reason. */
  evidence: string;
}

/**
 * STRUCTURE_ASSIST — the pure suggestion service (Domain, no infrastructure). Reads a Book whose
 * structure the author typed as plain text (the under-structured case, FOUNDER_TRAVERSAL_1) and
 * proposes the chapter boundaries it can name from the shared taxonomy — the ALL-CAPS `CHAPTER 1`
 * / `INTRODUCTION` markers the importer dropped to body paragraphs.
 *
 * THE INVARIANT (§3): this service NEVER mutates the Book. It returns a read-only proposal; only an
 * author action invokes `promoteToChapter`. A test pins that running `suggest` and discarding its
 * output leaves the Book byte-identical — in BOTH regimes:
 *  - UNDER-structured → real suggestions the author confirms;
 *  - OVER-structured (already chaptered) → ~nothing (the markers are already headings, not body
 *    paragraphs), and it never adds structure to a book that already has it. Collapsing the
 *    over-structure is STRUCTURE_CLEANUP's job (§9), not this suggester's.
 */
export class StructureSuggester {
  suggest(book: Book): StructureSuggestion[] {
    const candidates: StructureSuggestion[] = [];
    // Only TOP-LEVEL containers' own body paragraphs are candidates — that is exactly what
    // promoteToChapter can act on. Content already sitting under a chapter/section title is
    // structured; we never propose to re-cut it (the over-structured guard, §3 bidirectional).
    for (const content of book.mainContent as Content[]) {
      for (const block of content.content as Block[]) {
        if (block.type !== 'paragraph') continue;
        const text = block.text;
        if (!text || !text.trim()) continue;
        const marker = classifyMarker(text);
        if (!marker) continue;
        candidates.push({
          blockId: block.id,
          proposedTitle: marker.label,
          kind: marker.kind,
          key: marker.key,
          evidence: text.trim(),
        });
      }
    }

    // REPEATED_EDITORIAL_MARKERS guard (FOUNDER_TRAVERSAL_3 A2). A canonical editorial name that
    // appears MORE THAN ONCE is a recurring section title, not a book part (the founder's per-chapter
    // "Conclusion" ×26): it STOPS being proposed as a chapter — all its occurrences drop. The repetition
    // recognition is the SHARED `repeatedEditorialKeys` (D3): this guard SUPPRESSES the wrong offer,
    // SUBCHAPTER_PROMOTION (B5) MAKES the right one (a section of the chapter) — two faces of one
    // recognition, one source of truth, never two thresholds. Numbered-chapter markers are untouched —
    // a duplicated `CHAPTER 8` is the author's own content, not a repeated editorial name.
    const repeated = repeatedEditorialKeys(candidates.filter((s) => s.kind === 'editorial').map((s) => s.key));
    return candidates.filter((s) => s.kind !== 'editorial' || !repeated.has(s.key));
  }
}
