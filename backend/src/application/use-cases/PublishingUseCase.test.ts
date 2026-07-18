import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublishingUseCase } from './PublishingUseCase';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { HtmlNormalizer } from '../../infrastructure/normalizers/HtmlNormalizer';
import { MammothParser } from '../../infrastructure/parsers/MammothParser';
import { PDFRenderer } from '../../infrastructure/renderers/PDFRenderer';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { createKDPTarget } from '../../domain/services/publishing/createKDPTarget';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

const __dirname = dirname(fileURLToPath(import.meta.url));

function buildUseCase() {
  return new PublishingUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    new LayoutEngine(),
    new PDFRenderer(),
    createKDPTarget()
  );
}

describe('PublishingUseCase', () => {
  describe('Cas nominal', () => {
    it('produit un vrai PublishingReport pour un DOCX simple, cible kdp', async () => {
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });
      const useCase = buildUseCase();

      const report = await useCase.execute({
        buffer,
        filename: 'manuscript.docx',
        themeName: 'classic',
        pageLayout: LetterPageLayout,
      });

      expect(report.target).toBe('kdp');
      expect(report.artifacts).toEqual(['pdf']);
      expect(['PASS', 'FAIL']).toContain(report.status);
    });

    it('rapporte le manque réel de métadonnées (ISBN) pour un DOCX sans ISBN, pas un succès fabriqué', async () => {
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });
      const useCase = buildUseCase();

      const report = await useCase.execute({
        buffer,
        filename: 'manuscript.docx',
        themeName: 'classic',
        pageLayout: LetterPageLayout,
      });

      expect(report.status).toBe('FAIL');
      expect(report.issues.some((i) => i.code === 'MISSING_REQUIRED_METADATA')).toBe(true);
    });
  });

  describe("Cas d'erreur", () => {
    it('rejette un thème inconnu, comme ExportManuscriptUseCase', async () => {
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Body.'] });
      const useCase = buildUseCase();

      await expect(
        useCase.execute({ buffer, filename: 'm.docx', themeName: 'nonexistent', pageLayout: LetterPageLayout })
      ).rejects.toThrow(/Unknown theme/);
    });

    it('rejette un DOCX corrompu, comme ExportManuscriptUseCase', async () => {
      const useCase = buildUseCase();

      await expect(
        useCase.execute({
          buffer: Buffer.from('not a docx file'),
          filename: 'bad.docx',
          themeName: 'classic',
          pageLayout: LetterPageLayout,
        })
      ).rejects.toThrow(/Failed to parse DOCX/);
    });
  });

  // Real-fixture regression, same discipline as ExportManuscriptUseCase.test.ts's own
  // typography-test.docx check - a real canonical manuscript through the real full pipeline,
  // ending in a real PublishingReport, not a hand-built PublishingReport fixture.
  describe('Real fixture regression (typography-test.docx, docs/REAL_FIXTURE_POLICY.md)', () => {
    it('produces a real PublishingReport for the canonical verification fixture', async () => {
      const buffer = readFileSync(join(__dirname, '..', '..', '..', 'verification', 'typography-test.docx'));
      const useCase = buildUseCase();

      const report = await useCase.execute({
        buffer,
        filename: 'typography-test.docx',
        themeName: 'classic',
        pageLayout: LetterPageLayout,
      });

      expect(report.target).toBe('kdp');
      expect(report.artifacts).toEqual(['pdf']);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
