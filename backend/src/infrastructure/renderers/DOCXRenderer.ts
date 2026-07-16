import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  type ISectionOptions,
} from 'docx';
import type { Renderer, RenderContext } from '../../domain/ports/Renderer';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { ResolvedBlockStyle } from '../../domain/models/Theme';
import type { Content, Block, Chapter, Section } from '../../domain/models/Book';

const HEADING_LEVEL_BY_NUMBER: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

export class DOCXRenderer implements Renderer<Buffer> {
  async render(book: PaginatedBook, _context: RenderContext): Promise<Buffer> {
    const pageStartBlockIds = new Set(
      book.pages.slice(1).map((page) => page.blocks[0]).filter((id): id is string => Boolean(id))
    );

    const children: (Paragraph | Table)[] = [];
    this.renderContent(book.styledBook.book.mainContent, book.styledBook.blockStyles, pageStartBlockIds, true, children);

    const section: ISectionOptions = { children };
    const doc = new Document({ sections: [section] });

    return Packer.toBuffer(doc);
  }

  private renderContent(
    contents: Content[],
    blockStyles: Record<string, ResolvedBlockStyle>,
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
        out.push(...this.renderBlock(block, blockStyles[block.id], pageStartBlockIds));
      }

      if (content.type === 'chapter' && content.sections) {
        this.renderContent(content.sections, blockStyles, pageStartBlockIds, false, out);
      } else if (content.type === 'section' && content.subsections) {
        this.renderContent(content.subsections, blockStyles, pageStartBlockIds, false, out);
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
    pageStartBlockIds: Set<string>
  ): (Paragraph | Table)[] {
    const pageBreakBefore = pageStartBlockIds.has(block.id);
    const font = style?.fontFamily;
    const size = style ? Math.round(style.fontSize * 2) : undefined; // docx sizes are in half-points
    const color = style?.color?.replace(/^#/, '');
    const spacing = style ? { before: Math.round(style.spaceBefore * 20), after: Math.round(style.spaceAfter * 20) } : undefined;

    switch (block.type) {
      case 'heading':
        return [
          new Paragraph({
            text: block.text,
            heading: HEADING_LEVEL_BY_NUMBER[block.level] ?? HeadingLevel.HEADING_6,
            pageBreakBefore,
          }),
        ];

      case 'paragraph':
        return [
          new Paragraph({
            pageBreakBefore,
            spacing,
            children: [new TextRun({ text: block.text, font, size, color })],
          }),
        ];

      case 'quote':
      case 'scripture':
        return [
          new Paragraph({
            pageBreakBefore,
            spacing,
            indent: { left: 720 },
            children: [new TextRun({ text: block.text, font, size, color, italics: true })],
          }),
        ];

      case 'list':
        // Ordered lists use a manual "N. " prefix rather than docx's numbering-reference
        // machinery (which needs document-level config) - acceptable simplification for now.
        return block.items.map(
          (item, index) =>
            new Paragraph({
              pageBreakBefore: index === 0 ? pageBreakBefore : false,
              children: [new TextRun({ text: block.ordered ? `${index + 1}. ${item}` : item, font, size, color })],
              bullet: block.ordered ? undefined : { level: 0 },
            })
        );

      case 'table': {
        const headerRow = new TableRow({
          children: block.headers.map((header) => new TableCell({ children: [new Paragraph({ text: header })] })),
        });
        const bodyRows = block.rows.map(
          (row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [new Paragraph({ text: cell ?? '' })] })) })
        );
        return [new Table({ rows: [headerRow, ...bodyRows] })];
      }

      case 'footnote':
        return [
          new Paragraph({
            pageBreakBefore,
            children: [new TextRun({ text: `[${block.number}] ${block.content}`, size: (size ?? 22) - 4 })],
          }),
        ];

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
