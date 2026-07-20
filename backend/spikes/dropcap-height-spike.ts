/**
 * Drop-cap HEIGHT measurement spike (MINI_DR_DROP_CAPS.md §3.1).
 *
 * The CTO's directing principle for this capability: the charged property must equal the REAL
 * measurement against the renderer -- never arithmetic derived from DROP_CAP_SCALE. This is the
 * lesson of the list-prefix under-charge, where the plausible naive estimate made drift WORSE.
 *
 * So: render the SAME book twice through the REAL pipeline, once with drop caps and once without,
 * and read the real numbers back. If the model does not price the drop cap (it does not --
 * estimateBlockHeight never mentions dropCap), the under-charge shows up as unplanned
 * reconciliations, because PDFKit draws taller than the model charged.
 *
 *   npx tsx spikes/dropcap-height-spike.ts
 */
import { ThemeEngine } from '../src/domain/services/ThemeEngine';
import { TypographyResolver } from '../src/domain/services/TypographyResolver';
import { LayoutEngine } from '../src/domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../src/infrastructure/fonts/PdfKitTextMeasurer';
import { PDFRenderer } from '../src/infrastructure/renderers/PDFRenderer';
import { getTheme } from '../src/domain/themes/getTheme';
import { KDP5x8PageLayout } from '../src/domain/layouts/KDP5x8PageLayout';
import { createBook } from '../src/domain/models/Book';
import type { Paragraph } from '../src/domain/models/Book';

const PARAGRAPH_COUNT = 120;
const TEXT =
  'Every paragraph in this measurement carries the same words so that the only variable left ' +
  'between the two runs is the drop cap itself, which is exactly what has to be isolated here.';

async function run(dropCap: boolean) {
  const now = new Date();
  const blocks: Paragraph[] = Array.from({ length: PARAGRAPH_COUNT }, (_, i) => ({
    type: 'paragraph' as const,
    id: `p${i}`,
    text: TEXT,
    inlines: [],
    ...(dropCap ? { dropCap: true } : {}),
  }));

  const book = createBook({ title: 'Drop Cap Height', author: 'Measurement', language: 'en' }, [
    { type: 'chapter' as const, id: 'c1', number: 1, title: 'One', content: blocks, createdAt: now, updatedAt: now },
  ]);

  const theme = getTheme('classic');
  const measurer = new PdfKitTextMeasurer();
  const typeset = new TypographyResolver().resolve(new ThemeEngine().applyTheme(book, theme));
  const paginated = new LayoutEngine(measurer).paginate(typeset, KDP5x8PageLayout);
  const result = await new PDFRenderer().render(paginated, { language: 'en' });

  const resolvedDropCaps = Object.values(typeset.blockTypography ?? {}).filter((t) => t.dropCap).length;

  return {
    label: dropCap ? 'WITH drop caps' : 'without drop caps',
    resolvedDropCaps,
    modelPages: paginated.pages.length,
    realPages: result.metrics.pageCount,
    unplanned: result.metrics.unplannedPageBreaks,
  };
}

async function main() {
  const plain = await run(false);
  const dropped = await run(true);

  for (const r of [plain, dropped]) {
    console.log(
      `${r.label}\n  drop caps resolved: ${r.resolvedDropCaps} | model pages: ${r.modelPages} | REAL pages: ${r.realPages} | unplanned: ${r.unplanned}`
    );
  }

  const extraRealPages = (dropped.realPages ?? 0) - (plain.realPages ?? 0);
  const modelDelta = dropped.modelPages - plain.modelPages;
  console.log(`\n=== VERDICT (${PARAGRAPH_COUNT} paragraphs) ===`);
  console.log(`model charged ${modelDelta} extra page(s) for the drop caps.`);
  console.log(`the renderer really consumed ${extraRealPages} extra page(s).`);
  console.log(`unplanned reconciliations: ${plain.unplanned} -> ${dropped.unplanned}`);
  console.log(
    modelDelta === 0 && (extraRealPages > 0 || (dropped.unplanned ?? 0) > (plain.unplanned ?? 0))
      ? '\nCONFIRMED: the model charges NOTHING for a drop cap while the renderer really consumes height.'
      : '\nSee numbers above.'
  );
}

void main();
