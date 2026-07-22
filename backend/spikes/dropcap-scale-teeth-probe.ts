/**
 * Teeth probe for `dropCapCapability.test.ts` §3.1 (MINI_DR_DROP_CAPS §6 commit 3).
 *
 * The instrument's geometric assertion exists for the direction `unplannedPageBreaks` cannot
 * see: a model pricing the DECLARED scale while the renderer still draws the 2.5 constant is an
 * OVERCHARGE — pages come out underfull, no unplanned break fires. This probe proves the
 * assertion has teeth by simulating exactly that failure: the book is paginated under a
 * scale-5 theme, then the renderer is handed a tampered copy whose theme says 2.5 (the renderer
 * reads `styledBook.theme`). If the band origins land BELOW the scale-5 bound, the committed
 * test would fail loudly on such a defect — which is the claim being verified.
 *
 * Run: npx tsx backend/spikes/dropcap-scale-teeth-probe.ts
 */
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP5x8PageLayout } from '../src/domain/layouts/KDP5x8PageLayout';
import { createBook } from '../src/domain/models/Book';
import type { Theme } from '../src/domain/models/Theme';

const themed = (scale: number): Theme => ({
  ...getTheme('classic'),
  name: 'probe',
  presentation: { dropCap: { scope: 'chapterOpening', scale } },
});

const now = new Date();
const book = createBook({ title: 'P', author: 'T', language: 'en' }, [
  {
    type: 'chapter',
    id: 'c1',
    number: 1,
    title: 'One',
    createdAt: now,
    updatedAt: now,
    content: Array.from({ length: 10 }, (_, i) => ({
      type: 'paragraph' as const,
      id: `p${i}`,
      text: 'Every paragraph here carries the same measured words for the probe to isolate the drop cap.',
      dropCap: true as const,
    })),
  },
]);

async function run(): Promise<void> {
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, themed(5)));
  const paginated = new LayoutEngine(new PdfKitTextMeasurer()).paginate(typeset, KDP5x8PageLayout);
  // TAMPER: the renderer sees a 2.5 theme while the plan charged 5 — the simulated defect.
  const tampered = { ...paginated, styledBook: { ...paginated.styledBook, theme: themed(2.5) } };
  const rendered = await new PDFRenderer({ compress: false }).render(tampered, { language: 'en' });

  const margin = KDP5x8PageLayout.marginLeft;
  const glyphWidthAt5 = new PdfKitTextMeasurer().measureWidth('E', { fontSize: 11 * 5, heading: true, theme: themed(5) });
  const origins = [...rendered.output.toString('latin1').matchAll(/1 0 0 1 ([\d.]+) [\d.]+ Tm/g)].map((m) => Number(m[1]));
  const indented = origins.filter((x) => x > margin + 1);
  const belowBound = indented.filter((x) => x < margin + glyphWidthAt5);

  console.log(
    `unplanned=${rendered.metrics.unplannedPageBreaks} (blind to overcharge, as expected) | ` +
      `indented origins=${indented.length}, below the scale-5 bound=${belowBound.length} ` +
      `(bound=${(margin + glyphWidthAt5).toFixed(1)}pt, sample=${indented
        .slice(0, 3)
        .map((x) => x.toFixed(1))
        .join(', ')})`
  );
  console.log(
    belowBound.length > 0
      ? 'TEETH CONFIRMED: on a 2.5-drawing renderer the committed geometric assertion FAILS loudly.'
      : 'NO TEETH: the assertion would still pass on the simulated defect — the instrument must be rethought.'
  );
}
void run();
