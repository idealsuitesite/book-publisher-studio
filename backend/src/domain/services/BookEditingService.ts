import type { Book, Content, Section, Chapter, Paragraph, Block, TitlePage, CopyrightPage } from '../models/Book';
import { ContentNotFoundError } from '../../shared/errors/ContentNotFoundError';
import { classifyMarker } from './structureAssist/structureTaxonomy';

/**
 * A partial front-matter edit (MINI_DR_EDIT_FRONT_MATTER §2.2): `undefined` leaves a section
 * untouched, `null` CLEARS it (the Q3-proven vanish stays author-expressible — a book with no
 * copyright page is a legitimate choice), an object replaces it whole. Only the two sections
 * every export actually renders are editable; the typed-but-unrendered fields are not offered.
 */
export interface FrontMatterPatch {
  titlePage?: TitlePage | null;
  copyrightPage?: CopyrightPage | null;
}

/**
 * Manual structure editing — the Domain write path (STRUCTURE_EDITING.md / STRUCTURE_EDITING_PHASE3.md
 * / CREATE_CHAPTER.md).
 *
 * A concrete Domain service (CTO-approved): one correct implementation for this Book model, no port —
 * the same judgment as `ThemeEngine`/`ASTBuilder`, the deliberate OPPOSITE of the `AIProvider` case.
 * Every operation is a PURE function: the input `Book` is never mutated, a new `Book` is returned
 * (ADR-0001 immutability).
 *
 * Ops: the *organize* half — reorder top-level chapters, rename any chapter/section — and the *create*
 * half (`CREATE_CHAPTER.md`, scope LOCKED to these two): promote a paragraph to a chapter, and its
 * exact inverse, merge a chapter back into the previous container.
 */
export class BookEditingService {
  // An id generator so create ops can mint stable ids; injectable for deterministic tests (the
  // ProjectService precedent). Defaulted so `new BookEditingService()` keeps working everywhere.
  constructor(private readonly idGenerator: () => string = defaultIdGenerator) {}

  /**
   * Move a top-level chapter/section from `fromIndex` to `toIndex`, renumbering chapters to match
   * the new reading order. Returns a new Book; the original is untouched.
   */
  reorderChapters(book: Book, fromIndex: number, toIndex: number, now: Date = new Date()): Book {
    const n = book.mainContent.length;
    if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n) {
      throw new ContentNotFoundError(`reorderChapters: index out of range (from=${fromIndex}, to=${toIndex}, length=${n})`);
    }

    const reordered = [...book.mainContent];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    return { ...book, mainContent: this.renumberChapters(reordered, now) };
  }

  /**
   * Rename any chapter or section (found by id, at any depth) to `newTitle`. Returns a new Book;
   * the original is untouched. Throws `ContentNotFoundError` if no node has the id.
   */
  rename(book: Book, id: string, newTitle: string, now: Date = new Date()): Book {
    let found = false;

    const renameIn = (contents: Content[]): Content[] =>
      contents.map((content): Content => {
        if (content.id === id) {
          found = true;
          return { ...content, title: newTitle, updatedAt: now };
        }
        if (content.type === 'chapter' && content.sections) {
          return { ...content, sections: renameIn(content.sections) as Section[] };
        }
        if (content.type === 'section' && content.subsections) {
          return { ...content, subsections: renameIn(content.subsections) as Section[] };
        }
        return content;
      });

    const mainContent = renameIn(book.mainContent);
    if (!found) {
      throw new ContentNotFoundError(`rename: no chapter or section with id "${id}"`);
    }
    return { ...book, mainContent };
  }

  /**
   * Set (or clear) the editorial placement role of a TOP-LEVEL part (MINI_DR_EDITORIAL_PLACEMENT §2b):
   * 'front' exports it before the chapters, 'back' after them, 'main' clears the tag (ordinary
   * content). Only top-level parts carry a role — a nested section is ordinary content, so the id must
   * name a `mainContent` entry. Returns a new Book; the original is untouched. Throws
   * `ContentNotFoundError` if no top-level part has the id. This is the Option-C author action — the
   * ONLY way a role is ever set; nothing infers it into the export.
   */
  setPartRole(book: Book, id: string, role: 'front' | 'back' | 'main', now: Date = new Date()): Book {
    let found = false;
    const mainContent = book.mainContent.map((content): Content => {
      if (content.id !== id) return content;
      found = true;
      const updated: Content = { ...content, updatedAt: now };
      if (role === 'main') delete updated.role;
      else updated.role = role;
      return updated;
    });
    if (!found) {
      throw new ContentNotFoundError(`setPartRole: no top-level part with id "${id}"`);
    }
    return { ...book, mainContent };
  }

  /**
   * Mark (or unmark) a paragraph as a callout — the author's gesture, the producer that ships
   * WITH the callout capability (MINI_DR_CALLOUTS commit 1; the C1-trap exit, CALLOUTS_SCOPE §3).
   * By id, at ANY depth (the `rename` walk); paragraphs only — the v1 boundary (quotes/lists/
   * headings excluded by design, and quote presentation stays behind C1's freeze). A no-op
   * toggle (marking the marked, unmarking the unmarked) is rejected rather than snapshotted —
   * a mutation that changes nothing is a malformed request, not a version event (the
   * front-matter lesson). Returns a new Book; the original is untouched.
   */
  // No `now` parameter and no book-level updatedAt bump ON PURPOSE, matching every other op
  // here (rename/setPartRole/…): paragraphs carry no timestamp, the project's own updatedAt
  // moves at save time, and bumping the BOOK would break the legitimate-HIT property — an
  // unmark must restore byte-identical pre-mark content (the §3.6 honesty; caught by the
  // pagination-cache instrument the moment the first draft bumped it).
  setCallout(book: Book, blockId: string, on: boolean): Book {
    let found = false;

    const applyIn = (blocks: Block[]): Block[] =>
      blocks.map((block): Block => {
        if (block.id !== blockId || block.type !== 'paragraph') return block;
        found = true;
        if (on === (block.callout === true)) {
          throw new ContentNotFoundError(
            `setCallout: paragraph "${blockId}" is already ${on ? 'marked' : 'unmarked'} — nothing to change`
          );
        }
        if (!on) {
          const cleared = { ...block };
          delete cleared.callout; // property removed, not set to undefined — round-trip stays exact identity
          return cleared;
        }
        return { ...block, callout: true };
      });

    const walk = (contents: Content[]): Content[] =>
      contents.map((content): Content => {
        const withBlocks = { ...content, content: applyIn(content.content) };
        if (withBlocks.type === 'chapter' && withBlocks.sections) {
          return { ...withBlocks, sections: walk(withBlocks.sections) as Section[] };
        }
        if (withBlocks.type === 'section' && withBlocks.subsections) {
          return { ...withBlocks, subsections: walk(withBlocks.subsections) as Section[] };
        }
        return withBlocks;
      });

    const mainContent = walk(book.mainContent);
    if (!found) {
      throw new ContentNotFoundError(`setCallout: no paragraph with id "${blockId}"`);
    }
    return { ...book, mainContent };
  }

  /**
   * Move a paragraph's text into its top-level chapter's `subtitle` field — the gesture that
   * makes a subtitle-stored-as-paragraph become what it claims to be (MINI_DR_SUBTITLE_FIELD
   * commit 1; retires THIRD_THEME_NOVEL §6's consigned limitation by position alone: once the
   * line leaves content[0], the drop-cap trigger lands on the prose with no trigger change).
   *
   * V1 boundary (disclosed): paragraphs directly in a TOP-LEVEL chapter only — Sections carry
   * no subtitle field. Rejects when the chapter already has a subtitle (CTO decision 5: the
   * author clears first, explicitly — no hidden compound op; this throw is defense-in-depth
   * behind the disabled affordance, surfaced as a named code at the route, never a 500).
   * Plain text moves; inline formatting is lost and does NOT return at clear (disclosure 1,
   * both directions — the promoteToChapter precedent). No book-level updatedAt bump (the
   * convention the callout instrument enforced).
   */
  markAsSubtitle(book: Book, blockId: string): Book {
    let found = false;
    const mainContent = book.mainContent.map((content): Content => {
      if (content.type !== 'chapter') return content;
      const index = content.content.findIndex((b) => b.id === blockId && b.type === 'paragraph');
      if (index === -1) return content;
      found = true;
      const block = content.content[index] as Paragraph;
      if (!block.text.trim()) {
        throw new ContentNotFoundError(`markAsSubtitle: paragraph "${blockId}" has no text to make a subtitle of`);
      }
      if (content.subtitle) {
        throw new ContentNotFoundError(
          `markAsSubtitle: chapter "${content.id}" already has a subtitle — clear it first (no hidden replace)`
        );
      }
      return { ...content, subtitle: block.text, content: content.content.filter((_, i) => i !== index) };
    });
    if (!found) {
      throw new ContentNotFoundError(`markAsSubtitle: no paragraph with id "${blockId}" directly in a top-level chapter`);
    }
    return { ...book, mainContent };
  }

  /**
   * The inverse: the subtitle text returns as the chapter's FIRST paragraph (a freshly minted
   * id — a content-hash cache therefore re-paginates once, the conservative correct MISS the
   * review's §3 pins) and the field is removed. Round trip is PLAIN-TEXT identity.
   */
  clearSubtitle(book: Book, chapterId: string): Book {
    let found = false;
    const mainContent = book.mainContent.map((content): Content => {
      if (content.type !== 'chapter' || content.id !== chapterId) return content;
      found = true;
      if (!content.subtitle) {
        throw new ContentNotFoundError(`clearSubtitle: chapter "${chapterId}" has no subtitle to clear`);
      }
      const restored: Paragraph = { type: 'paragraph', id: this.idGenerator(), text: content.subtitle };
      const cleared = { ...content, content: [restored, ...content.content] };
      delete cleared.subtitle; // property removed, not set to undefined
      return cleared;
    });
    if (!found) {
      throw new ContentNotFoundError(`clearSubtitle: no top-level chapter with id "${chapterId}"`);
    }
    return { ...book, mainContent };
  }

  /**
   * Promote a paragraph/heading block (in a TOP-LEVEL container) to a new chapter, splitting that
   * container at the block: blocks before stay, the block's text becomes the new chapter's title,
   * blocks after become its content. Chapters renumber. The one op that lets an author carve
   * chapters out of an unstructured manuscript (CREATE_CHAPTER.md; scope LOCKED to top-level
   * containers — nested-subsection blocks are out of round 1).
   *
   * §9.3 (CTO): an *untitled* section left empty by the split is dropped (no phantom section); a
   * titled container (a chapter, or a titled section) is kept even if now empty — it has a title
   * worth preserving.
   */
  promoteToChapter(book: Book, blockId: string, now: Date = new Date()): Book {
    const containerIndex = book.mainContent.findIndex((c) =>
      c.content.some((b) => b.id === blockId && (b.type === 'paragraph' || b.type === 'heading'))
    );
    if (containerIndex === -1) {
      throw new ContentNotFoundError(`promoteToChapter: no promotable text block with id "${blockId}" in a top-level container`);
    }
    const container = book.mainContent[containerIndex];
    const blockIndex = container.content.findIndex((b) => b.id === blockId);
    const block = container.content[blockIndex];
    // Narrows to a text-bearing block; the findIndex above already guaranteed it.
    if (block.type !== 'paragraph' && block.type !== 'heading') {
      throw new ContentNotFoundError(`promoteToChapter: block "${blockId}" is not a text block`);
    }

    const newChapter: Chapter = {
      type: 'chapter',
      id: this.idGenerator(),
      number: 0, // renumbered below
      title: block.text,
      content: container.content.slice(blockIndex + 1),
      createdAt: now,
      updatedAt: now,
    };

    const remainder: Content = { ...container, content: container.content.slice(0, blockIndex), updatedAt: now };
    const keepRemainder = !(remainder.type === 'section' && remainder.title.trim() === '' && remainder.content.length === 0);

    const rebuilt: Content[] = [
      ...book.mainContent.slice(0, containerIndex),
      ...(keepRemainder ? [remainder] : []),
      newChapter,
      ...book.mainContent.slice(containerIndex + 1),
    ];
    return { ...book, mainContent: this.renumberChapters(rebuilt, now) };
  }

  /**
   * The exact inverse of `promoteToChapter`: turn a top-level chapter's title back into a paragraph
   * and merge its content into the immediately-preceding container. Chapters renumber.
   *
   * §9.1 (CTO): the first chapter has no previous container — disallowed (throws); version-undo is
   * the clean exit, not a new model path for a rare case. Inline formatting a promoted block may
   * have carried is not restored (a chapter title is plain text) — disclosed in CREATE_CHAPTER.md.
   */
  mergeChapterIntoPrevious(book: Book, chapterId: string, now: Date = new Date()): Book {
    const index = book.mainContent.findIndex((c) => c.type === 'chapter' && c.id === chapterId);
    if (index === -1) {
      throw new ContentNotFoundError(`mergeChapterIntoPrevious: no top-level chapter with id "${chapterId}"`);
    }
    if (index === 0) {
      throw new ContentNotFoundError(`mergeChapterIntoPrevious: chapter "${chapterId}" is first; nothing to merge into`);
    }
    const chapter = book.mainContent[index] as Chapter;
    const prev = book.mainContent[index - 1];
    // A part opener is not a merge target (PART_LEVEL_STRUCTURE): pouring blocks into a divider
    // would silently un-divider it (ownsBarePage requires blocklessness). Reachable only by
    // reordering a chapter to sit directly after an opener; the author removes the opener first.
    if (prev.type === 'chapter' && prev.partOpener) {
      throw new ContentNotFoundError(
        `mergeChapterIntoPrevious: chapter "${chapterId}" follows a part divider; remove the divider first`
      );
    }
    const titleBlock: Paragraph = { type: 'paragraph', id: this.idGenerator(), text: chapter.title };

    const mergedPrev: Content = {
      ...prev,
      content: [...prev.content, titleBlock, ...chapter.content],
      updatedAt: now,
    };

    const rebuilt: Content[] = [
      ...book.mainContent.slice(0, index - 1),
      mergedPrev,
      ...book.mainContent.slice(index + 1),
    ];
    return { ...book, mainContent: this.renumberChapters(rebuilt, now) };
  }

  /**
   * STRUCTURE_CLEANUP (STRUCTURE_CLEANUP_DR.md §6.2) — collapse an empty MARKER heading the author
   * styled as its own `Heading 1` (`CHAPTER n`, `INTRODUCTION`) into the real chapter that follows
   * it. The over-structured author's one-gesture repair (the 29→1 of that chantier).
   *
   * It is a REMOVAL, not a merge — the marker is empty (0 blocks, 0 sections), so nothing merges
   * INTO anything; removing it lets the following chapter flow up and auto-number. This is the
   * anti-defect of the cadrage's Constat 3: `mergeChapterIntoPrevious` kept the marker's title and
   * dropped the follower's `.sections` (it concatenates `.content` only) — a mass content loss
   * (ADR-0050). `collapseMarker` never READS the follower's sections, so they survive by construction
   * (pinned by the section-survival test, born with this op).
   *
   * STRICT typed guard (D2): only an EMPTY marker collapses — 0 content blocks AND 0 sections, a
   * recognised marker title, NOT a part divider, with a real (non-marker) title immediately after.
   * Every other case throws `ContentNotFoundError` (the route maps it to the named CONTENT_NOT_FOUND,
   * never a 500) — tested both ways.
   *
   * A1 numbered (`CHAPTER n`): remove the marker; `renumberChapters` gives the follower its number.
   * A2 editorial (`INTRODUCTION`/`CONCLUSION`, D3, CTO subtitle variant): the follower INHERITS the
   * editorial identity — its title becomes the canonical label (`Introduction`) so the existing
   * title-based machinery (`classifyEditorialTitle`, bookFacts count + Proof panel) recognises it,
   * and its own descriptive title SURVIVES as the `subtitle` (no authored title destroyed, ADR-0050;
   * reuses `Chapter.subtitle`, shipped MINI_DR_SUBTITLE_FIELD). Placement is NOT auto-set — role stays
   * the author's own `setPartRole` gesture (MINI_DR_EDITORIAL_PLACEMENT: never auto-inferred).
   */
  collapseMarker(book: Book, markerId: string, now: Date = new Date()): Book {
    const index = book.mainContent.findIndex((c) => c.type === 'chapter' && c.id === markerId);
    if (index === -1) {
      throw new ContentNotFoundError(`collapseMarker: no top-level chapter with id "${markerId}"`);
    }
    const marker = book.mainContent[index] as Chapter;
    if (marker.partOpener) {
      throw new ContentNotFoundError(`collapseMarker: "${markerId}" is a part divider — use removePartOpener`);
    }
    // The strict guard: an empty marker is 0 content blocks AND 0 sections. Anything with content or
    // sections is not a marker to collapse — refuse rather than risk losing it (the Constat-3 defect).
    if (marker.content.length > 0 || (marker.sections?.length ?? 0) > 0) {
      throw new ContentNotFoundError(
        `collapseMarker: chapter "${markerId}" is not an empty marker (it has content or sections) — nothing to collapse`
      );
    }
    const kind = classifyMarker(marker.title);
    if (!kind) {
      throw new ContentNotFoundError(`collapseMarker: "${marker.title}" is not a recognised marker`);
    }
    const target = book.mainContent[index + 1];
    if (!target || classifyMarker(target.title)) {
      throw new ContentNotFoundError(
        `collapseMarker: no real title follows the marker "${marker.title}" — nothing to collapse into`
      );
    }

    // A2: the follower inherits the editorial identity, keeping its descriptive title as the subtitle
    // (only if it has none already — an existing subtitle is never overwritten). `...target` preserves
    // its content AND sections untouched — the section-survival guarantee.
    let mainContent = book.mainContent;
    if (kind.kind === 'editorial' && target.type === 'chapter') {
      const editorialTarget: Chapter = {
        ...target,
        title: kind.label,
        subtitle: target.subtitle ?? target.title,
        updatedAt: now,
      };
      mainContent = [...book.mainContent.slice(0, index + 1), editorialTarget, ...book.mainContent.slice(index + 2)];
    }

    // Remove the empty marker and renumber — the proven removePartOpener mechanism, generalized.
    return this.removeTopLevelAt({ ...book, mainContent }, index, now);
  }

  /**
   * Remove the top-level entry at `index` and renumber — the shared removal mechanism behind
   * `removePartOpener` (a divider) and `collapseMarker` (an empty marker). The followers flow up by
   * position; `renumberChapters` reassigns chapter numbers. Each caller owns its OWN strict guard on
   * WHAT may be removed — this helper only performs the splice, never decides eligibility.
   */
  private removeTopLevelAt(book: Book, index: number, now: Date): Book {
    const rebuilt: Content[] = [...book.mainContent.slice(0, index), ...book.mainContent.slice(index + 1)];
    return { ...book, mainContent: this.renumberChapters(rebuilt, now) };
  }

  /**
   * Insert a PART OPENER (Part I / Part II divider, PART_LEVEL_STRUCTURE §3.4) at `index` in
   * `mainContent` (0..length). A titled, blockless chapter flagged `partOpener: true` — its page
   * is the divider; the chapters "in" the part are those that follow it, by position. Continuous
   * numbering is untouched by construction (`renumberChapters` skips openers — the CTO-locked
   * rule). Returns a new Book; throws on an empty title or an out-of-range index.
   */
  insertPartOpener(book: Book, index: number, title: string, now: Date = new Date()): Book {
    const trimmed = title.trim();
    if (!trimmed) throw new Error('Part title cannot be empty');
    if (index < 0 || index > book.mainContent.length) {
      throw new ContentNotFoundError(`insertPartOpener: index out of range (index=${index}, length=${book.mainContent.length})`);
    }
    const opener: Chapter = {
      type: 'chapter',
      id: this.idGenerator(),
      number: 0, // openers never consume a chapter number; 0 is inert (never displayed, never renumbered)
      title: trimmed,
      content: [],
      partOpener: true,
      createdAt: now,
      updatedAt: now,
    };
    const rebuilt: Content[] = [...book.mainContent.slice(0, index), opener, ...book.mainContent.slice(index)];
    return { ...book, mainContent: this.renumberChapters(rebuilt, now) };
  }

  /**
   * Remove a part opener by id. Only an entry flagged `partOpener` may be removed this way — a
   * real chapter is never deletable through this op (its content would vanish; openers carry
   * none). The chapters that followed simply flow to the previous part — positional grouping
   * makes removal non-destructive. Undo (version restore) covers regret, as everywhere else.
   */
  removePartOpener(book: Book, id: string, now: Date = new Date()): Book {
    const index = book.mainContent.findIndex((c) => c.type === 'chapter' && c.partOpener === true && c.id === id);
    if (index === -1) {
      throw new ContentNotFoundError(`removePartOpener: no part opener with id "${id}"`);
    }
    // The strict guard (opener-only) is above; the splice+renumber is the shared mechanism.
    return this.removeTopLevelAt(book, index, now);
  }

  /**
   * Edit the stored front matter — the Phase 3b slice (MINI_DR_EDIT_FRONT_MATTER). Q3 made front
   * matter user content rendered from storage; this is the edit path it never had. Validation
   * mirrors `FrontMatterBuilder`'s own "a blank sheet is worse than none" rule: a provided title
   * page needs a title AND an author, a provided copyright page needs its text — throw, and the
   * route maps it to 400 (the `rename` empty-title precedent). Optional fields are trimmed and
   * normalised to undefined so a cleared input never ships as an authored-looking empty line.
   */
  editFrontMatter(book: Book, patch: FrontMatterPatch, now: Date = new Date()): Book {
    const frontMatter = { ...book.frontMatter };
    // FOUNDER_TRAVERSAL defect 4: the title the author edits and the title the Proof prints are
    // ONE title. Editing the title-page title writes the canonical `book.metadata.title` in
    // lock-step, so the author never has to discover that "the book title" and "the title page"
    // were separate fields. (The project NAME stays deliberately distinct — a working label, not
    // the published title; the deeper "what is a title, to an author" question is Lot 3.)
    let metadata = book.metadata;

    if (patch.titlePage !== undefined) {
      if (patch.titlePage === null) {
        // Removing the title PAGE never erases the book's own title — the canonical stays.
        delete frontMatter.titlePage;
      } else {
        const title = patch.titlePage.title.trim();
        const author = patch.titlePage.author?.trim();
        if (!title || !author) throw new Error('Title page requires a title and an author');
        frontMatter.titlePage = {
          title,
          author,
          subtitle: patch.titlePage.subtitle?.trim() || undefined,
          tagline: patch.titlePage.tagline?.trim() || undefined,
        };
        metadata = { ...metadata, title };
      }
    }

    if (patch.copyrightPage !== undefined) {
      if (patch.copyrightPage === null) {
        delete frontMatter.copyrightPage;
      } else {
        const text = patch.copyrightPage.text.trim();
        if (!text) throw new Error('Copyright page requires its copyright text');
        frontMatter.copyrightPage = {
          text,
          isbn: patch.copyrightPage.isbn?.trim() || undefined,
          copyrightText: patch.copyrightPage.copyrightText?.trim() || undefined,
          legalNotice: patch.copyrightPage.legalNotice?.trim() || undefined,
          printingInfo: patch.copyrightPage.printingInfo?.trim() || undefined,
        };
      }
    }

    return { ...book, metadata, frontMatter, updatedAt: now };
  }

  /** Renumber top-level chapters 1..N in reading order; a chapter whose number changed advances its
   * updatedAt. Sections carry through untouched, and so do PART OPENERS (PART_LEVEL_STRUCTURE:
   * a divider consumes no chapter number — "Chapter 5" stays "Chapter 5" whatever part it is in).
   * Shared by every op that changes chapter order/count. */
  private renumberChapters(contents: Content[], now: Date): Content[] {
    let chapterNumber = 0;
    return contents.map((content): Content => {
      if (content.type !== 'chapter' || content.partOpener) return content;
      chapterNumber += 1;
      if (content.number === chapterNumber) return content;
      return { ...content, number: chapterNumber, updatedAt: now };
    });
  }
}

function defaultIdGenerator(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
