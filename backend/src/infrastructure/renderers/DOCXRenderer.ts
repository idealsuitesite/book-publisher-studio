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
  Header,
  Footer,
  PageNumber,
  AlignmentType,
  PageBreak,
  BorderStyle,
  ShadingType,
  type ISectionOptions,
  type IStylesOptions,
  type ParagraphChild,
} from 'docx';
import { probeImageDimensions } from '../../shared/utils/imageDimensions';
import { renderedImageSize } from '../../domain/services/renderedImageSize';
import type { Renderer, RenderContext, RenderResult } from '../../domain/ports/Renderer';
import type { PaginatedBook, Page } from '../../domain/models/PaginatedBook';
import type { ResolvedBlockStyle, Theme } from '../../domain/models/Theme';
import type { ResolvedTypography, TypeRun } from '../../domain/models/ResolvedTypography';
import type { Content, Block, Chapter, Section, TOCEntry, FrontMatter } from '../../domain/models/Book';
import { listItemTypographyKey } from '../../shared/utils/typographyKeys';
import { runsOrPlainFallback } from '../../shared/utils/typographyRuns';
import { dropCapLetterSizePt, dropCapScaleOf } from '../../domain/services/dropCapMetrics';
import { CALLOUT_GAP_PT, CALLOUT_RULE_PT, calloutRuleColorOf, calloutTintOf } from '../../domain/services/calloutMetrics';
import { CHAPTER_SUBTITLE_RATIO } from '../../domain/services/titleMetrics';
import type { TextMeasurer } from '../../domain/ports/TextMeasurer';
import { withNativeDropCapFrame } from './docxDropCapFrame';

const HEADING_LEVEL_BY_NUMBER: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

// The drop-cap scale is shared with the model and PDFRenderer (domain/services/dropCapMetrics):
// it used to be an identical private constant here, which the pagination model could not see.
// DOCX's own strategy stays what it was - Word grows the line box, so nothing is hidden here
// (confirmed in Word 16.0: same 61 lines and 397 words, 3 -> 4 pages).

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
  // Phase 3 capability 1: accent, not text — and because these are Word's *default* Heading-N
  // style definitions, this single line colours both Heading blocks and Chapter/Section titles
  // (renderTitle), exactly as the comment above already describes. No signature change needed.
  const color = theme.colors.accent.replace(/^#/, '');
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

// The REAL Word `Subtitle` paragraph style (MINI_DR_SUBTITLE_FIELD §4): italic, the shared
// ratio of the theme's h1, the accent — declared in styles.xml so gestured chapters carry
// Word's own convention. One universal treatment; the ratio comes from the ONE domain module
// the pagination model also reads (titleMetrics).
function buildSubtitleStyle(theme: Theme): NonNullable<IStylesOptions['paragraphStyles']> {
  return [
    {
      id: 'Subtitle',
      name: 'Subtitle',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        font: theme.fonts.heading,
        size: Math.round(theme.fontSizes.h1 * CHAPTER_SUBTITLE_RATIO * 2),
        italics: true,
        color: theme.colors.accent.replace(/^#/, ''),
      },
    },
  ];
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

// Drop-cap inline approximation (the documented measurer-less degradation): splits the first
// character off the paragraph's very first run and renders it as its own larger, bold TextRun
// before the rest of the paragraph's runs render normally. `scale` is the theme-declared value
// (dropCapScaleOf — §6 commit 2), so even the degraded letter honours the theme's knob.
function buildRunsWithDropCap(
  runs: TypeRun[],
  font: string | undefined,
  size: number | undefined,
  color: string | undefined,
  scale: number
): ParagraphChild[] {
  const [firstRun, ...restRuns] = runs;
  if (!firstRun || firstRun.text.length === 0) return buildRuns(runs, font, size, color);

  const dropCapChar = firstRun.text[0];
  const remainderOfFirstRun = firstRun.text.slice(1);
  const remainingRuns: TypeRun[] = remainderOfFirstRun ? [{ ...firstRun, text: remainderOfFirstRun }, ...restRuns] : restRuns;

  const dropCapRun = new TextRun({
    text: dropCapChar,
    font,
    size: size ? Math.round(size * scale) : undefined,
    bold: true,
    italics: firstRun.italic,
  });
  return [dropCapRun, ...buildRuns(remainingRuns, font, size, color)];
}

// Sprint 6 (ADR-0029 Decision 6, Functional Spec item 9): DOCX gains header/footer support -
// a genuinely new capability, DOCXRenderer had none before this. A single Header/Footer applies
// to the whole document (docx's own per-section header/footer model would need splitting the
// single ISectionOptions this renderer builds into one section per top-level Chapter/Section to
// alternate a 'chapterTitle' running head per chapter - not built this sprint, a real, disclosed
// limitation; ClassicTheme's own 'bookTitle' content is constant document-wide regardless, so
// this doesn't affect the one populated theme that exists). The title used for 'chapterTitle'
// content is the first page's resolved title (Page.headerFooterTitle, LayoutEngine) - the best
// single value available without per-section splitting.
//
// The footer's page number uses docx's own PageNumber.CURRENT/TOTAL_PAGES fields (not a
// pre-computed string like PDFRenderer's) - Word recalculates these live as the document
// reflows, which is the structurally correct choice for a format that isn't fixed-layout the
// way rendered PDF pages are (ADR-0013 already treats our own Page[] as an estimate).
function buildHeaderFooter(book: PaginatedBook): { headers?: ISectionOptions['headers']; footers?: ISectionOptions['footers'] } {
  const runningHead = book.styledBook.theme.runningHead;
  if (!runningHead?.show) return {};

  const alignment = runningHead.position === 'left' ? AlignmentType.LEFT : AlignmentType.RIGHT;
  const title = book.pages[0]?.headerFooterTitle;
  const headerText = title ? (runningHead.uppercase ? title.toUpperCase() : title) : undefined;

  const headers = headerText
    ? { default: new Header({ children: [new Paragraph({ alignment, children: [new TextRun({ text: headerText, size: (runningHead.size ?? 9) * 2 })] })] }) }
    : undefined;

  const footers = runningHead.pageNumber
    ? {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'Page ', size: (runningHead.size ?? 9) * 2 }),
                new TextRun({ children: [PageNumber.CURRENT], size: (runningHead.size ?? 9) * 2 }),
                new TextRun({ text: ' of ', size: (runningHead.size ?? 9) * 2 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: (runningHead.size ?? 9) * 2 }),
              ],
            }),
          ],
        }),
      }
    : undefined;

  return { headers, footers };
}

// Functional Spec item 7 / Architecture Impact §4: DOCXRenderer becomes a consumer of
// paginated.tableOfContents, mirroring PDFRenderer's Sprint 6 wiring. Rendered as literal
// paragraphs from our own precomputed entries (title indented by level, page number appended
// inline) rather than docx's native TableOfContents field - a real Word TOC field requires
// Word to "update fields" before showing real text, which would make this unverifiable by real
// text extraction (this project's Real Export Policy, docs/DEVELOPMENT_WORKFLOW.md) the same way every other
// renderer output already is; consistency with PDFRenderer's own literal-paragraph approach was
// also preferred over introducing a second rendering strategy for the same data.
/**
 * Front matter as real DOCX paragraphs, each page ended by a page break so the title page,
 * copyright page and body start on their own sheets — exactly as a printed book does.
 *
 * `Book.frontMatter` was typed in Sprint 1 and rendered by nothing but `toc`, so every exported
 * DOCX opened on Chapter 1 with no title page, copyright or ISBN.
 */
function buildFrontMatterParagraphs(front: FrontMatter, theme: Theme): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  if (front.titlePage) {
    const { title, subtitle, tagline, author } = front.titlePage;
    paragraphs.push(
      new Paragraph({ spacing: { before: 2400, after: 240 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: title, font: theme.fonts.heading, size: 64, bold: true })] })
    );
    if (subtitle) {
      paragraphs.push(new Paragraph({ spacing: { after: 240 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: subtitle, font: theme.fonts.heading, size: 32, italics: true })] }));
    }
    if (tagline) {
      paragraphs.push(new Paragraph({ spacing: { after: 480 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: tagline, font: theme.fonts.body, size: 22, italics: true })] }));
    }
    // Conditional like every other line (FOUNDER_TRAVERSAL defect 2): no real author, no author
    // paragraph — never an empty leaf reading as 'Unknown author'.
    if (author) {
      paragraphs.push(new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: author, font: theme.fonts.body, size: 28 })] }));
    }
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  }

  if (front.copyrightPage) {
    const page = front.copyrightPage;
    // Every line is conditional: an empty "ISBN:" label reads as authored and wrong.
    const lines = [
      page.text,
      page.copyrightText && page.copyrightText !== page.text ? page.copyrightText : undefined,
      page.legalNotice,
      page.isbn ? `ISBN: ${page.isbn}` : undefined,
      page.printingInfo,
    ].filter((line): line is string => Boolean(line));

    paragraphs.push(new Paragraph({ spacing: { before: 6000 }, children: [] }));
    for (const line of lines) {
      paragraphs.push(new Paragraph({ spacing: { after: 60 },
        children: [new TextRun({ text: line, font: theme.fonts.body, size: 18 })] }));
    }
    paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
  }

  return paragraphs;
}

function buildTableOfContentsParagraphs(entries: TOCEntry[], theme: Theme): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, text: 'Table of Contents' }),
  ];
  for (const entry of entries) {
    paragraphs.push(
      new Paragraph({
        indent: { left: (entry.level - 1) * 360 }, // 360 twips = 0.25in per level
        children: [
          new TextRun({ text: entry.title, font: theme.fonts.body }),
          ...(entry.pageNumber !== undefined ? [new TextRun({ text: `\t${entry.pageNumber}`, font: theme.fonts.body })] : []),
        ],
      })
    );
  }
  return paragraphs;
}

export class DOCXRenderer implements Renderer<Buffer> {
  /**
   * With a `TextMeasurer`, drop caps render as Word's NATIVE frame (MINI_DR_DROP_CAPS §6 commit
   * 1): the letter sized so its ink spans the band (the shared `dropCapMetrics` arithmetic —
   * measured inputs, Gelasio being metrically compatible with the Georgia Word renders). Without
   * one, drop caps fall back to the inline enlarged-letter approximation — the documented
   * no-instrument degradation, the same philosophy as LayoutEngine's fallback estimator.
   */
  constructor(private readonly options: { measurer?: TextMeasurer } = {}) {}

  async render(book: PaginatedBook, _context: RenderContext): Promise<RenderResult<Buffer>> {
    const pageStarts = new Map<string, Page>();
    for (const page of book.pages.slice(1)) {
      // Phase B: a continuation page's first block is the tail of a split paragraph. Word
      // reflows text itself, so the whole paragraph lives at its start - forcing a page break
      // here would break it at its FIRST character, which is exactly wrong.
      if (page.startsWithContinuation) continue;
      const firstId = page.blocks[0];
      if (firstId) pageStarts.set(firstId, page);
    }

    const tocEntries = book.tableOfContents ?? [];
    // Front matter first, then the TOC, then the body - real print order.
    const children: (Paragraph | Table)[] = [
      ...buildFrontMatterParagraphs(book.styledBook.book.frontMatter, book.styledBook.theme),
      ...(tocEntries.length > 0 ? buildTableOfContentsParagraphs(tocEntries, book.styledBook.theme) : []),
    ];
    this.renderContent(
      book.styledBook.book.mainContent,
      book.styledBook.blockStyles,
      book.styledBook.blockTypography,
      pageStarts,
      book.styledBook.theme,
      true,
      children,
      tocEntries.length > 0
    );

    // docx measures page geometry in twips (1pt = 20 twips) - PageLayout is in points
    // throughout the rest of the domain (matches PDFKit's own unit), converted here at
    // the render boundary only. Sprint 6: previously this section had no `page` property
    // at all, so every export silently used docx's own library default (Letter-equivalent)
    // regardless of which PageLayout was actually selected - see PaginatedBook.pageLayout's
    // doc comment for the full disclosure.
    const { width, height, marginTop, marginBottom, marginLeft, marginRight } = book.pageLayout;
    const TWIPS_PER_POINT = 20;
    const { headers, footers } = buildHeaderFooter(book);
    const section: ISectionOptions = {
      properties: {
        page: {
          size: { width: width * TWIPS_PER_POINT, height: height * TWIPS_PER_POINT },
          margin: {
            top: marginTop * TWIPS_PER_POINT,
            bottom: marginBottom * TWIPS_PER_POINT,
            left: marginLeft * TWIPS_PER_POINT,
            right: marginRight * TWIPS_PER_POINT,
          },
        },
      },
      headers,
      footers,
      children,
    };
    const doc = new Document({
      styles: {
        default: buildHeadingStyles(book.styledBook.theme),
        paragraphStyles: buildSubtitleStyle(book.styledBook.theme),
      },
      sections: [section],
    });

    // No pageCount: DOCX carries no pagination of its own - Word repaginates on open, against
    // the reader's own fonts and printer metrics. Reporting a number here would be inventing
    // one, and PageCountRule's honest PAGE_COUNT_UNKNOWN is the correct outcome (ADR-0045).
    return { output: await Packer.toBuffer(doc), metrics: { pageLayout: book.pageLayout } };
  }

  private renderContent(
    contents: Content[],
    blockStyles: Record<string, ResolvedBlockStyle>,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    pageStarts: Map<string, Page>,
    theme: Theme,
    isTopLevel: boolean,
    out: (Paragraph | Table)[],
    forceBreakOnFirst = false
  ): void {
    let isFirstContent = true;
    for (const content of contents) {
      const firstBlockId = content.content[0]?.id;
      const ownerPage = isTopLevel && content.type === 'chapter' && firstBlockId !== undefined ? pageStarts.get(firstBlockId) : undefined;
      if (ownerPage && firstBlockId) pageStarts.delete(firstBlockId);

      // Blank pages (Chapter.openingPageStyle, Sprint 6 commit 8): an empty paragraph forcing
      // its own page break creates one genuinely blank physical page each, before the title
      // paragraph's own pageBreakBefore starts the chapter's real content page.
      for (let i = 0; i < (ownerPage?.blankPagesBefore ?? 0); i++) {
        out.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      }

      // A generated TOC (commit 10) was prepended to `out` before this call - the very first
      // top-level content needs its own forced break to separate it from the TOC, even though
      // it's normally the one case that never breaks (it's the document's own first content).
      const breaksPage = ownerPage !== undefined || (isTopLevel && isFirstContent && forceBreakOnFirst);
      out.push(...this.renderTitle(content, breaksPage));
      isFirstContent = false;

      for (const block of content.content) {
        out.push(...this.renderBlock(block, blockStyles[block.id], blockTypography, pageStarts, theme));
      }

      if (content.type === 'chapter' && content.sections) {
        this.renderContent(content.sections, blockStyles, blockTypography, pageStarts, theme, false, out);
      } else if (content.type === 'section' && content.subsections) {
        this.renderContent(content.subsections, blockStyles, blockTypography, pageStarts, theme, false, out);
      }
    }
  }

  private renderTitle(content: Chapter | Section, pageBreakBefore: boolean): Paragraph[] {
    if (content.type === 'chapter') {
      const title = new Paragraph({
        text: content.title,
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore,
      });
      // A chapter's subtitle (MINI_DR_SUBTITLE_FIELD §4): a REAL `Subtitle`-styled paragraph —
      // Word's own convention (declared in styles.xml, buildSubtitleStyle) — so Word users see
      // and edit it as what it is. Deliberate bonus, GUARDED (TODO A1): this output never
      // counts as the unblocking manuscript for SUBTITLE_IMPORT_MAPPING_UNBLOCK.
      if (content.subtitle) {
        return [title, new Paragraph({ text: content.subtitle, style: 'Subtitle' })];
      }
      return [title];
    }
    return [
      new Paragraph({
        text: content.title,
        heading: HEADING_LEVEL_BY_NUMBER[content.level] ?? HeadingLevel.HEADING_6,
        pageBreakBefore,
      }),
    ];
  }

  /**
   * The Word-native drop cap (§4bis Option A, spike-proven): the first character split into its
   * own paragraph carrying the attribute-free `framePr` Word itself writes, the remainder as the
   * following paragraph — Word wraps the body beside the framed letter with its own engine.
   *
   * Sizing is the SHARED arithmetic (`dropCapMetrics`), from MEASURED inputs, never constants:
   * the band is what the PDF charges for the same paragraph (cap ink at the theme-declared scale over
   * measured body lines), and the letter is sized so its ink fills that band — exactly how Word
   * auto-sizes its own drop caps (spike Finding B: 129 half-points for lines=3 over an 11pt
   * body). One module, three formats, no divergent calculations.
   *
   * Returns undefined when the paragraph has no leading text to split — the caller falls back.
   */
  private buildNativeDropCapParagraphs(
    runs: TypeRun[],
    p: {
      font: string | undefined;
      size: number | undefined;
      color: string | undefined;
      spacing: { before: number; after: number } | undefined;
      alignment: 'both' | 'left' | 'center' | 'right' | undefined;
      pageBreakBefore: boolean;
    },
    style: ResolvedBlockStyle | undefined,
    theme: Theme
  ): (Paragraph | Table)[] | undefined {
    const [firstRun, ...restRuns] = runs;
    if (!firstRun || firstRun.text.length === 0) return undefined;
    const measurer = this.options.measurer!;

    const bodyPt = style?.fontSize ?? theme.fontSizes.body;
    const bodyLinePt = measurer.lineHeight(bodyPt, { theme });
    const capHeightEm = measurer.capHeight(100, { theme }) / 100;
    // The same band the PDF prices for this paragraph: the scaled glyph's ink over body lines.
    // The scale is the theme's declared knob (§6 commit 2) — the ONE value all formats derive from.
    const bandLines = Math.max(1, Math.ceil((capHeightEm * dropCapScaleOf(theme) * bodyPt) / bodyLinePt));
    const letterPt = dropCapLetterSizePt({ lines: bandLines, bodyLinePt, capHeightEm });

    const letterChar = firstRun.text[0];
    const remainderOfFirstRun = firstRun.text.slice(1);
    const remainingRuns: TypeRun[] = remainderOfFirstRun ? [{ ...firstRun, text: remainderOfFirstRun }, ...restRuns] : restRuns;

    const letterParagraph = withNativeDropCapFrame(
      new Paragraph({
        pageBreakBefore: p.pageBreakBefore,
        children: [
          new TextRun({ text: letterChar, font: p.font, size: Math.round(letterPt * 2), bold: true, italics: firstRun.italic, color: p.color }),
        ],
      }),
      bandLines
    );
    const bodyParagraph = new Paragraph({
      spacing: p.spacing,
      alignment: p.alignment,
      children: buildRuns(remainingRuns, p.font, p.size, p.color),
    });
    return [letterParagraph, bodyParagraph];
  }

  private renderBlock(
    block: Block,
    style: ResolvedBlockStyle | undefined,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    pageStarts: Map<string, Page>,
    theme: Theme
  ): (Paragraph | Table)[] {
    const pageBreakBefore = pageStarts.has(block.id);
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
        // Callout chrome (MINI_DR_CALLOUTS §3): Word's OWN paragraph chrome — a left border
        // (w:pBdr, size in eighths of a point, space = the gap in points) plus shading (w:shd)
        // only when the theme declares the tint. Colours from the one shared module; Word
        // reflows, so no R2 surface here (the ADR-0045 asymmetry).
        if (block.callout === true) {
          const tint = calloutTintOf(theme);
          return [
            new Paragraph({
              pageBreakBefore,
              spacing,
              alignment,
              border: {
                left: {
                  style: BorderStyle.SINGLE,
                  size: CALLOUT_RULE_PT * 8,
                  space: CALLOUT_GAP_PT,
                  color: calloutRuleColorOf(theme).replace(/^#/, '').toUpperCase(),
                },
              },
              ...(tint ? { shading: { type: ShadingType.CLEAR, fill: tint.replace(/^#/, '').toUpperCase() } } : {}),
              children: buildRuns(runs, font, size, color),
            }),
          ];
        }
        // Word-NATIVE drop cap (MINI_DR_DROP_CAPS §6 commit 1, §4bis Option A): the letter in its
        // own framePr paragraph — the structure Word's DropCap.Enable() itself produces — sized by
        // the shared dropCapMetrics arithmetic. Needs a measurer; without one, the inline
        // enlarged-letter approximation below stays the documented degradation.
        if (dropCap && this.options.measurer) {
          const native = this.buildNativeDropCapParagraphs(runs, { font, size, color, spacing, alignment, pageBreakBefore }, style, theme);
          if (native) return native;
        }
        return [
          new Paragraph({
            pageBreakBefore,
            spacing,
            alignment,
            children: dropCap ? buildRunsWithDropCap(runs, font, size, color, dropCapScaleOf(theme)) : buildRuns(runs, font, size, color),
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
          const data = Buffer.from(block.base64, 'base64');
          // Real format instead of the old hardcoded 'png' (a JPEG declared as PNG is
          // format-lottery); real proportional size instead of 300x200 for every image.
          // 468px ~ a 6.5in text column at 72dpi — Word rescales to its own margins anyway,
          // what matters is the true aspect ratio reaching the document.
          const probed = probeImageDimensions(data);
          const size = renderedImageSize(
            { width: block.width ?? probed?.width, height: block.height ?? probed?.height },
            468
          );
          return [
            new Paragraph({
              pageBreakBefore,
              children: [
                new ImageRun({
                  data,
                  transformation: size
                    ? { width: Math.round(size.width), height: Math.round(size.height) }
                    : { width: block.width ?? 300, height: block.height ?? 200 },
                  type: probed?.format === 'jpeg' ? 'jpg' : probed?.format === 'gif' ? 'gif' : 'png',
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
