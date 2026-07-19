/**
 * Overflow trace — pinpoints WHERE the residual 13 unplanned breaks happen: records every
 * renderBlock's (page, yBefore, yAfter) and, at each unplanned-break warning, dumps the last
 * few records plus the page bottom. Diagnostic ONLY. Run: npx tsx spikes/overflow-trace-spike.ts
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

interface Rec { what: string; yBefore: number; yAfter: number; pageBefore: number; pageAfter: number }
const trail: Rec[] = [];

async function main() {
  const buffer = readFileSync(FILE);
  const raw = await new MammothParser().parse(buffer);
  const normalized = new HtmlNormalizer().normalize(raw.html, { fileName: 'f.docx' });
  const built = new ASTBuilder().build(normalized);
  const book = { ...built, frontMatter: new FrontMatterBuilder().build(built) };
  const styled = new ThemeEngine().applyTheme(book, getTheme('classic'));
  const typeset = new TypographyResolver().resolve(styled);
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);

  const engine = new LayoutEngine(new PdfKitTextMeasurer());
  const usableWidth = KDP5x8PageLayout.width - KDP5x8PageLayout.marginLeft - KDP5x8PageLayout.marginRight;
  const charge = (b: Block): number =>
    (engine as unknown as { estimateBlockHeight(b: Block, s: unknown, w: number): number })
      .estimateBlockHeight(b, typeset, usableWidth);

  const renderer = new PDFRenderer();
  const proto = Object.getPrototypeOf(renderer) as Record<string, unknown>;

  for (const method of ['renderBlock', 'renderTitle'] as const) {
    const orig = proto[method] as (...a: unknown[]) => unknown;
    proto[method] = function (this: unknown, ...args: unknown[]) {
      const doc = args[0] as PDFKit.PDFDocument & { y: number };
      const subject = args[1] as Block | { type: string; title?: string };
      const pageBefore = doc.bufferedPageRange().count;
      const yBefore = doc.y;
      const result = orig.apply(this, args);
      const charged = method === 'renderBlock' ? charge(subject as Block) : -1;
      trail.push({
        what:
          (method === 'renderTitle' ? `TITLE "${String((subject as { title?: string }).title ?? '').slice(0, 25)}"` : `${subject.type} ${(subject as Block).id}`) +
          (charged >= 0 ? ` [charged ${charged.toFixed(1)}]` : ''),
        yBefore, yAfter: doc.y,
        pageBefore, pageAfter: doc.bufferedPageRange().count,
      });
      return result;
    };
  }

  const origWarn = console.warn;
  let events = 0;
  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('unplanned page break')) {
      events += 1;
      if (events <= 4) {
        origWarn(`\n=== ${msg}`);
        for (const r of trail.slice(-6)) {
          origWarn(`   ${r.what.padEnd(30)} y ${r.yBefore.toFixed(1)} -> ${r.yAfter.toFixed(1)}  page ${r.pageBefore}->${r.pageAfter}`);
        }
        const doc = { bottom: KDP5x8PageLayout.height - KDP5x8PageLayout.marginBottom };
        origWarn(`   page bottom: ${doc.bottom}`);
      }
    }
  };

  await renderer.render(paginated, { language: 'en' });
  console.warn = origWarn;
  console.log(`\ntotal unplanned: ${events}`);
}

main();
