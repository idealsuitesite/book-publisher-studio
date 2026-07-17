import {
  Document,
  Paragraph,
  TextRun,
  ExternalHyperlink,
  Packer,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  type ISectionOptions,
  type IStylesOptions,
  type ParagraphChild,
} from 'docx';
import type { Renderer, RenderContext } from '../../domain/ports/Renderer';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { ResolvedBlockStyle, Theme } from '../../domain/models/Theme';
import type { ResolvedTypography, TypeRun } from '../../domain/models/ResolvedTypography';
import type { Content, Block, Chapter, Section } from '../../domain/models/Book';
import { listItemTypographyKey } from '../../shared/utils/typographyKeys';
import { runsOrPlainFallback } from '../../shared/utils/typographyRuns';

const HEADING_LEVEL_BY_NUMBER: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

// Same v1 drop-cap approximation as PDFRenderer (enlarged first character, no real
// line-aware text wrap-around) - documented simplification, not a silent gap.
const DROP_CAP_SCALE = 2.5;

// docx's `heading: HeadingLevel.HEADING_N` shorthand (used below, both here and in
// renderTitle) applies Word's own default "Heading N" style, which has its own fixed
// size unrelated to our theme - this is what let this renderer ignore theme.fontSizes
// entirely (design review §4 item 3, §2 evidence table). Overriding the *default* style
// definitions at the Document level (rather than styling every heading paragraph
// individually) keeps the semantic HeadingLevel tagging Word's outline/TOC needs while
// making the visible size/font/color theme-driven - resolves both Heading blocks and
// Chapter/Section titles (renderTitle) at once, since both just reference these same
// style IDs.
function buildHeadingStyles(theme: Theme): IStylesOptions['default'] {
  const color = theme.colors.text.replace(/^#/, '');
  const styleFor = (sizeKey: keyof Theme['fontSizes']) => ({
    run: { font: theme.fonts.heading, size: Math.round(theme.fontSizes[sizeKey] * 2), bold: true, color },
    paragraph: {
      spacing: { before: Math.round(theme.spacing.headingSpacing * 20), after: Math.round(theme.spacing.headingSpacing * 20) },
    },
  });
  return {
    heading1: styleFor('h1'),
    heading2: styleFor('h2'),
    heading3: styleFor('h3'),
    heading4: styleFor('h4'),
    heading5: styleFor('h5'),
    heading6: styleFor('h6'),
  };
}

// Renders a resolved TypeRun[] into docx ParagraphChild[] (TextRun, or ExternalHyperlink
// wrapping a TextRun when the run carries a link). docx natively supports every TypeRun
// flag directly (bold/italics/underline/strike/smallCaps/superScript/subScript) - unlike
// PDFKit, nothing here needs a documented gap.
function buildRuns(
  runs: TypeRun[],
  font: string | undefined,
  size: number | undefined,
  color: string | undefined,
  forceBold = false
): ParagraphChild[] {
  return runs.map((run) => {
    const textRun = new TextRun({
      text: run.text,
      font,
      size,
      color,
      bold: forceBold || run.bold,
      italics: run.italic,
      underline: run.underline ? {} : undefined,
      strike: run.strikethrough || undefined,
      smallCaps: run.smallCaps || undefined,
      superScript: run.superscript || undefined,
      subScript: run.subscript || undefined,
    });
    return run.linkUrl ? new ExternalHyperlink({ children: [textRun], link: run.linkUrl }) : textRun;
  });
}

function buildRunsWithPrefix(
  prefix: string,
  runs: TypeRun[],
  font: string | undefined,
  size: number | undefined,
  color: string | undefined
): ParagraphChild[] {
  return [new TextRun({ text: prefix, font, size, color }), ...buildRuns(runs, font, size, color)];
}

// Drop-cap v1 approximation (see DROP_CAP_SCALE above): splits the first character off
// the paragraph's very first run and renders it as its own larger, bold TextRun before
// the rest of the paragraph's runs render normally.
function buildRunsWithDropCap(
  runs: TypeRun[],
  font: string | undefined,
  size: number | undefined,
  color: string | undefined
): ParagraphChild[] {
  const [firstRun, ...restRuns] = runs;
  if (!firstRun || firstRun.text.length === 0) return buildRuns(runs, font, size, color);

  const dropCapChar = firstRun.text[0];
  const remainderOfFirstRun = firstRun.text.slice(1);
  const remainingRuns: TypeRun[] = remainderOfFirstRun ? [{ ...firstRun, text: remainderOfFirstRun }, ...restRuns] : restRuns;

  const dropCapRun = new TextRun({
    text: dropCapChar,
    font,
    size: size ? Math.round(size * DROP_CAP_SCALE) : undefined,
    bold: true,
    italics: firstRun.italic,
  });
  return [dropCapRun, ...buildRuns(remainingRuns, font, size, color)];
}

export class DOCXRenderer implements Renderer<Buffer> {
  async render(book: PaginatedBook, _context: RenderContext): Promise<Buffer> {
    const pageStartBlockIds = new Set(
      book.pages.slice(1).map((page) => page.blocks[0]).filter((id): id is string => Boolean(id))
    );

    const children: (Paragraph | Table)[] = [];
    this.renderContent(
      book.styledBook.book.mainContent,
      book.styledBook.blockStyles,
      book.styledBook.blockTypography,
      pageStartBlockIds,
      true,
      children
    );

    const section: ISectionOptions = { children };
    const doc = new Document({
      styles: { default: buildHeadingStyles(book.styledBook.theme) },
      sections: [section],
    });

    return Packer.toBuffer(doc);
  }

  private renderContent(
    contents: Content[],
    blockStyles: Record<string, ResolvedBlockStyle>,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    pageStartBlockIds: Set<string>,
    isTopLevel: boolean,
    out: (Paragraph | Table)[]
  ): void {
    for (const content of contents) {
      const firstBlockId = content.content[0]?.id;
      const breaksPage = isTopLevel && content.type === 'chapter' && firstBlockId !== undefined && pageStartBlockIds.has(firstBlockId);
      if (breaksPage && firstBlockId) pageStartBlockIds.delete(firstBlockId);

      out.push(this.renderTitle(content, breaksPage));

      for (const block of content.content) {
        out.push(...this.renderBlock(block, blockStyles[block.id], blockTypography, pageStartBlockIds));
      }

      if (content.type === 'chapter' && content.sections) {
        this.renderContent(content.sections, blockStyles, blockTypography, pageStartBlockIds, false, out);
      } else if (content.type === 'section' && content.subsections) {
        this.renderContent(content.subsections, blockStyles, blockTypography, pageStartBlockIds, false, out);
      }
    }
  }

  private renderTitle(content: Chapter | Section, pageBreakBefore: boolean): Paragraph {
    if (content.type === 'chapter') {
      return new Paragraph({
        text: content.title,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore,
      });
    }
    return new Paragraph({
      text: content.title,
      heading: HEADING_LEVEL_BY_NUMBER[content.level] ?? HeadingLevel.HEADING_6,
      pageBreakBefore,
    });
  }

  private renderBlock(
    block: Block,
    style: ResolvedBlockStyle | undefined,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    pageStartBlockIds: Set<string>
  ): (Paragraph | Table)[] {
    const pageBreakBefore = pageStartBlockIds.has(block.id);
    const font = style?.fontFamily;
    const size = style ? Math.round(style.fontSize * 2) : undefined; // docx sizes are in half-points
    const color = style?.color?.replace(/^#/, '');
    const spacing = style ? { before: Math.round(style.spaceBefore * 20), after: Math.round(style.spaceAfter * 20) } : undefined;

    switch (block.type) {
      case 'heading': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        // Headings are always bold (matches the style default set in buildHeadingStyles,
        // and PDFRenderer's equivalent choice) - each run's own italic flag (inline
        // emphasis within the heading) is still respected. Size/font/color are inherited
        // from the theme-driven heading style (design review §4 item 3), not set here.
        return [
          new Paragraph({
            heading: HEADING_LEVEL_BY_NUMBER[block.level] ?? HeadingLevel.HEADING_6,
            pageBreakBefore,
            children: buildRuns(runs, undefined, undefined, undefined, true),
          }),
        ];
      }

      case 'paragraph': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        const dropCap = blockTypography?.[block.id]?.dropCap ?? false;
        const alignment = block.align === 'justify' ? 'both' : block.align;
        return [
          new Paragraph({
            pageBreakBefore,
            spacing,
            alignment,
            children: dropCap ? buildRunsWithDropCap(runs, font, size, color) : buildRuns(runs, font, size, color),
          }),
        ];
      }

      case 'quote':
      case 'scripture': {
        // Italics are already forced onto every run by TypographyResolver
        // (design review §4 item 9) - no block-level italic override needed here anymore.
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        return [
          new Paragraph({
            pageBreakBefore,
            spacing,
            indent: { left: 720 },
            children: buildRuns(runs, font, size, color),
          }),
        ];
      }

      case 'list':
        // Ordered lists use a manual "N. " prefix rather than docx's numbering-reference
        // machinery (which needs document-level config) - acceptable simplification for now.
        return block.items.map((item, index) => {
          const itemRuns = runsOrPlainFallback(blockTypography?.[listItemTypographyKey(block.id, index)], item);
          const prefix = block.ordered ? `${index + 1}. ` : '';
          return new Paragraph({
            pageBreakBefore: index === 0 ? pageBreakBefore : false,
            children: buildRunsWithPrefix(prefix, itemRuns, font, size, color),
            bullet: block.ordered ? undefined : { level: 0 },
          });
        });

      case 'table': {
        const headerRow = new TableRow({
          children: block.headers.map((header) => new TableCell({ children: [new Paragraph({ text: header })] })),
        });
        const bodyRows = block.rows.map(
          (row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph({ text: cell ?? '' })] })) })
        );
        return [new Table({ rows: [headerRow, ...bodyRows] })];
      }

      case 'footnote': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.content);
        const footnoteSize = (size ?? 22) - 4;
        return [
          new Paragraph({
            pageBreakBefore,
            children: buildRunsWithPrefix(`[${block.number}] `, runs, font, footnoteSize, color),
          }),
        ];
      }

      case 'image':
        if (block.base64) {
          return [
            new Paragraph({
              pageBreakBefore,
              children: [
                new ImageRun({
                  data: Buffer.from(block.base64, 'base64'),
                  transformation: { width: block.width ?? 300, height: block.height ?? 200 },
                  type: 'png',
                }),
              ],
            }),
          ];
        }
        // No embedded data - rendering never fetches remote URLs at render time (no hidden
        // network I/O in a renderer). Falls back to a text placeholder.
        return [new Paragraph({ pageBreakBefore, text: `[Image: ${block.caption ?? block.url}]` })];

      case 'page-break':
        return [new Paragraph({ pageBreakBefore: true, text: '' })];

      case 'divider':
        return [new Paragraph({ pageBreakBefore, text: '* * *', alignment: 'center' })];

      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
}
