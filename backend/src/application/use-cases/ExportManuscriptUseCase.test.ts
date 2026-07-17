import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { ExportManuscriptUseCase } from './ExportManuscriptUseCase';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { HtmlNormalizer } from '../../infrastructure/normalizers/HtmlNormalizer';
import { MammothParser } from '../../infrastructure/parsers/MammothParser';
import { DOCXRenderer } from '../../infrastructure/renderers/DOCXRenderer';
import { ClassicTheme } from '../../domain/themes/ClassicTheme';
import { LetterPageLayout } from '../../domain/layouts/LetterPageLayout';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';
import type { PageLayout } from '../../domain/models/PageLayout';

function buildUseCase() {
  return new ExportManuscriptUseCase(
    new MammothParser(),
    new HtmlNormalizer(),
    new ASTBuilder(),
    new ThemeEngine(),
    new TypographyResolver(),
    new LayoutEngine(),
    new DOCXRenderer()
  );
}

async function extractDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('word/document.xml missing from generated docx');
  return doc.async('string');
}

describe('ExportManuscriptUseCase', () => {
  describe('Cas nominal', () => {
    it('exporte un DOCX simple en .docx valide', async () => {
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });
      const useCase = buildUseCase();

      const result = await useCase.execute({
        buffer,
        filename: 'manuscript.docx',
        themeName: 'classic',
        pageLayout: LetterPageLayout,
      });

      expect(result.length).toBeGreaterThan(0);
      const xml = await extractDocumentXml(result);
      expect(xml).toContain('<?xml');
    });

    it('conserve le contenu du chapitre dans le docx généré', async () => {
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello world.'] });
      const useCase = buildUseCase();

      const result = await useCase.execute({
        buffer,
        filename: 'manuscript.docx',
        themeName: 'classic',
        pageLayout: LetterPageLayout,
      });

      const xml = await extractDocumentXml(result);
      expect(xml).toContain('Chapter One');
      expect(xml).toContain('Hello world.');
    });
  });

  describe("Cas d'erreur", () => {
    it('rejette un thème inconnu', async () => {
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Body.'] });
      const useCase = buildUseCase();

      await expect(
        useCase.execute({ buffer, filename: 'm.docx', themeName: 'nonexistent', pageLayout: LetterPageLayout })
      ).rejects.toThrow(/Unknown theme/);
    });

    it('rejette un DOCX corrompu', async () => {
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

  describe('Cas métier', () => {
    it('applique le thème demandé (police du thème présente dans le docx)', async () => {
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Body.'] });
      const useCase = buildUseCase();

      const result = await useCase.execute({
        buffer,
        filename: 'm.docx',
        themeName: 'classic',
        pageLayout: LetterPageLayout,
      });

      const xml = await extractDocumentXml(result);
      expect(xml).toContain(ClassicTheme.fonts.body);
    });

    it('génère plusieurs sauts de page pour un contenu qui dépasse une page', async () => {
      const paragraphs = Array.from({ length: 100 }, () => 'word '.repeat(60));
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs });
      const useCase = buildUseCase();
      const smallPageLayout: PageLayout = { ...LetterPageLayout, height: 300 };

      const result = await useCase.execute({
        buffer,
        filename: 'm.docx',
        themeName: 'classic',
        pageLayout: smallPageLayout,
      });

      const xml = await extractDocumentXml(result);
      const breakCount = (xml.match(/<w:pageBreakBefore\/>/g) ?? []).length;
      expect(breakCount).toBeGreaterThan(0);
    });
  });
});
