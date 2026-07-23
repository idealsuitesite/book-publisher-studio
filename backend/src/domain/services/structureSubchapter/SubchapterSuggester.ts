import type { Book, Content, Chapter, Block } from '../../models/Book';
import { classifyMarker } from '../structureAssist/structureTaxonomy';
import { repeatedEditorialKeys } from '../structureAssist/repeatedEditorialMarkers';

/**
 * One proposed sub-section — a candidate, never an applied change (SUBCHAPTER_PROMOTION_DR §3).
 * Names the marker block to demote and the parent chapter it becomes a section of.
 */
export interface SubchapterSuggestion {
  /** The recurring editorial marker in a chapter's own body — what the author confirms (→ promoteToSubsection). */
  blockId: string;
  /** The canonical label the section takes (e.g. "Conclusion"). */
  proposedTitle: string;
  /** Taxonomy key (e.g. 'conclusion') — shared with the A2 guard (D3). */
  key: string;
  /** The parent chapter this marker becomes a section of. */
  chapterId: string;
  /** That chapter's title — shown so the author sees where the section lands. */
  chapterTitle: string;
}

/**
 * SUBCHAPTER_PROMOTION (B5) — the pure detector (Domain, no infrastructure). The third structural
 * form: an author who typed the SAME editorial name (e.g. "Conclusion") at the end of EVERY chapter
 * wants each to be a SECTION of its chapter — a continuity — not N peer chapters. It reads a book
 * whose chapters already exist (D4: never at raw import — that moment is the assist's) and proposes
 * to demote each recurring editorial marker to a section of the chapter it sits in.
 *
 * THE INVARIANT (§3, the family's): this service NEVER mutates the Book. It returns a read-only
 * proposal; only an author action invokes `promoteToSubsection`. Running `suggest` and discarding its
 * output leaves the Book byte-identical — at BOTH poles (recurring editorial subheadings → proposes;
 * none → silent).
 *
 * The trigger is the SHARED repetition recognition (`repeatedEditorialKeys`, D3): a canonical
 * editorial name occurring N>1 across the book's chapter bodies. This is the exact recognition the A2
 * guard uses to SUPPRESS the wrong chapter proposal — here it MAKES the right sub-section one. One
 * source of truth. Deductive, not heuristic; the descriptive sub-headings (no deductive signal) are
 * out of scope (DR §2, DESCRIPTIVE_SUBHEADING_DETECTION).
 */
export class SubchapterSuggester {
  suggest(book: Book): SubchapterSuggestion[] {
    // Every editorial marker sitting in a TOP-LEVEL chapter's OWN body, with its parent chapter.
    const occurrences: { blockId: string; key: string; label: string; chapter: Chapter }[] = [];
    for (const content of book.mainContent as Content[]) {
      if (content.type !== 'chapter' || content.partOpener) continue;
      for (const block of content.content as Block[]) {
        if (block.type !== 'paragraph') continue;
        const marker = classifyMarker(block.text);
        if (marker?.kind === 'editorial') occurrences.push({ blockId: block.id, key: marker.key, label: marker.label, chapter: content });
      }
    }

    // Only the REPEATED editorial names are sub-structure (D3, shared). A name appearing once in one
    // chapter is that chapter's own single part, not a recurring pattern — left alone.
    const repeated = repeatedEditorialKeys(occurrences.map((o) => o.key));
    return occurrences
      .filter((o) => repeated.has(o.key))
      .map((o) => ({ blockId: o.blockId, proposedTitle: o.label, key: o.key, chapterId: o.chapter.id, chapterTitle: o.chapter.title }));
  }
}
