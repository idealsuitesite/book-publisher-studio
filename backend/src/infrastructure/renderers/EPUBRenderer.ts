import * as epubModule from 'epub-gen-memory';
import type { Chapter as EpubChapter, Options as EpubOptions } from 'epub-gen-memory';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Renderer, RenderContext } from '../../domain/ports/Renderer';
import type { PaginatedBook } from '../../domain/models/PaginatedBook';
import type { Theme } from '../../domain/models/Theme';
import type { Content, Block, Image } from '../../domain/models/Book';

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

export class EPUBRenderer implements Renderer<Buffer> {
  async render(book: PaginatedBook, context: RenderContext): Promise<Buffer> {
    const { book: domainBook, theme } = book.styledBook;
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
      const chapters = domainBook.mainContent.map((content) => this.buildChapter(content, tmpDir));

      const options: EpubOptions = {
        title: context.metadata?.title ?? domainBook.metadata.title,
        author: context.metadata?.author ?? domainBook.metadata.author,
        lang: context.metadata?.language ?? domainBook.metadata.language ?? 'en',
        version: 3,
        // We render every title ourselves (chapter and nested section headings) for parity with
        // DOCXRenderer/PDFRenderer, rather than relying on the library's own default behavior.
        prependChapterTitles: false,
        css: this.buildCss(theme),
        verbose: false,
      };

      return await epub(options, chapters);
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
      p { font-size: ${theme.fontSizes.body}pt; margin: 0 0 ${theme.spacing.paragraphSpacing}pt; }
      blockquote { font-style: italic; margin-left: 1.5em; }
      table, th, td { border: 1px solid #999; border-collapse: collapse; padding: 4px; }
    `;
  }

  private buildChapter(content: Content, tmpDir: string): EpubChapter {
    const parts: string[] = [];
    this.renderContentInto(content, parts, tmpDir);
    // An untitled top-level Section ("preamble", see the mainContent comment above) has an
    // empty title - fall back to a non-blank label for the TOC entry specifically, without
    // fabricating heading text in the body (renderContentInto already omits an empty heading tag).
    return { title: content.title || 'Untitled', content: parts.join('\n') };
  }

  private renderContentInto(content: Content, parts: string[], tmpDir: string): void {
    if (content.title) {
      const level = content.type === 'chapter' ? 1 : Math.min(6, Math.max(1, content.level));
      parts.push(`<h${level}>${escapeHtml(content.title)}</h${level}>`);
    }

    for (const block of content.content) {
      parts.push(this.renderBlock(block, tmpDir));
    }

    const nested = content.type === 'chapter' ? content.sections : content.subsections;
    if (nested) {
      for (const child of nested) this.renderContentInto(child, parts, tmpDir);
    }
  }

  private renderBlock(block: Block, tmpDir: string): string {
    switch (block.type) {
      case 'heading': {
        const level = Math.min(6, Math.max(1, block.level));
        return `<h${level}>${escapeHtml(block.text)}</h${level}>`;
      }

      case 'paragraph': {
        const align = block.align && block.align !== 'left' ? ` style="text-align: ${block.align}"` : '';
        return `<p${align}>${escapeHtml(block.text)}</p>`;
      }

      case 'quote':
      case 'scripture':
        return `<blockquote>${escapeHtml(block.text)}</blockquote>`;

      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
        return `<${tag}>${items}</${tag}>`;
      }

      case 'table': {
        const headerRow = `<tr>${block.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
        const bodyRows = block.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? '')}</td>`).join('')}</tr>`)
          .join('');
        return `<table>${headerRow}${bodyRows}</table>`;
      }

      case 'footnote':
        return `<p>[${block.number}] ${escapeHtml(block.content)}</p>`;

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

    // PNG assumed - same simplification DOCXRenderer already makes (Image has no mimeType field).
    const filePath = join(tmpDir, `${block.id}.png`);
    writeFileSync(filePath, Buffer.from(block.base64, 'base64'));
    const fileUrl = `file://${filePath.split('\\').join('/')}`;
    const altText = escapeHtml(block.alt ?? block.caption ?? 'image');
    return `<img src="${fileUrl}" alt="${altText}" />`;
  }
}
