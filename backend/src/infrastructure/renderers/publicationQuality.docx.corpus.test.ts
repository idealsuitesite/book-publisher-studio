/**
 * verify-publication-quality — DOCX §4, the ready-now slice, against the real corpus.
 *
 * PUBLICATION_QUALITY_BAR.md §4 defines ten DOCX acceptance criteria. Five are verifiable AS
 * WRITTEN against the real import corpus today; five are not (tables/images/hyperlinks unexercised
 * by the corpus, footnotes rendered inline, underline dropped at import) and await CTO decisions
 * on their proxies — see docs/architecture/diagrams/VERIFY_PUBLICATION_QUALITY.md.
 *
 * This file implements the criteria that are BOTH corpus-covered AND honestly assertable, on a real
 * corpus manuscript run through the real import→export pipeline (the same wiring as app.ts). It is
 * the seed of the eventual `verify-publication-quality` harness (§9); starting it as a test file
 * honours §3 ("every criterion must correspond to an assertion in a test file, not a sentence in a
 * README") and keeps it deterministic and CI-safe.
 *
 * NOT covered here, and WHY (measured, not assumed):
 *  - §4 colours: the only shipped theme (Classic) is all-black (accent === text === #000000), so a
 *    black FALLBACK is indistinguishable from the theme's real black. The criterion cannot fail for
 *    the right reason on Classic; it needs a non-black theme to be meaningful (VERIFY_PUBLICATION_
 *    QUALITY.md). Deliberately not asserted rather than asserted dishonestly.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { MammothParser } from '../parsers/MammothParser';
import { HtmlNormalizer } from '../normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { PdfKitTextMeasurer } from '../fonts/PdfKitTextMeasurer';
import { DOCXRenderer } from './DOCXRenderer';
import { ExportManuscriptUseCase } from '../../application/use-cases/ExportManuscriptUseCase';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { getTheme } from '../../domain/themes/getTheme';

const CORPUS_FILE = 'faith-alone-styled.docx';
const CORPUS_PATH = join(__dirname, '..', '..', '..', 'verification', 'corpus', CORPUS_FILE);

/** The real import→export pipeline, composed exactly as presentation/app.ts composes it. */
function exportDocxUseCase(): ExportManuscriptUseCase {
  return new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    new LayoutEngine(new PdfKitTextMeasurer()),
    new DOCXRenderer()
  );
}

describe('Publication quality — DOCX §4 (ready-now slice, real corpus)', () => {
  let stylesXml: string;
  let documentXml: string;

  beforeAll(async () => {
    const buffer = readFileSync(CORPUS_PATH);
    const output = await exportDocxUseCase().execute({
      buffer,
      filename: CORPUS_FILE,
      themeName: 'classic',
      pageLayout: LetterPageLayout,
    });
    const zip = await JSZip.loadAsync(output);
    stylesXml = await zip.file('word/styles.xml')!.async('string');
    documentXml = await zip.file('word/document.xml')!.async('string');
  }, 30_000);

  it('§4.8 — the exported DOCX declares the theme fonts, no silent substitution to a default face', () => {
    const theme = getTheme('classic');
    // Classic: heading and body are both Georgia. The renderer must put the THEME font into the
    // heading style definitions (buildHeadingStyles) and the body runs (renderBlock) — not leave
    // Word's default face to stand in silently. Georgia is distinguishable from any default here
    // (unlike the colour, which is #000000 and therefore not).
    expect(theme.fonts.heading).toBe('Georgia');
    expect(theme.fonts.body).toBe('Georgia');
    // Heading style definitions carry the theme heading font.
    expect(stylesXml).toContain(theme.fonts.heading);
    // Body text runs carry the theme body font — proven on a real 17-chapter manuscript.
    expect(documentXml).toContain(theme.fonts.body);
  });
});
