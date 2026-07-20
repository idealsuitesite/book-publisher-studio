/** Renders the drop-cap fixture to a REAL PDF on disk, for visual inspection (CTO-required). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP5x8PageLayout } from '../src/domain/layouts/KDP5x8PageLayout';
import { createBook } from '../src/domain/models/Book';
import type { Paragraph } from '../src/domain/models/Book';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'verification', 'dropcap-visual');
const TEXT =
  'Every paragraph in this measurement carries the same words so that the only variable left ' +
  'between the two runs is the drop cap itself, which is exactly what has to be isolated here.';

async function render(dropCap: boolean, name: string) {
  const now = new Date();
  const blocks: Paragraph[] = Array.from({ length: 120 }, (_, i) => ({
    type: 'paragraph' as const, id: `p${i}`, text: TEXT, inlines: [], ...(dropCap ? { dropCap: true } : {}),
  }));
  const book = createBook({ title: 'Drop Cap Visual', author: 'Measurement', language: 'en' }, [
    { type: 'chapter' as const, id: 'c1', number: 1, title: 'One', content: blocks, createdAt: now, updatedAt: now },
  ]);
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, getTheme('classic')));
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);
  const result = await new PDFRenderer().render(paginated, { language: 'en' });
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, name);
  writeFileSync(path, result.output);
  console.log(`${name}: ${result.metrics.pageCount} pages -> ${path}`);
}

await render(true, 'with-dropcaps.pdf');
await render(false, 'without-dropcaps.pdf');
