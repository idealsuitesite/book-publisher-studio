/**
 * The editorial skeleton on the wire (AUTHOR_EXPERIENCE_DR §3 D1) — the DTO mirror of the backend
 * Domain read model `projectEditorialSkeleton(book)`. The projection is computed ONCE, in the Domain,
 * and carried on `ProjectDTO.skeleton`, so the workspace renders a spine that is always coherent with
 * the book it was derived from — never a second, client-side re-derivation that could drift.
 *
 * Type only, zero runtime (shared-types contract). The backend `EditorialSkeletonMapper` is the sole
 * producer; the frontend workspace is the consumer.
 */

/** Where an editorial object sits in the reading order — front matter / body / back matter. */
export type EditorialPlaceDTO = 'front' | 'body' | 'back';

/** The kind of editorial object; `sourceRef.kind` distinguishes a typed slot from a mainContent part. */
export type EditorialObjectTypeDTO = 'front-matter' | 'part-opener' | 'chapter' | 'section' | 'back-matter';

/** The typed front-matter slots the skeleton surfaces (matching the Domain `FrontMatterSlot`). */
export type FrontMatterSlotDTO =
  | 'titlePage' | 'copyrightPage' | 'dedication' | 'toc'
  | 'preface' | 'foreword' | 'introduction' | 'acknowledgments';

/**
 * A pointer back to the object's source in the Book — the target a gesture's op addresses. `content`
 * → a mainContent entry (by id); `front-matter` → a typed slot (`editFrontMatter` / D2's add op).
 */
export type EditorialSourceRefDTO =
  | { kind: 'content'; id: string }
  | { kind: 'front-matter'; slot: FrontMatterSlotDTO };

export interface EditorialObjectDTO {
  type: EditorialObjectTypeDTO;
  /** The display title — a chapter/part's own title, or a front-matter slot's canonical name. */
  title: string;
  place: EditorialPlaceDTO;
  sourceRef: EditorialSourceRefDTO;
  /**
   * The computed 1-based chapter number — a DATUM, never authorable (CHAPTER_TITLE_PRESENTATION).
   * Present ONLY on a body `chapter`. The single source the title surface reads; no UI offers it as
   * an editable field (the D8 grammar property M1's C2 judge locks).
   */
  number?: number;
}

export interface EditorialSkeletonDTO {
  objects: EditorialObjectDTO[];
}
