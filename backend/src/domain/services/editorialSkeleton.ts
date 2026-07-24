import type { Book, Content, FrontMatter, Section } from '../models/Book';
import { classifyEditorialTitle, type EditorialPlacement } from './structureAssist/structureTaxonomy';

/**
 * The editorial skeleton — a PROJECTED READ MODEL over the immutable `Book` (AUTHOR_EXPERIENCE_DR
 * §3 D1, Option B, CTO-gated 2026-07-24).
 *
 * The problem it removes: the editorial spine is split across three representations — chapters in
 * `mainContent`, editorial parts recognised BY TITLE in `mainContent`, and typed `FrontMatter`
 * slots. `projectEditorialSkeleton(book)` assembles them into ONE ordered surface the left panel
 * renders, WITHOUT extending the aggregate — so pagination, the three renderers, TOC, `orderByRole`,
 * persistence and every mutation keep today's shapes. ADR-0001 holds by construction: this reads the
 * immutable Book and never becomes part of it.
 *
 * THE LOAD-BEARING INVARIANT — a single write path. `EditorialSkeleton` is DERIVED and READ-ONLY:
 * this module exports one pure function and no mutator, imports no mutation, and DEEP-FREEZES its
 * output so no code path can write INTO the projection. Every skeleton gesture dispatches one of the
 * existing `BookEditingService` ops against the `Book` (through `EditBookUseCase`); the Book changes
 * and the projection is RE-DERIVED. If the panel could edit the projection directly it would be a
 * fourth representation drifting from the model — precisely the fragility being removed. The two
 * locked tests are the guarantee: `editorialSkeleton.setterLock.test.ts` (nothing writes in) and
 * `editorialSkeleton.coherence.test.ts` (the read follows the write, every mutation type).
 *
 * ── The grain (deliberate, matching the DR field list "front matter, parts, chapters, back matter"
 * and the founder-validated mockup, which shows a FLAT top-level spine): the skeleton is the
 * TOP-LEVEL editorial order only. A chapter's sections/subsections are document-centre detail, not
 * skeleton objects — so the sub-structural ops (`promoteToSubsection`, `markAsSubtitle`,
 * `clearSubtitle`, `setCallout`, and a front-matter CONTENT edit) are BELOW this grain and correctly
 * leave the top-level projection unchanged. The coherence test asserts exactly that.
 *
 * ── Document order is PRESERVED for `mainContent` objects (never `orderByRole`'s render-time
 * reordering): positional ops (`reorderChapters`, `insertPartOpener`) address `mainContent` by index,
 * so the skeleton must mirror the STORED order for those indices to map. `place` is therefore a
 * derived LABEL (front/body/back), not a re-sort — the honest signal of where a part renders, with
 * the stored spine intact. FrontMatter slots (not index-addressable) lead; back-matter slots (not
 * yet surfaced — see below) would trail.
 */

/** Where an editorial object sits in the reading order — the DR's front/body/back. */
export type EditorialPlace = 'front' | 'body' | 'back';

/**
 * The kind of editorial object. `front-matter`/`back-matter` cover both a typed `FrontMatter` slot
 * AND a `mainContent` part placed there by role or canonical title — `sourceRef.kind` distinguishes
 * the source; `place` drives the badge.
 */
export type EditorialObjectType = 'front-matter' | 'part-opener' | 'chapter' | 'section' | 'back-matter';

/** The typed `FrontMatter` slots the skeleton surfaces, in canonical (model-declared) order. */
export type FrontMatterSlot =
  | 'titlePage' | 'copyrightPage' | 'dedication' | 'toc'
  | 'preface' | 'foreword' | 'introduction' | 'acknowledgments';

/**
 * A pointer back to the object's source in the Book, so a gesture can target it with an existing op.
 * `content` → a `mainContent` entry addressed by id (rename/setPartRole/promote/merge/… all take an
 * id or an index the UI derives from it); `front-matter` → a typed slot (`editFrontMatter`, D2's
 * `addFrontMatterSection`).
 */
export type EditorialSourceRef =
  | { readonly kind: 'content'; readonly id: string }
  | { readonly kind: 'front-matter'; readonly slot: FrontMatterSlot };

export interface EditorialObject {
  readonly type: EditorialObjectType;
  /** The display title — a chapter/part's own title, or a front-matter slot's canonical name. */
  readonly title: string;
  readonly place: EditorialPlace;
  readonly sourceRef: EditorialSourceRef;
  /**
   * The computed 1-based chapter number — a DATUM, never authorable (`CHAPTER_TITLE_PRESENTATION`
   * inviolable). Present ONLY on a body `chapter`; counted over body chapters, skipping part-openers
   * and front/back editorial parts (the `bookFacts` chapter-count rule). The single source the D6
   * title surface reads, so no UI ever offers the number as an editable field (the D8 grammar
   * property M1's judge locks).
   */
  readonly number?: number;
}

export interface EditorialSkeleton {
  readonly objects: readonly EditorialObject[];
}

/** The typed front-matter slots that are navigable editorial objects, in canonical reading order. */
const FRONT_MATTER_SLOTS: { slot: FrontMatterSlot; label: string }[] = [
  { slot: 'titlePage', label: 'Title Page' },
  { slot: 'copyrightPage', label: 'Copyright' },
  { slot: 'dedication', label: 'Dedication' },
  { slot: 'toc', label: 'Table of Contents' },
  { slot: 'preface', label: 'Preface' },
  { slot: 'foreword', label: 'Foreword' },
  { slot: 'introduction', label: 'Introduction' },
  { slot: 'acknowledgments', label: 'Acknowledgments' },
];

/** A slot's own title when it carries one (`Section`s do), else its canonical label. */
function frontMatterTitle(fm: FrontMatter, slot: FrontMatterSlot, label: string): string {
  const value = fm[slot];
  if (value && typeof value === 'object' && 'title' in value && typeof value.title === 'string' && value.title.trim()) {
    return value.title;
  }
  return label;
}

/**
 * Project the immutable Book into its editorial skeleton — one ordered, deeply-frozen read model.
 * Pure: the input Book is never touched, and the output cannot be written into.
 */
export function projectEditorialSkeleton(book: Book): EditorialSkeleton {
  const objects: EditorialObject[] = [];

  // 1. Typed front-matter slots that are present (title page, copyright, composed sections, TOC).
  for (const { slot, label } of FRONT_MATTER_SLOTS) {
    if (book.frontMatter[slot] == null) continue;
    objects.push({
      type: 'front-matter',
      title: frontMatterTitle(book.frontMatter, slot, label),
      place: 'front',
      sourceRef: { kind: 'front-matter', slot },
    });
  }

  // 2. mainContent in DOCUMENT ORDER — each item classified into type + place; body chapters numbered.
  let chapterNumber = 0;
  for (const content of book.mainContent) {
    objects.push(projectContent(content, () => (chapterNumber += 1)));
  }

  // (Back-matter typed slots — bibliography/glossary/index/colophon — are not yet surfaced: real
  //  imports leave `backMatter` empty and no mutation writes it, so there is nothing to project. A
  //  bounded addition when a composer for them lands, mirroring the front-matter block above.)

  return deepFreeze({ objects });
}

/** Classify one top-level `mainContent` entry. `nextNumber` is called (and its value used) only for a body chapter. */
function projectContent(content: Content, nextNumber: () => number): EditorialObject {
  const sourceRef: EditorialSourceRef = { kind: 'content', id: content.id };

  // A part opener (Part I/II divider) is neither a chapter nor an editorial part — it groups what
  // follows, consumes no number, and is always body-placed.
  if (content.type === 'chapter' && content.partOpener) {
    return { type: 'part-opener', title: content.title, place: 'body', sourceRef };
  }

  // Placement: an explicit author `role` tag is authoritative; else the canonical-title convention;
  // else ordinary body content. Same precedence as `bookFacts` (`tagged ?? category.placement`).
  const category = classifyEditorialTitle(content.title);
  const place: EditorialPlace = resolvePlace(content.role, category?.placement);

  if (place === 'front') return { type: 'front-matter', title: content.title, place, sourceRef };
  if (place === 'back') return { type: 'back-matter', title: content.title, place, sourceRef };

  // Body: a real chapter (numbered) or a top-level section (rare — a preamble section).
  if (content.type === 'chapter') {
    return { type: 'chapter', title: content.title, place, sourceRef, number: nextNumber() };
  }
  return { type: 'section', title: titleOfSection(content), place, sourceRef };
}

function resolvePlace(role: Content['role'], categoryPlacement: EditorialPlacement | undefined): EditorialPlace {
  if (role === 'front' || role === 'back') return role;
  if (categoryPlacement) return categoryPlacement;
  return 'body';
}

function titleOfSection(section: Section): string {
  return section.title;
}

/** Recursively freeze an object graph so no consumer can write into the projection (the runtime half of the setter-lock). */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}
