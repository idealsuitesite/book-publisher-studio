import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MarginComplianceRule } from './MarginComplianceRule';
import { KDP_RULE_DATA } from './KDPRuleData';
import { createBook } from '../../models/Book';
import type { PublishingBundle } from '../../models/PublishingBundle';
import type { PageLayout } from '../../models/PageLayout';
import type { RenderMetrics } from '../../models/RenderMetrics';
import { KDP6x9PageLayout } from '../../layouts/KDP6x9PageLayout';
import { MammothParser } from '../../../infrastructure/parsers/MammothParser';
import { HtmlNormalizer } from '../../../infrastructure/normalizers/HtmlNormalizer';
import { ASTBuilder } from '../../services/ASTBuilder';
import { ThemeEngine } from '../../services/ThemeEngine';
import { TypographyResolver } from '../../services/TypographyResolver';
import { LayoutEngine } from '../../services/LayoutEngine';
import { PdfKitTextMeasurer } from '../../../infrastructure/fonts/PdfKitTextMeasurer';
import { PDFRenderer } from '../../../infrastructure/renderers/PDFRenderer';
import { PublishingUseCase } from '../../../application/use-cases/PublishingUseCase';
import { createKDPTarget } from './createKDPTarget';

const ROWS = KDP_RULE_DATA.interiorSpec.marginsByPageCount;
const rule = new MarginComplianceRule(ROWS, 'pdf');

function contextWith(metrics?: RenderMetrics) {
  const bundle: PublishingBundle = {
    manuscript: metrics ? { pdf: { bytes: Buffer.from('pdf'), metrics } } : {},
    metadata: { title: 'T', author: 'A', language: 'en' },
    assets: [],
    manifest: { formatsIncluded: metrics ? ['pdf'] : [], hasCover: false, assembledAt: new Date() },
  };
  return { book: createBook({ title: 'T', author: 'A', language: 'en' }), bundle };
}

describe('MarginComplianceRule (unit)', () => {
  it('the shipped 72pt defaults pass at a mid-table page count — accidental compliance now PROVEN', () => {
    expect(rule.evaluate(contextWith({ pageCount: 155, pageLayout: KDP6x9PageLayout }))).toEqual([]);
  });

  it('a tightened inside margin fails FOR THE RIGHT REASON — the message names the row requirement', () => {
    const tightened: PageLayout = { ...KDP6x9PageLayout, marginLeft: 30 };
    const issues = rule.evaluate(contextWith({ pageCount: 400, pageLayout: tightened }));

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INSIDE_MARGIN_BELOW_GUTTER');
    expect(issues[0].severity).toBe('ERROR');
    // 400 pages -> the 500-row: 0.625in = 45pt required; min(30, 72) = 30pt offered.
    expect(issues[0].message).toContain('30pt');
    expect(issues[0].message).toContain('45pt');
    expect(issues[0].message).toContain('0.625in');
  });

  it('a too-small top/bottom margin fails against the outside minimum', () => {
    const flat: PageLayout = { ...KDP6x9PageLayout, marginTop: 10 };
    const issues = rule.evaluate(contextWith({ pageCount: 100, pageLayout: flat }));

    expect(issues.map((i) => i.code)).toEqual(['MARGIN_BELOW_MINIMUM']);
    expect(issues[0].message).toContain('10pt'); // min(10, 72)
    expect(issues[0].message).toContain('18pt'); // 0.25in
  });

  it('row selection steps at the table boundaries (150 vs 151 pages)', () => {
    const thirty: PageLayout = { ...KDP6x9PageLayout, marginLeft: 30 };
    // 150 pages -> 0.375in = 27pt: a 30pt inside margin passes...
    expect(rule.evaluate(contextWith({ pageCount: 150, pageLayout: thirty }))).toEqual([]);
    // ...151 pages -> 0.5in = 36pt: the same margin fails.
    expect(rule.evaluate(contextWith({ pageCount: 151, pageLayout: thirty })).map((i) => i.code)).toEqual([
      'INSIDE_MARGIN_BELOW_GUTTER',
    ]);
  });

  it('missing rendered geometry yields the disclosed-unknown WARNING, never a false green', () => {
    const issues = rule.evaluate(contextWith(undefined));
    expect(issues.map((i) => i.code)).toEqual(['MARGINS_UNKNOWN']);
    expect(issues[0].severity).toBe('WARNING');
  });

  it('beyond the table (>828 pages) stays silent — PageCountRule owns that error, no double-report', () => {
    expect(rule.evaluate(contextWith({ pageCount: 900, pageLayout: KDP6x9PageLayout }))).toEqual([]);
  });
});

// REAL_FIXTURE_POLICY: a publishing change is verified against a real manuscript, not only
// hand-built contexts. The pair proves the rule both ways on the real pipeline: the shipped
// default is compliant (GUTTER_SCOPE §0's accidental compliance, now enforced-and-proven), and
// a deliberately tightened inside margin surfaces the ERROR end to end through the real
// PublishingUseCase -> KDPTarget -> SubmissionValidator chain.
describe('MarginComplianceRule on real faith-alone through the real publish pipeline', () => {
  const FAITH_ALONE = join(__dirname, '..', '..', '..', '..', 'verification', 'corpus', 'faith-alone-styled.docx');

  function buildUseCase() {
    return new PublishingUseCase(
      new MammothParser(),
      new HtmlNormalizer(),
      new ASTBuilder(),
      new ThemeEngine(),
      new TypographyResolver(),
      new LayoutEngine(new PdfKitTextMeasurer()),
      new PDFRenderer(),
      createKDPTarget()
    );
  }

  it('default kdp-6x9 margins: no margin issue; tightened inside margin: the ERROR appears', async () => {
    const buffer = readFileSync(FAITH_ALONE);
    const origWarn = console.warn;
    console.warn = () => {};

    const compliant = await buildUseCase().execute({
      buffer,
      filename: 'faith-alone-styled.docx',
      themeName: 'classic',
      pageLayout: KDP6x9PageLayout,
    });
    const marginCodes = (issues: { code: string }[]) =>
      issues.filter((i) => i.code === 'INSIDE_MARGIN_BELOW_GUTTER' || i.code === 'MARGIN_BELOW_MINIMUM' || i.code === 'MARGINS_UNKNOWN');
    expect(marginCodes(compliant.issues)).toEqual([]);

    const tightened = await buildUseCase().execute({
      buffer,
      filename: 'faith-alone-styled.docx',
      themeName: 'classic',
      pageLayout: { ...KDP6x9PageLayout, marginLeft: 20 },
    });
    console.warn = origWarn;

    const gutterIssues = tightened.issues.filter((i) => i.code === 'INSIDE_MARGIN_BELOW_GUTTER');
    expect(gutterIssues).toHaveLength(1);
    expect(gutterIssues[0].severity).toBe('ERROR');
  }, 120_000);
});
