import type { Book, Content, Section } from '../../models/Book';
import { classifyMarker } from '../structureAssist/structureTaxonomy';

/**
 * One proposed marker collapse — a candidate, never an applied change (STRUCTURE_CLEANUP_DR.md §3).
 * The over-structured mirror of `StructureSuggestion`: it names the empty MARKER heading to remove
 * and the real chapter it folds into, with the marker text as the evidence (ADR-0049 honest shape).
 */
export interface CleanupSuggestion {
  /** The empty marker chapter's id — what the author confirms (the `collapseMarker` mutation acts on it). */
  markerId: string;
  /** The marker's own text — the evidence shown to the author ("CHAPTER 1", "INTRODUCTION"). */
  markerText: string;
  /** 'numbered' (`CHAPTER n`) or 'editorial' (`INTRODUCTION`/`CONCLUSION`) — the two collapse forms (§6.3). */
  kind: 'numbered' | 'editorial';
  /** The real chapter the marker collapses into. */
  targetChapterId: string;
  /** That chapter's real title — shown so the author sees what survives. */
  targetTitle: string;
  /** For an editorial marker: the canonical label the follower is renamed to (its own title becomes a subtitle). */
  canonicalLabel?: string;
}

const ownWords = (content: Content): number =>
  (content.content ?? []).reduce((n, b) => n + (('text' in b && typeof b.text === 'string' && b.text.trim()) ? b.text.trim().split(/\s+/).length : 0), 0);

const sectionCount = (content: Content): number =>
  content.type === 'chapter' ? (content.sections?.length ?? 0) : ((content as Section).subsections?.length ?? 0);

/**
 * STRUCTURE_CLEANUP — the pure detector (Domain, no infrastructure). Reads an OVER-structured Book —
 * the author styled `CHAPTER n` / `INTRODUCTION` as their OWN empty `Heading 1`, separate from the
 * real chapter title (FOUNDER_TRAVERSAL_2) — and proposes to collapse each redundant EMPTY marker
 * into the real chapter that follows it.
 *
 * THE INVARIANT (§3, mirror of the assist): this service NEVER mutates the Book. It returns a
 * read-only proposal; only an author action invokes `collapseMarker`. Running `suggest` and
 * discarding its output leaves the Book byte-identical — in BOTH regimes:
 *  - OVER-structured → real collapse proposals the author confirms;
 *  - UNDER-structured (0 empty markers — the markers are body TEXT, the assist's job) → SILENT.
 *
 * A candidate is an EMPTY marker (0 own words AND 0 sections, a recognised marker title) immediately
 * followed by a REAL (non-marker) title. Conservative by design: a marker followed by another marker
 * (adjacent markers) is NOT proposed — the detector never mis-pairs (the robustness rule, D4).
 */
export class CleanupSuggester {
  suggest(book: Book): CleanupSuggestion[] {
    const suggestions: CleanupSuggestion[] = [];
    const entries = book.mainContent as Content[];

    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      // A part divider is deliberately blockless (its own op removes it) — never a cleanup marker.
      if (entry.type === 'chapter' && entry.partOpener) continue;

      const marker = classifyMarker(entry.title);
      if (!marker) continue;
      // Empty = 0 own words AND 0 sections. A section-bearing title (pattern B) is legitimate
      // structure, never a marker to collapse (the cadrage's Constat 1).
      if (ownWords(entry) > 0 || sectionCount(entry) > 0) continue;

      // The collapse target: the entry immediately after must exist and be a REAL title (not itself a
      // marker) — so each marker pairs with its OWN following title, never the wrong one (D4).
      const target = entries[i + 1];
      if (!target || classifyMarker(target.title)) continue;

      suggestions.push({
        markerId: entry.id,
        markerText: entry.title,
        kind: marker.kind === 'editorial' ? 'editorial' : 'numbered',
        targetChapterId: target.id,
        targetTitle: target.title,
        canonicalLabel: marker.kind === 'editorial' ? marker.label : undefined,
      });
    }
    return suggestions;
  }
}
