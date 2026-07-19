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
import { ProjectService } from '../../domain/services/ProjectService';
import { InMemoryProjectRepository } from '../../infrastructure/repositories/InMemoryProjectRepository';

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

      // The extension is stripped: a DOCX rarely carries its own title, so the filename stands
      // in, and once front matter started rendering a title page reading "my-manuscript.docx"
      // was visibly wrong. Only the extension goes — underscores and casing are left alone,
      // since inferring an author's intended punctuation produces confident nonsense.
      expect(response.book.metadata.title).toBe('my-manuscript');
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

  // Sprint 9 detour (PRODUCT_OBJECT_MODEL.md): a successful import IS the creation of a project.
  describe('Project creation (ADR-0047)', () => {
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    function buildProjectAwareUseCase(repository: InMemoryProjectRepository) {
      let n = 0;
      return new ImportManuscriptUseCase(
        new MammothParser(),
        new HtmlNormalizer(),
        new ASTBuilder(),
        createValidationEngine(),
        new BookMetricsCalculator(),
        new BookMapper(),
        new ProjectService(() => `id-${++n}`),
        repository
      );
    }

    it('creates a project around a successful import and returns its id', async () => {
      const repository = new InMemoryProjectRepository();
      const useCase = buildProjectAwareUseCase(repository);
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });

      const response = await useCase.execute({
        buffer,
        filename: 'Le Guide de Jean.docx',
        mimeType: DOCX_MIME,
      });

      expect(response.projectId).toBeDefined();
      const project = await repository.findById(response.projectId!);
      expect(project?.name).toBe(project?.book.metadata.title);
    });

    it('retains the original upload as the source asset, byte for byte', async () => {
      const repository = new InMemoryProjectRepository();
      const useCase = buildProjectAwareUseCase(repository);
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });

      const response = await useCase.execute({
        buffer,
        filename: 'Le Guide de Jean.docx',
        mimeType: DOCX_MIME,
      });

      const project = await repository.findById(response.projectId!);
      const source = project?.assets.find((a) => a.id === project.sourceAssetId);
      expect(source?.kind).toBe('source');
      expect(source?.filename).toBe('Le Guide de Jean.docx');
      // Byte-for-byte: this is what lets a future importer fix re-read existing work
      // (AGGREGATES_AND_PERSISTENCE.md Question 5 - import is lossy today).
      expect(source?.data?.equals(buffer)).toBe(true);
    });

    it('creates NO project for a rejected import - a library of orphaned failures helps nobody', async () => {
      const repository = new InMemoryProjectRepository();
      const useCase = buildProjectAwareUseCase(repository);
      const buffer = await buildTestDocxBuffer({}); // empty book -> status 'error'

      const response = await useCase.execute({ buffer, filename: 'empty.docx', mimeType: DOCX_MIME });

      expect(response.report.status).toBe('error');
      expect(response.projectId).toBeUndefined();
      expect(await repository.list()).toEqual([]);
    });

    it('still imports normally when no project collaborators are wired - existing callers unaffected', async () => {
      const useCase = buildUseCase(); // the original 6-argument construction
      const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });

      const response = await useCase.execute({ buffer, filename: 'm.docx', mimeType: DOCX_MIME });

      expect(response.report.status).toBe('success');
      expect(response.projectId).toBeUndefined();
    });
  });

  // ADR-0049 - the CTO's Q1 decision: UNSTRUCTURED_MANUSCRIPT is an ERROR, but the import
  // still succeeds and still creates the project. Rejecting would destroy the very evidence
  // (Proof, Structure station) the author needs to understand the problem.
  describe('unstructured manuscripts stay explorable (ADR-0049)', () => {
    const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    it('imports a book-length manuscript with no headings: success, project created, error named', async () => {
      const paragraphs = Array.from({ length: 30 }, () => `<p>${'word '.repeat(100).trim()}.</p>`);
      const repository = new InMemoryProjectRepository();
      let n = 0;
      const useCase = new ImportManuscriptUseCase(
        new StubParser(paragraphs.join('')),
        new HtmlNormalizer(),
        new ASTBuilder(),
        createValidationEngine(),
        new BookMetricsCalculator(),
        new BookMapper(),
        new ProjectService(() => `id-${++n}`),
        repository
      );

      const response = await useCase.execute({ buffer: Buffer.from('x'), filename: 'notes.docx', mimeType: DOCX_MIME });

      expect(response.report.status).toBe('success');
      expect(response.projectId).toBeDefined();
      expect(response.report.statistics.chapters).toBe(0);
      const issue = response.report.issues.find((i) => i.code === 'UNSTRUCTURED_MANUSCRIPT');
      expect(issue?.severity).toBe('ERROR');
      expect(response.report.score.categories.structure).toBeLessThan(100);
    });

    it('surfaces a dropped empty heading as an import-time warning', async () => {
      const useCase = buildUseCase(new StubParser('<h1>One</h1><p>Text.</p><h1></h1><h1>Two</h1><p>More.</p>'));

      const response = await useCase.execute({ buffer: Buffer.from('x'), filename: 'book.docx', mimeType: DOCX_MIME });

      expect(response.report.warnings.some((w) => w.includes('empty Heading 1'))).toBe(true);
      expect(response.report.issues.some((i) => i.code === 'EMPTY_HEADING_DROPPED' && i.severity === 'WARNING')).toBe(true);
    });
  });
});
