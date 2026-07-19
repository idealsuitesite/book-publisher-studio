/**
 * Over-pagination spike — the CTO's Proof observation (2026-07-20): pages with 1-2 lines then
 * blank, ~299 pages where ~150 were expected. Diagnostic ONLY, no fix. Run:
 *   npx tsx spikes/overpagination-spike.ts
 *
 * Reproduces live, on the REAL manuscript (Faith_Alone) through the REAL export pipeline
 * (FrontMatterBuilder included, measured LayoutEngine, classic theme), at the trim that
 * reproduces the reported page count (kdp-5x8) and at letter for contrast:
 *   1. structure census — chapters/sections the ASTBuilder actually produced;
 *   2. page-by-page REAL fill ratio, priced with the engine's own PdfKitTextMeasurer
 *      (same embedded fonts the renderer draws with), split blocks accounted;
 *   3. for every underfilled page: what its last block is, and what the NEXT page opens
 *      with — chapter start (legitimate convention) vs atomic block that refused to split;
 *   4. the ideal full-fill page count vs the actual, so legitimate trim math is separated
 *      from defect.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from '../src/infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../src/infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../src/domain/services/ASTBuilder';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { FrontMatterBuilder } from '../src/domain/services/FrontMatterBuilder';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP5x8PageLayout } from '../src/domain/layouts/KDP5x8PageLayout';
import { LetterPageLayout } from '../src/domain/layouts/LetterPageLayout';
import type { PageLayout } from '../src/domain/models/PageLayout';
import type { Block, Content, Chapter } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'uploads', '1784126236261-Faith_Alone_Professional_KDP_Kobo.docx');

interface StyleEntry { fontSize?: number; spaceAfter?: number }

async function analyse(layout: PageLayout, label: string) {
  const buffer = readFileSync(FILE);
  const raw = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'faith.docx' });
  const built = new ASTBuilder().build(normalized);
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const theme = getTheme('classic');
  const styled = new ThemeEngine().applyTheme(book, theme);
  const typeset = new TypographyResolver().resolve(styled);
  const measurer = new PdfKitTextMeasurer();
  const paginated = new LayoutEngine(measurer).paginate(typeset, layout);

  const usableWidth = layout.width - layout.marginLeft - layout.marginRight;
  const usableHeight = layout.height - layout.marginTop - layout.marginBottom;

  const t = typeset as unknown as {
    book: { mainContent: Content[] };
    blockStyles: Record<string, StyleEntry>;
  };

  // ---- 1. structure census + block census ------------------------------------------------
  const blocks = new Map<string, Block>();
  const chapterFirstBlock = new Map<string, string>(); // first block id -> chapter title
  let chapterCount = 0;
  let sectionCount = 0;
  const typeCensus = new Map<string, number>();

  const collectBlocks = (list: Block[]): void => {
    for (const b of list) {
      blocks.set(b.id, b);
      typeCensus.set(b.type, (typeCensus.get(b.type) ?? 0) + 1);
    }
  };
  const walk = (contents: Content[], owningChapter?: Chapter): void => {
    for (const c of contents) {
      if (c.type === 'chapter') {
        chapterCount++;
        if (c.content[0]) chapterFirstBlock.set(c.content[0].id, c.title);
        collectBlocks(c.content);
        if (c.sections) walk(c.sections as unknown as Content[], c);
      } else {
        sectionCount++;
        // a section that OPENS a top-level chapterless flow, or nested
        if (owningChapter === undefined && c.content[0] && !chapterFirstBlock.has(c.content[0].id)) {
          // top-level section: does NOT force a page break (LayoutEngine rule) — just census
        }
        collectBlocks(c.content);
        const sub = (c as unknown as { subsections?: Content[] }).subsections;
        if (sub) walk(sub, owningChapter);
      }
    }
  };
  walk(t.book.mainContent);

  // ---- 2. per-page fill, split-aware, priced by the engine's own measurer ----------------
  const price = (b: Block): number => {
    const style = t.blockStyles[b.id] ?? {};
    const fontSize = style.fontSize ?? 11;
    const text = 'text' in b ? ((b as { text?: string }).text ?? '') : '';
    const h = measurer.measureHeight(text, {
      fontSize,
      width: usableWidth,
      theme,
      heading: b.type === 'heading',
    } as Parameters<PdfKitTextMeasurer['measureHeight']>[1]);
    return h + (style.spaceAfter ?? 8);
  };
  const lineOf = (b: Block): number => {
    const style = t.blockStyles[b.id] ?? {};
    return measurer.lineHeight(style.fontSize ?? 11);
  };

  const renderedLines = new Map<string, number>(); // split carry: block id -> lines already out
  interface PageStat {
    n: number;
    fill: number;
    isChapterStart: boolean;
    chapterTitle?: string;
    lastBlock?: Block;
    firstBlock?: Block;
    continuation: boolean;
  }
  const stats: PageStat[] = [];

  for (const page of paginated.pages) {
    let height = 0;
    page.blocks.forEach((id, i) => {
      const b = blocks.get(id);
      if (!b) return; // front-matter synthetic blocks not in mainContent maps
      const full = price(b);
      const line = lineOf(b);
      const isFirst = i === 0;
      const isLast = i === page.blocks.length - 1;
      if (isFirst && page.startsWithContinuation) {
        const done = renderedLines.get(id) ?? 0;
        if (isLast && page.splitAfterLines) {
          height += page.splitAfterLines * line;
          renderedLines.set(id, done + page.splitAfterLines);
        } else {
          height += Math.max(line * 2, full - done * line);
        }
      } else if (isLast && page.splitAfterLines) {
        height += page.splitAfterLines * line;
        renderedLines.set(id, page.splitAfterLines);
      } else {
        height += full;
      }
    });
    const firstId = page.blocks[0];
    stats.push({
      n: page.number,
      fill: height / usableHeight,
      isChapterStart: firstId !== undefined && chapterFirstBlock.has(firstId),
      chapterTitle: firstId ? chapterFirstBlock.get(firstId) : undefined,
      lastBlock: blocks.get(page.blocks[page.blocks.length - 1] ?? ''),
      firstBlock: blocks.get(firstId ?? ''),
      continuation: page.startsWithContinuation ?? false,
    });
  }

  // ---- report ----------------------------------------------------------------------------
  console.log(`\n================ ${label} (${layout.width}x${layout.height}pt, usable ${Math.round(usableWidth)}x${Math.round(usableHeight)}pt) ================`);
  console.log(`chapters: ${chapterCount}   sections: ${sectionCount}   pages: ${paginated.pages.length}   metrics.pageCount: ${paginated.metrics?.pageCount}`);
  console.log(`block census: ${[...typeCensus.entries()].map(([k, v]) => `${k}:${v}`).join('  ')}`);

  const contentStats = stats.filter((s) => s.fill > 0); // skip synthetic-only front-matter pages
  const mean = contentStats.reduce((a, s) => a + s.fill, 0) / contentStats.length;
  const under50 = contentStats.filter((s) => s.fill < 0.5);
  const under70 = contentStats.filter((s) => s.fill < 0.7);
  console.log(`mean fill: ${(100 * mean).toFixed(0)}%   pages <70%: ${under70.length}/${contentStats.length}   pages <50%: ${under50.length}/${contentStats.length}`);

  // total ideal pages: all content at 100% fill + one break per chapter
  const totalHeight = [...blocks.values()].reduce((a, b) => a + price(b), 0);
  console.log(`ideal full-fill pages (content only): ${Math.ceil(totalHeight / usableHeight)} + ${chapterCount} chapter-break part-pages`);

  // classify every underfilled page by what comes NEXT
  const causes = new Map<string, number>();
  for (const s of under70) {
    const next = stats.find((x) => x.n === s.n + 1);
    let cause: string;
    if (!next) cause = 'last page of book';
    else if (next.isChapterStart) cause = 'next page starts a CHAPTER (forced break — convention)';
    else if (next.continuation) cause = 'split continuation (unexpected with underfill!)';
    else if (next.firstBlock) cause = `atomic ${next.firstBlock.type} moved whole to next page`;
    else cause = 'front-matter/synthetic';
    causes.set(cause, (causes.get(cause) ?? 0) + 1);
  }
  console.log(`\nunderfilled (<70%) pages by cause:`);
  for (const [cause, n] of [...causes.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${cause}`);
  }

  // the worst 12, with the evidence inline
  console.log(`\nworst 12 pages:`);
  for (const s of [...contentStats].sort((a, b) => a.fill - b.fill).slice(0, 12)) {
    const next = stats.find((x) => x.n === s.n + 1);
    const nb = next?.firstBlock;
    const nextDesc = next?.isChapterStart
      ? `CHAPTER "${(next.chapterTitle ?? '').slice(0, 30)}"`
      : nb
        ? `${nb.type} (${'text' in nb ? String((nb as { text?: string }).text ?? '').split(/\s+/).length : '?'} words)`
        : 'end/synthetic';
    const lb = s.lastBlock;
    console.log(
      `  p${String(s.n).padStart(3)}  fill ${(100 * s.fill).toFixed(0).padStart(3)}%  last: ${lb?.type ?? '-'}  next page: ${nextDesc}`
    );
  }
}

async function main() {
  await analyse(KDP5x8PageLayout, 'kdp-5x8 — the trim that reproduces the reported count');
  await analyse(LetterPageLayout, 'letter — contrast');
}

main();
