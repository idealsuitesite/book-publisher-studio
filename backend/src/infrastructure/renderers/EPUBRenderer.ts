import * as epubModule from 'epub-gen-memory';
import { probeImageDimensions } from '../../shared/utils/imageDimensions';
import type { Chapter as EpubChapter, Options as EpubOptions } from 'epub-gen-memory';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Renderer, RenderContext, RenderResult } from '../../domain/ports/Renderer';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { Theme } from '../../domain/models/Theme';
import type { ResolvedTypography, TypeRun } from '../../domain/models/ResolvedTypography';
import type { Content, Block, Image, FrontMatter } from '../../domain/models/Book';
import { listItemTypographyKey } from '../../shared/utils/typographyKeys';
import { runsOrPlainFallback } from '../../shared/utils/typographyRuns';
import { dropCapScaleOf } from '../../domain/services/dropCapMetrics';
import { CHAPTER_SUBTITLE_RATIO } from '../../domain/services/titleMetrics';
import { CALLOUT_GAP_PT, CALLOUT_PAD_V_PT, CALLOUT_RULE_PT, calloutRuleColorOf, calloutTintOf } from '../../domain/services/calloutMetrics';

type EpubFn = (options: EpubOptions, content: EpubChapter[]) => Promise<Buffer>;

// epub-gen-memory ships as CJS with no "exports" map. Under this project's ESM/CJS interop the
// callable arrives wrapped two levels deep (module.default.default, not module.default) -
// confirmed identically under both tsx and plain `node` (ADR-0020), so this isn't a dev-only
// quirk. Unwrapped defensively (rather than hardcoding the depth) in case a future version or
// runtime changes it - fails loudly if no callable is ever found, instead of silently.
function resolveEpubFn(mod: unknown): EpubFn {
  let candidate = mod;
  for (let i = 0; i < 3; i++) {
    if (typeof candidate === 'function') return candidate as EpubFn;
    candidate = (candidate as { default?: unknown } | undefined)?.default;
  }
  throw new Error('epub-gen-memory: could not resolve the exported render function');
}
const epub = resolveEpubFn(epubModule);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// EPUB is just HTML+CSS: CSS `float: left` makes the reading system's own layout engine wrap
// the following text around the enlarged letter, same technique any web page uses. The em size
// is the theme's declared scale (dropCapScaleOf, §6 commit 2) — the same knob the PDF glyph and
// the Word letter derive from; the 0.08em padding mirrors DROP_CAP_GUTTER_EM so the three
// formats space the ornament alike.
function dropCapCss(scale: number): string {
  return `.dropcap { float: left; font-size: ${scale}em; line-height: 0.8em; padding-right: 0.08em; font-weight: bold; }`;
}

// Callout chrome (MINI_DR_CALLOUTS §3): the reflowable format's native box — a left border in
// the resolved accent, padding from the shared constants, background only when the theme
// declares the tint (a LITERAL pre-mixed hex from calloutTintOf; reader CSS gets no opacity
// tricks, the same computed ink as the PDF rect and Word's w:shd).
function calloutCss(theme: Theme): string {
  const tint = calloutTintOf(theme);
  const box = `.callout { border-left: ${CALLOUT_RULE_PT}pt solid ${calloutRuleColorOf(theme)}; padding: ${CALLOUT_PAD_V_PT}pt 0 ${CALLOUT_PAD_V_PT}pt ${CALLOUT_GAP_PT}pt; }`;
  return tint ? `${box}\n      .callout { background-color: ${tint}; }` : box;
}

// Renders one TypeRun as HTML, nesting tags for runs with multiple flags set (e.g. bold +
// italic). Every TypeRun flag maps onto a real HTML element - unlike PDFKit, nothing here
// needs a documented gap for superscript/subscript/small-caps.
function renderRun(run: TypeRun): string {
  let html = escapeHtml(run.text);
  if (run.superscript) html = `<sup>${html}</sup>`;
  if (run.subscript) html = `<sub>${html}</sub>`;
  if (run.smallCaps) html = `<span style="font-variant: small-caps">${html}</span>`;
  if (run.strikethrough) html = `<s>${html}</s>`;
  if (run.underline) html = `<u>${html}</u>`;
  if (run.italic) html = `<em>${html}</em>`;
  if (run.bold) html = `<strong>${html}</strong>`;
  if (run.linkUrl) html = `<a href="${escapeHtml(run.linkUrl)}">${html}</a>`;
  return html;
}

function renderRuns(runs: TypeRun[]): string {
  return runs.map(renderRun).join('');
}

// Drop-cap v1: wraps the first character of the first run in a floated span (see
// DROP_CAP_CSS). Real text-wrap, not an approximation - the reading system's own CSS
// engine handles it.
function renderRunsWithDropCap(runs: TypeRun[]): string {
  const [firstRun, ...restRuns] = runs;
  if (!firstRun || firstRun.text.length === 0) return renderRuns(runs);

  const dropCapChar = firstRun.text[0];
  const remainderOfFirstRun = firstRun.text.slice(1);
  const remainingRuns: TypeRun[] = remainderOfFirstRun ? [{ ...firstRun, text: remainderOfFirstRun }, ...restRuns] : restRuns;

  return `<span class="dropcap">${escapeHtml(dropCapChar)}</span>${renderRuns(remainingRuns)}`;
}

export class EPUBRenderer implements Renderer<Buffer> {
  // The epub-gen render function is injectable (defaults to the resolved library callable) so the
  // adapter's contract with it can be tested directly — FOUNDER_TRAVERSAL EPUB-500 review: the
  // useful guard is not "epub-gen throws on undefined" (a fact about a library we do not own) but
  // "THIS adapter never hands epub-gen an undefined lang, whatever the book's language". A spy
  // asserts that invariant for authorless/languageless/declared inputs alike.
  constructor(private readonly epubFn: EpubFn = epub) {}

  async render(book: PaginatedBook, context: RenderContext): Promise<RenderResult<Buffer>> {
    const { book: domainBook, theme, blockTypography } = book.styledBook;
    // Scoped per render call: images with embedded base64 data are written here and referenced
    // via file:// (ADR-0020, finding 5 - epub-gen-memory unconditionally fetches <img src>, with
    // no bypass for already-available bytes; file:// is the verified zero-network-call path).
    const tmpDir = mkdtempSync(join(tmpdir(), 'epub-images-'));

    try {
      // mainContent isn't always Chapter[] - ASTBuilder falls back to a top-level Section
      // ("preamble") when the source document has no Heading-1-level break at all (confirmed:
      // this is exactly what a real DOCX from backend/uploads/ produces). DOCXRenderer and
      // PDFRenderer both already walk Content generically for this reason; an earlier version of
      // this renderer filtered for Chapter only, which silently produced a structurally valid
      // but completely empty EPUB for that file - caught only by inspecting real output, not by
      // any test with a synthetic always-has-a-chapter fixture.
      // Front matter becomes real, navigable EPUB sections ahead of the body. `Book.frontMatter`
      // was typed in Sprint 1 and rendered by nothing, so every exported EPUB opened on
      // Chapter 1 with no title page, copyright or ISBN. `excludeFromToc` keeps them out of the
      // contents list - a reader expects chapters there, not the copyright notice - while they
      // remain reachable by paging from the start, exactly as in a print book.
      const frontMatter = this.buildFrontMatterChapters(domainBook.frontMatter);
      const chapters = [
        ...frontMatter,
        ...domainBook.mainContent.map((content) => this.buildChapter(content, blockTypography, tmpDir)),
      ];

      // FOUNDER_TRAVERSAL defect 3 (+ CTO EPUB-500 review): the MODEL stays language-unknown when
      // the author declared none — `book.metadata.language` is undefined and never gets a 'en'
      // default there (that would be the same false assertion as the old hardcoded 'fr'). But the
      // EPUB FORMAT requires a `dc:language`, so THIS ADAPTER supplies the format-required fallback
      // explicitly — owned and documented here, never re-injected into the Book. Measured
      // (epub-lang-behavior-probe.ts): passing `lang: undefined` throws inside epub-gen
      // ("...reading 'replace'"), and omitting the key lets epub-gen fall back to 'en' — but
      // depending on that undocumented internal default is fragile (an upgrade could turn the
      // omit-path into the throw-path), so a book must NEVER fail to export because an optional
      // field is empty. 'en' is the disclosed default until a real language is known
      // (LANGUAGE_DETECTION). A declared language always wins.
      const language = context.metadata?.language ?? domainBook.metadata.language ?? 'en';
      const options: EpubOptions = {
        title: context.metadata?.title ?? domainBook.metadata.title,
        author: context.metadata?.author ?? domainBook.metadata.author,
        lang: language,
        version: 3,
        // We render every title ourselves (chapter and nested section headings) for parity with
        // DOCXRenderer/PDFRenderer, rather than relying on the library's own default behavior.
        prependChapterTitles: false,
        css: this.buildCss(theme),
        verbose: false,
      };

      // No pageCount, and that is a real answer rather than a gap: an EPUB is reflowable and
      // has no pages until a reading device lays it out (ADR-0045).
      return { output: await this.epubFn(options, chapters), metrics: { pageLayout: book.pageLayout } };
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  private buildCss(theme: Theme): string {
    return `
      body { font-family: '${theme.fonts.body}', serif; color: ${theme.colors.text}; line-height: ${theme.spacing.lineHeight}; }
      h1, h2, h3, h4, h5, h6 { font-family: '${theme.fonts.heading}', serif; }
      h1 { font-size: ${theme.fontSizes.h1}pt; }
      h2 { font-size: ${theme.fontSizes.h2}pt; }
      h3 { font-size: ${theme.fontSizes.h3}pt; }
      h4 { font-size: ${theme.fontSizes.h4}pt; }
      h5 { font-size: ${theme.fontSizes.h5}pt; }
      h6 { font-size: ${theme.fontSizes.h6}pt; }
      /* Phase 3 capability 1: headings carry the theme accent. EPUB had NO title colour of its
         own — headings simply inherited body's, so this rule is added rather than changed. */
      h1, h2, h3, h4, h5, h6 { color: ${theme.colors.accent}; }
      p { font-size: ${theme.fontSizes.body}pt; margin: 0 0 ${theme.spacing.paragraphSpacing}pt; }
      blockquote { margin-left: 1.5em; }
      table, th, td { border: 1px solid #999; border-collapse: collapse; padding: 4px; }
      ${dropCapCss(dropCapScaleOf(theme))}
      ${calloutCss(theme)}
      .chapter-subtitle { font-style: italic; font-size: ${theme.fontSizes.h1 * CHAPTER_SUBTITLE_RATIO}pt; color: ${theme.colors.accent}; margin: 0 0 ${theme.spacing.paragraphSpacing}pt; }
    `;
  }

  /**
   * Title and copyright pages as real EPUB sections. Every value is escaped: a book titled
   * `Tom & Jerry <Deluxe>` would otherwise produce invalid XHTML and a reader that refuses to
   * open the file.
   */
  private buildFrontMatterChapters(front: FrontMatter): EpubChapter[] {
    const chapters: EpubChapter[] = [];

    if (front.titlePage) {
      const { title, subtitle, tagline, author } = front.titlePage;
      const parts = [
        `<div style="text-align:center;margin-top:20%">`,
        `<h1 style="font-size:2em">${escapeHtml(title)}</h1>`,
        subtitle ? `<p style="font-size:1.3em;font-style:italic">${escapeHtml(subtitle)}</p>` : '',
        tagline ? `<p style="font-style:italic">${escapeHtml(tagline)}</p>` : '',
        author ? `<p style="margin-top:4em;font-size:1.1em">${escapeHtml(author)}</p>` : '',
        `</div>`,
      ].filter(Boolean);
      chapters.push({ title, content: parts.join('\n'), excludeFromToc: true });
    }

    if (front.copyrightPage) {
      const page = front.copyrightPage;
      // Each line is conditional - an empty "ISBN:" label reads as authored and wrong.
      const lines = [
        page.text,
        page.copyrightText && page.copyrightText !== page.text ? page.copyrightText : undefined,
        page.legalNotice,
        page.isbn ? `ISBN: ${page.isbn}` : undefined,
        page.printingInfo,
      ].filter((line): line is string => Boolean(line));

      const parts = [
        `<div style="font-size:0.85em">`,
        ...lines.map((line) => `<p>${escapeHtml(line)}</p>`),
        `</div>`,
      ];
      chapters.push({ title: 'Copyright', content: parts.join('\n'), excludeFromToc: true });
    }

    // The dedication (AUTHOR_EXPERIENCE D2): centered, italic; excluded from the nav, as a dedication is.
    if (front.dedication && front.dedication.type === 'paragraph') {
      const content = `<div style="text-align:center;font-style:italic;margin-top:20%">${escapeHtml(front.dedication.text)}</div>`;
      chapters.push({ title: 'Dedication', content, excludeFromToc: true });
    }

    // The preface (AUTHOR_EXPERIENCE D2): a titled section — a REAL nav entry, unlike title/copyright/
    // dedication — with its paragraphs. v1 content is paragraphs only.
    if (front.preface) {
      const paras = front.preface.content
        .filter((b): b is Extract<typeof b, { type: 'paragraph' }> => b.type === 'paragraph')
        .map((p) => `<p>${escapeHtml(p.text)}</p>`);
      const content = [`<h1>${escapeHtml(front.preface.title)}</h1>`, ...paras].join('\n');
      chapters.push({ title: front.preface.title, content });
    }

    return chapters;
  }

  private buildChapter(content: Content, blockTypography: Record<string, ResolvedTypography> | undefined, tmpDir: string): EpubChapter {
    const parts: string[] = [];
    this.renderContentInto(content, blockTypography, parts, tmpDir);
    // An untitled top-level Section (the ASTBuilder "preamble" — content that preceded the first
    // heading, ASTBuilder.ts:100) gets NO navigation entry (FOUNDER_TRAVERSAL_3 A4). We do NOT
    // fabricate a label: "Untitled" was a software-invented placeholder reaching the author's EPUB
    // nav — the "Unknown" class (Lot-1 defect 2) — and epub-gen requires no title (it tolerates an
    // empty one). This matches the model's own auto-TOC, which skips empty titles (LayoutEngine.ts:437),
    // so PDF and DOCX already show no entry — tri-format consistency. `excludeFromToc` removes only the
    // nav line; the preamble's CONTENT still renders in the spine (pinned by test, both directions).
    // Making that untitled section author-nameable is the separate experience work (UNTITLED_PREAMBLE_NAMEABLE).
    const title = content.title?.trim() ? content.title : '';
    if (!title) return { title: '', content: parts.join('\n'), excludeFromToc: true };
    return { title, content: parts.join('\n') };
  }

  private renderContentInto(
    content: Content,
    blockTypography: Record<string, ResolvedTypography> | undefined,
    parts: string[],
    tmpDir: string
  ): void {
    if (content.title) {
      const level = content.type === 'chapter' ? 1 : Math.min(6, Math.max(1, content.level));
      parts.push(`<h${level}>${escapeHtml(content.title)}</h${level}>`);
      // A chapter's subtitle (MINI_DR_SUBTITLE_FIELD §4): its own element directly under the
      // heading, styled by the .chapter-subtitle rule built from the shared ratio (buildCss).
      if (content.type === 'chapter' && content.subtitle) {
        parts.push(`<p class="chapter-subtitle">${escapeHtml(content.subtitle)}</p>`);
      }
    }

    for (const block of content.content) {
      parts.push(this.renderBlock(block, blockTypography, tmpDir));
    }

    const nested = content.type === 'chapter' ? content.sections : content.subsections;
    if (nested) {
      for (const child of nested) this.renderContentInto(child, blockTypography, parts, tmpDir);
    }
  }

  private renderBlock(block: Block, blockTypography: Record<string, ResolvedTypography> | undefined, tmpDir: string): string {
    switch (block.type) {
      case 'heading': {
        const level = Math.min(6, Math.max(1, block.level));
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        return `<h${level}>${renderRuns(runs)}</h${level}>`;
      }

      case 'paragraph': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        const dropCap = blockTypography?.[block.id]?.dropCap ?? false;
        const align = block.align && block.align !== 'left' ? ` style="text-align: ${block.align}"` : '';
        // Callout chrome (MINI_DR_CALLOUTS §3): one CSS class, its rules built from the shared
        // calloutMetrics module in buildCss. A callout is never drop-capped (resolver exclusion).
        const cls = block.callout === true ? ' class="callout"' : '';
        const inner = dropCap ? renderRunsWithDropCap(runs) : renderRuns(runs);
        return `<p${cls}${align}>${inner}</p>`;
      }

      case 'quote':
      case 'scripture': {
        // Italics are already forced onto every run by TypographyResolver
        // (design review §4 item 9) - the CSS blockquote rule no longer hardcodes
        // font-style: italic (removed), since the runs themselves now carry real <em>
        // tags reflecting that same rule, traceable to one place instead of two.
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.text);
        return `<blockquote>${renderRuns(runs)}</blockquote>`;
      }

      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        const items = block.items
          .map((item, index) => {
            const itemRuns = runsOrPlainFallback(blockTypography?.[listItemTypographyKey(block.id, index)], item);
            return `<li>${renderRuns(itemRuns)}</li>`;
          })
          .join('');
        return `<${tag}>${items}</${tag}>`;
      }

      case 'table': {
        const headerRow = `<tr>${block.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
        const bodyRows = block.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`).join('')}</tr>`)
          .join('');
        return `<table>${headerRow}${bodyRows}</table>`;
      }

      case 'footnote': {
        const runs = runsOrPlainFallback(blockTypography?.[block.id], block.content);
        return `<p>[${block.number}] ${renderRuns(runs)}</p>`;
      }

      case 'image':
        return this.renderImage(block, tmpDir);

      case 'page-break':
        // EPUB is reflowable (ADR-0013) - not a real page break, just a CSS hint some reading
        // systems honor and others ignore entirely.
        return '<div style="page-break-before: always;"></div>';

      case 'divider':
        return '<hr />';

      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  private renderImage(block: Image, tmpDir: string): string {
    if (!block.base64) {
      // No embedded data - never fetch remote URLs at render time (no hidden network I/O in a
      // renderer, same rule DOCXRenderer/PDFRenderer follow). Falls back to a text placeholder.
      return `<p><em>[Image: ${escapeHtml(block.caption ?? block.url)}]</em></p>`;
    }

    // Real extension from the bytes themselves (Phase 2) - the old PNG-assumed simplification
    // handed JPEG bytes to readers under a .png name.
    const data = Buffer.from(block.base64, 'base64');
    const format = probeImageDimensions(data)?.format ?? 'png';
    const filePath = join(tmpDir, `${block.id}.${format === 'jpeg' ? 'jpg' : format}`);
    writeFileSync(filePath, data);
    const fileUrl = `file://${filePath.split('\\').join('/')}`;
    const altText = escapeHtml(block.alt ?? block.caption ?? 'image');
    return `<img src="${fileUrl}" alt="${altText}" />`;
  }
}
