import { describe, it, expect } from 'vitest';
import { ImportManuscriptUseCase } from './ImportManuscriptUseCase';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { createValidationEngine } from '../../domain/services/validation/createValidationEngine';
import { BookMetricsCalculator } from '../../domain/services/BookMetricsCalculator';
import { BookMapper } from '../mappers/BookMapper';
import { HtmlNormalizer } from '../../infrastructure/normalizers/HtmlNormalizer';
import { MammothParser } from '../../infrastructure/parsers/MammothParser';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';
import type { DocumentParser } from '../../domain/ports/DocumentParser';
import type { ChapterDTO } from '../dto/ChapterDTO';

class StubParser implements DocumentParser {
  constructor(private html: string) {}
  async parse() {
    return { html: this.html };
  }
}

class FailingParser implements DocumentParser {
  async parse(): Promise<never> {
    throw new Error('boom');
  }
}

function buildUseCase(parser: DocumentParser = new MammothParser()) {
  return new ImportManuscriptUseCase(
    parser,
    new HtmlNormalizer(),
    new ASTBuilder(),
    createValidationEngine(),
    new BookMetricsCalculator(),
    new BookMapper()
  );
}

describe('ImportManuscriptUseCase', () => {
  describe('Cas nominal', () => {
    it('importe un DOCX simple avec succès', async () => {
      const buffer = await buildTestDocxBuffer({
        heading: 'Chapter One',
        paragraphs: ['Hello world.'],
      });
      const useCase = buildUseCase();

      const response = await useCase.execute({
        buffer,
        filename: 'manuscript.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      expect(response.report.status).toBe('success');
      expect(response.book.mainContent[0].type).toBe('chapter');
    });

    it('importe un DOCX complexe avec chapitres multiples', async () => {
      const html = '<h1>Chapter One</h1><p>First.</p><h1>Chapter Two</h1><p>Second.</p>';
      const useCase = buildUseCase(new StubParser(html));

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: 'm.docx',
        mimeType: 'x',
      });

      expect(response.book.mainContent).toHaveLength(2);
      expect(response.report.statistics.chapters).toBe(2);
    });

    it('importe un DOCX avec images', async () => {
      const html = '<h1>Chapter One</h1><img src="cover.png" alt="Cover" />';
      const useCase = buildUseCase(new StubParser(html));

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: 'm.docx',
        mimeType: 'x',
      });

      expect(response.report.statistics.images).toBe(1);
    });

    it('importe un DOCX avec tableaux', async () => {
      const html =
        '<h1>Chapter One</h1><table><tr><th>Name</th></tr><tr><td>Alexandre</td></tr></table>';
      const useCase = buildUseCase(new StubParser(html));

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: 'm.docx',
        mimeType: 'x',
      });

      expect(response.report.statistics.tables).toBe(1);
    });
  });

  describe("Cas d'erreur", () => {
    it('signale un livre vide avec un statut error', async () => {
      const buffer = await buildTestDocxBuffer({});
      const useCase = buildUseCase();

      const response = await useCase.execute({ buffer, filename: 'empty.docx', mimeType: 'x' });

      expect(response.report.status).toBe('error');
      expect(response.report.errors).toContain('Book has no content');
    });

    it('rejette un DOCX corrompu', async () => {
      const useCase = buildUseCase();

      await expect(
        useCase.execute({
          buffer: Buffer.from('not a docx file'),
          filename: 'bad.docx',
          mimeType: 'x',
        })
      ).rejects.toThrow(/Failed to parse DOCX/);
    });

    it('propage une erreur du parser', async () => {
      const useCase = buildUseCase(new FailingParser());

      await expect(
        useCase.execute({ buffer: Buffer.from(''), filename: 'm.docx', mimeType: 'x' })
      ).rejects.toThrow('boom');
    });

    it('signale un titre manquant comme erreur de validation', async () => {
      const useCase = buildUseCase(new StubParser('<h1>Chapter One</h1><p>Body.</p>'));

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: '',
        mimeType: 'x',
      });

      expect(response.report.errors).toContain('Book title is required');
    });
  });

  describe('Cas métier', () => {
    it('extrait correctement les métadonnées', async () => {
      const useCase = buildUseCase(new StubParser('<h1>Chapter One</h1><p>Body.</p>'));

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: 'my-manuscript.docx',
        mimeType: 'x',
      });

      expect(response.book.metadata.title).toBe('my-manuscript.docx');
    });

    it('compte correctement les chapitres', async () => {
      const html =
        '<h1>Chapter One</h1><p>A</p><h1>Chapter Two</h1><p>B</p><h1>Chapter Three</h1><p>C</p>';
      const useCase = buildUseCase(new StubParser(html));

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: 'm.docx',
        mimeType: 'x',
      });

      expect(response.report.statistics.chapters).toBe(3);
    });

    it('génère un rapport complet', async () => {
      const useCase = buildUseCase(new StubParser('<h1>Chapter One</h1><p>Some words here.</p>'));

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: 'my-manuscript.docx',
        mimeType: 'x',
      });

      // Sprint 5: warnings is no longer empty here on purpose - ASTBuilder
      // never populates isbn/description/coverImage from DOCX content, so
      // MetadataRule/ComplianceRule now genuinely (and correctly) flag this
      // as an incomplete manuscript. errors stays empty since none of that
      // is ERROR-severity - the book is still successfully importable.
      expect(response.report.status).toBe('success');
      expect(response.report.statistics).toEqual({ chapters: 1, images: 0, tables: 0, words: expect.any(Number) });
      expect(response.report.errors).toEqual([]);
      expect(response.report.warnings.length).toBeGreaterThan(0);
      expect(response.report.issues).toHaveLength(response.report.warnings.length);
      expect(response.report.issues.every((issue) => issue.severity === 'WARNING')).toBe(true);
      expect(response.report.score.overall).toBeLessThan(100);
      expect(response.report.score.overall).toBeGreaterThanOrEqual(0);
    });

    it('calcule les métriques de lecture', async () => {
      const words = new Array(250).fill('word').join(' ');
      const useCase = buildUseCase(new StubParser(`<h1>Chapter One</h1><p>${words}</p>`));

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: 'm.docx',
        mimeType: 'x',
      });

      expect(response.book.wordCount).toBe(252);
      expect(response.book.readingTime).toBe(2);
    });

    it('préserve la structure hiérarchique', async () => {
      const useCase = buildUseCase(
        new StubParser('<h1>Chapter One</h1><h2>Section A</h2><p>Body.</p>')
      );

      const response = await useCase.execute({
        buffer: Buffer.from(''),
        filename: 'm.docx',
        mimeType: 'x',
      });
      const chapter = response.book.mainContent[0] as ChapterDTO;

      expect(chapter.type).toBe('chapter');
      expect(chapter.sections?.[0].title).toBe('Section A');
    });
  });
});
