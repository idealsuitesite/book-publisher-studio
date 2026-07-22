import type { Content, Block, InlineElement } from '../models/Book';
import type { StyledBook } from '../models/Theme';
import type { ResolvedTypography, TypeRun } from '../models/ResolvedTypography';
import { blockTypographyKey, listItemTypographyKey } from '../../shared/utils/typographyKeys';

export interface TypographyOptions {
  smartQuotes?: boolean; // default true - English-only substitution (design review §4 item 5)
  dropCaps?: boolean; // default true
}

// English-only straight-to-curly quote substitution (design review §4 item 5, DECIDED
// v1 scope). Locale-aware quoting (French, German, etc.) is explicit future work, not
// silently missing - Book.metadata.language already carries the ISO code that would key
// off of later. Applied per-run, not across a whole block's concatenated text, so a
// quote character that opens in one inline run and closes in a later run of the same
// block (e.g. "He said ‘hello and then <bold>goodbye’</bold>") can pick the wrong
// side - an accepted, documented limitation of this heuristic, not a bug to chase down.
function smartenQuotes(text: string): string {
  return text
    .replace(/(^|[\s([{<])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(\w)'(\w)/g, '$1’$2')
    .replace(/(^|[\s([{<])'/g, '$1‘')
    .replace(/'/g, '’');
}

function applyText(text: string, smartQuotes: boolean): string {
  return smartQuotes ? smartenQuotes(text) : text;
}

function plainRun(text: string, smartQuotes: boolean): TypeRun {
  return {
    text: applyText(text, smartQuotes),
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    superscript: false,
    subscript: false,
    smallCaps: false,
  };
}

function resolveInlineElement(el: InlineElement, smartQuotes: boolean): TypeRun {
  return {
    text: applyText(el.text, smartQuotes),
    bold: el.type === 'bold',
    italic: el.type === 'italic',
    underline: el.type === 'underline',
    strikethrough: el.type === 'strikethrough',
    superscript: el.type === 'superscript',
    subscript: el.type === 'subscript',
    smallCaps: el.type === 'small-caps',
    linkUrl: el.type === 'link' ? el.url : undefined,
  };
}

function resolveRuns(text: string, inlines: InlineElement[] | undefined, smartQuotes: boolean): TypeRun[] {
  if (inlines && inlines.length > 0) {
    return inlines.map((el) => resolveInlineElement(el, smartQuotes));
  }
  return [plainRun(text, smartQuotes)];
}

// Quote/Scripture italics as a declared, internal rule (design review §4 item 9,
// DECIDED: TypographyResolver-internal default, not Theme-configurable in v1).
// Replaces three independent per-renderer hardcodes with one rule in one place.
function forceItalic(runs: TypeRun[]): TypeRun[] {
  return runs.map((run) => ({ ...run, italic: true }));
}

export class TypographyResolver {
  resolve(styled: StyledBook, options?: TypographyOptions): StyledBook {
    const smartQuotes = options?.smartQuotes ?? true;
    const dropCaps = options?.dropCaps ?? true;
    const openingIds = dropCaps ? this.chapterOpeningParagraphIds(styled) : new Set<string>();
    const blockTypography: Record<string, ResolvedTypography> = {};

    const walkBlocks = (blocks: Block[]): void => {
      for (const block of blocks) {
        Object.assign(blockTypography, this.resolveBlockTypography(block, smartQuotes, dropCaps, openingIds.has(block.id)));
      }
    };
    const walkContent = (contents: Content[]): void => {
      for (const content of contents) {
        walkBlocks(content.content);
        if (content.type === 'chapter' && content.sections) {
          walkContent(content.sections as unknown as Content[]);
        } else if (content.type === 'section' && content.subsections) {
          walkContent(content.subsections as unknown as Content[]);
        }
      }
    };
    walkContent(styled.book.mainContent);

    return { ...styled, blockTypography };
  }

  /**
   * The theme-declared drop-cap trigger (MINI_DR_DROP_CAPS §6 commit 2): under
   * `scope: 'chapterOpening'`, the id of each chapter's FIRST block — iff that block is a
   * paragraph with real text. Strictly positional (§2/Q1: positional, never inferential); the
   * §5 edge cases are each this one rule's direct consequence, pinned in the resolver's tests:
   *  - a chapter opening with a heading/quote/image has no opening paragraph → nothing fires,
   *    and the rule never slides to a later paragraph (that would ornament mid-flow text);
   *  - an empty chapter — including the blockless part-opener divider — fires nothing;
   *  - text under sections is a SECTION opening, never the chapter's → the rule never descends
   *    (which also covers the untitled section a structure-editing split leaves behind);
   *  - a chapter carved out mid-flow by promoteToChapter DOES fire: the resolver cannot tell
   *    and must not guess that its first paragraph was once mid-flow — the author made it a
   *    chapter, so it opens like one (the correction path is their own undo/merge).
   * The plain `text` field is the emptiness signal, consistent with LayoutEngine's split gate.
   */
  private chapterOpeningParagraphIds(styled: StyledBook): Set<string> {
    const ids = new Set<string>();
    if (styled.theme.presentation?.dropCap?.scope !== 'chapterOpening') return ids;
    for (const content of styled.book.mainContent) {
      if (content.type !== 'chapter') continue;
      const first = content.content[0];
      if (first?.type === 'paragraph' && first.text.trim().length > 0) ids.add(first.id);
    }
    return ids;
  }

  // Resolves Block.inlines (or a plain-text fallback) into TypeRun[], plus drop-cap
  // and block-type-rule resolution. Most block types own exactly one text stream,
  // keyed by their own block.id (blockTypographyKey). List owns one independent text
  // stream per item (List.inlines?: InlineElement[][], one array per item) - a single
  // block.id key can't represent that without losing item boundaries, so each item
  // gets its own key instead (listItemTypographyKey) - see
  // shared/utils/typographyKeys.ts and docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md
  // for the rationale. Table/image/page-break/divider have no inline text at all.
  //
  // staysWithNext: true only for Heading blocks - a heading is always a candidate for
  // being left alone at the bottom of a page while its following content moves to the
  // next one. LayoutEngine (commit 4) does the actual look-ahead/carry-over; this is
  // purely the content-intrinsic signal, computed with no page-layout knowledge.
  private resolveBlockTypography(
    block: Block,
    smartQuotes: boolean,
    dropCaps: boolean,
    isChapterOpening: boolean
  ): Record<string, ResolvedTypography> {
    switch (block.type) {
      case 'heading':
        return {
          [blockTypographyKey(block.id)]: {
            runs: resolveRuns(block.text, block.inlines, smartQuotes),
            dropCap: false,
            staysWithNext: true,
          },
        };
      case 'paragraph':
        return {
          [blockTypographyKey(block.id)]: {
            runs: resolveRuns(block.text, block.inlines, smartQuotes),
            // Union, not exclusion: the deprecated per-block path (Block.dropCap, DECISIONS.md)
            // keeps rendering while it exists; the theme trigger adds openings, never subtracts.
            dropCap: dropCaps && (block.dropCap === true || isChapterOpening),
            staysWithNext: false,
          },
        };
      case 'quote':
      case 'scripture':
        return {
          [blockTypographyKey(block.id)]: {
            runs: forceItalic(resolveRuns(block.text, block.inlines, smartQuotes)),
            dropCap: false,
            staysWithNext: false,
          },
        };
      case 'footnote':
        return {
          [blockTypographyKey(block.id)]: {
            runs: resolveRuns(block.content, block.inlines, smartQuotes),
            dropCap: false,
            staysWithNext: false,
          },
        };
      case 'list': {
        const entries: Record<string, ResolvedTypography> = {};
        block.items.forEach((item, index) => {
          entries[listItemTypographyKey(block.id, index)] = {
            runs: resolveRuns(item, block.inlines?.[index], smartQuotes),
            dropCap: false,
            staysWithNext: false,
          };
        });
        return entries;
      }
      case 'table':
      case 'image':
      case 'page-break':
      case 'divider':
        return { [blockTypographyKey(block.id)]: { runs: [], dropCap: false, staysWithNext: false } };
      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
