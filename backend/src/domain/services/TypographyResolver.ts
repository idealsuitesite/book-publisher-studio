import type { Content, Block, InlineElement } from '../models/Book';
import type { StyledBook } from '../models/Theme';
import type { ResolvedTypography, TypeRun } from '../models/ResolvedTypography';
import { blockTypographyKey, listItemTypographyKey } from '../../shared/utils/typographyKeys';

function plainRun(text: string): TypeRun {
  return {
    text,
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    superscript: false,
    subscript: false,
    smallCaps: false,
  };
}

function resolveInlineElement(el: InlineElement): TypeRun {
  return {
    text: el.text,
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

function resolveRuns(text: string, inlines: InlineElement[] | undefined): TypeRun[] {
  if (inlines && inlines.length > 0) {
    return inlines.map(resolveInlineElement);
  }
  return [plainRun(text)];
}

export class TypographyResolver {
  resolve(styled: StyledBook): StyledBook {
    const blockTypography: Record<string, ResolvedTypography> = {};

    const walkBlocks = (blocks: Block[]): void => {
      for (const block of blocks) {
        Object.assign(blockTypography, this.resolveBlockTypography(block));
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

  // Resolves Block.inlines (or a plain-text fallback) into TypeRun[]. Most block
  // types own exactly one text stream, keyed by their own block.id
  // (blockTypographyKey). List owns one independent text stream per item
  // (List.inlines?: InlineElement[][], one array per item) - a single block.id
  // key can't represent that without losing item boundaries, so each item gets
  // its own key instead (listItemTypographyKey) - see
  // shared/utils/typographyKeys.ts and docs/architecture/diagrams/TYPOGRAPHY_ENGINE.md
  // for the rationale. Table/image/page-break/divider have no inline text at all.
  // Drop-cap and orphan-risk resolution land in a later commit (design review
  // §4 items 4 and 6).
  private resolveBlockTypography(block: Block): Record<string, ResolvedTypography> {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
      case 'scripture':
        return {
          [blockTypographyKey(block.id)]: {
            runs: resolveRuns(block.text, block.inlines),
            dropCap: false,
            orphanRisk: false,
          },
        };
      case 'footnote':
        return {
          [blockTypographyKey(block.id)]: {
            runs: resolveRuns(block.content, block.inlines),
            dropCap: false,
            orphanRisk: false,
          },
        };
      case 'list': {
        const entries: Record<string, ResolvedTypography> = {};
        block.items.forEach((item, index) => {
          entries[listItemTypographyKey(block.id, index)] = {
            runs: resolveRuns(item, block.inlines?.[index]),
            dropCap: false,
            orphanRisk: false,
          };
        });
        return entries;
      }
      case 'table':
      case 'image':
      case 'page-break':
      case 'divider':
        return { [blockTypographyKey(block.id)]: { runs: [], dropCap: false, orphanRisk: false } };
      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
