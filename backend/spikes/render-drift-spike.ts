/**
 * Render-drift census — measures, block by block, the gap between what the measured
 * LayoutEngine CHARGES for a block and what PDFRenderer actually CONSUMES drawing it.
 * This is the mechanism behind the 55 unplanned PDFKit auto-breaks (addpage-census-spike):
 * if consumption systematically exceeds charge, pages overflow by a line and PDFKit breaks
 * on its own. Diagnostic ONLY. Run: npx tsx spikes/render-drift-spike.ts
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
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import type { Block } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'uploads', '1784126236261-Faith_Alone_Professional_KDP_Kobo.docx');

async function main() {
  const buffer = readFileSync(FILE);
  const raw = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' });
  const built = new ASTBuilder().build(normalized);
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const engine = new LayoutEngine(new PdfKitTextMeasurer());
  const paginated = engine.paginate(typeset, KDP5x8PageLayout);

  // What the model charged per block (same private path the engine used).
  const usableWidth = KDP5x8PageLayout.width - KDP5x8PageLayout.marginLeft - KDP5x8PageLayout.marginRight;
  const charge = (b: Block): number =>
    (engine as unknown as {
      estimateBlockHeight(b: Block, s: unknown, w: number): number;
    }).estimateBlockHeight(b, (paginated as unknown as { styledBook?: unknown }).styledBook ?? typeset, usableWidth);

  // Wrap the renderer's private renderBlock: real consumed height = doc.y delta on same page.
  const renderer = new PDFRenderer();
  const proto = Object.getPrototypeOf(renderer) as Record<string, unknown>;
  const origRenderBlock = proto.renderBlock as (...a: unknown[]) => unknown;
  interface Sample { id: string; type: string; charged: number; consumed: number }
  const samples: Sample[] = [];
  proto.renderBlock = function (this: unknown, ...args: unknown[]) {
    const doc = args[0] as PDFKit.PDFDocument & { y: number };
    const block = args[1] as Block;
    const pageBefore = (doc as unknown as { _pageBufferStart?: number; page: unknown }).page;
    const yBefore = doc.y;
    const result = origRenderBlock.apply(this, args);
    const samePage = (doc as unknown as { page: unknown }).page === pageBefore;
    if (samePage && 'text' in block) {
      samples.push({ id: block.id, type: block.type, charged: charge(block), consumed: doc.y - yBefore });
    }
    return result;
  };

  await renderer.render(paginated, { language: 'en' });

  const n = samples.length;
  const drift = samples.map((s) => s.consumed - s.charged);
  const mean = drift.reduce((a, b) => a + b, 0) / n;
  const over = drift.filter((d) => d > 0.5).length;
  const under = drift.filter((d) => d < -0.5).length;
  const totalCharged = samples.reduce((a, s) => a + s.charged, 0);
  const totalConsumed = samples.reduce((a, s) => a + s.consumed, 0);
  console.log(`blocks sampled (same-page draws only): ${n}`);
  console.log(`mean drift (consumed - charged): ${mean.toFixed(2)}pt per block`);
  console.log(`blocks where renderer consumed MORE than charged: ${over} (${((100 * over) / n).toFixed(0)}%)  LESS: ${under}`);
  console.log(`totals: charged ${Math.round(totalCharged)}pt  consumed ${Math.round(totalConsumed)}pt  ratio ${(totalConsumed / totalCharged).toFixed(4)}`);
  const usableHeight = KDP5x8PageLayout.height - KDP5x8PageLayout.marginTop - KDP5x8PageLayout.marginBottom;
  console.log(`cumulative excess: ${Math.round(totalConsumed - totalCharged)}pt = ${((totalConsumed - totalCharged) / usableHeight).toFixed(1)} pages of unmodelled consumption`);
  // the shape of the drift: is it the flat +~1.2pt spaceAfter effect, or lumpy (wrap differences)?
  const buckets = new Map<string, number>();
  for (const d of drift) {
    const k = d < -6 ? '<-6' : d < -0.5 ? '-6..-0.5' : d < 0.5 ? '~0' : d < 2 ? '+0.5..2' : d < 6 ? '+2..6' : d < 14 ? '+6..14 (~1 line)' : '>+14 (>1 line)';
    buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  console.log('drift distribution:', [...buckets.entries()].map(([k, v]) => `${k}: ${v}`).join('   '));
  const worst = [...samples].sort((a, b) => (b.consumed - b.charged) - (a.consumed - a.charged)).slice(0, 5);
  for (const w of worst) {
    console.log(`  worst: ${w.type} ${w.id}  charged ${w.charged.toFixed(1)}  consumed ${w.consumed.toFixed(1)}`);
  }
}

main();
