/**
 * Q3 proof: project export renders the STORED front matter, and the project path no longer
 * synthesises it (STRUCTURE_EDITING.md Q3, ADR-0052's sibling commit).
 *
 * Front matter used to be re-invented on every export from the book's metadata. Since Q3 it is
 * populated once at import and stored as user content; the export/publish paths render exactly
 * what is stored — nothing more, nothing less. This suite pins both halves of that on a real
 * import + real DOCX render:
 *   1. what import stored is what the export shows;
 *   2. clear the stored front matter and the title page is GONE — proof the project path does not
 *      fall back to synthesising it (the raw-bytes /api/manuscripts/* route still does; that is
 *      covered by renderers/frontMatter.test.ts, which drives ExportManuscriptUseCase.execute).
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { ImportManuscriptUseCase } from './ImportManuscriptUseCase';
import { ExportManuscriptUseCase } from './ExportManuscriptUseCase';
import { ExportProjectUseCase } from './ExportProjectUseCase';
import { ASTBuilder } from '../../domain/services/ASTBuilder';
import { createValidationEngine } from '../../domain/services/validation/createValidationEngine';
import { BookMetricsCalculator } from '../../domain/services/BookMetricsCalculator';
import { BookMapper } from '../mappers/BookMapper';
import { ThemeEngine } from '../../domain/services/ThemeEngine';
import { TypographyResolver } from '../../domain/services/TypographyResolver';
import { LayoutEngine } from '../../domain/services/LayoutEngine';
import { HtmlNormalizer } from '../../infrastructure/normalizers/HtmlNormalizer';
import { MammothParser } from '../../infrastructure/parsers/MammothParser';
import { DOCXRenderer } from '../../infrastructure/renderers/DOCXRenderer';
import { ManualLayoutSelector } from '../../domain/services/ManualLayoutSelector';
import { InMemoryProjectRepository } from '../../infrastructure/repositories/InMemoryProjectRepository';
import { ProjectService } from '../../domain/services/ProjectService';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file('word/document.xml')!.async('string');
}

describe('project export renders stored front matter, without re-synthesising it (Q3)', () => {
  async function harness() {
    const repository = new InMemoryProjectRepository();
    const projectService = new ProjectService();
    const importUseCase = new ImportManuscriptUseCase(
      new MammothParser(),
      new HtmlNormalizer(),
      new ASTBuilder(),
      createValidationEngine(),
      new BookMetricsCalculator(),
      new BookMapper(),
      projectService,
      repository
    );
    const docxExport = new ExportManuscriptUseCase(
      new MammothParser(),
      new HtmlNormalizer(),
      new ASTBuilder(),
      new ThemeEngine(),
      new TypographyResolver(),
      new LayoutEngine(),
      new DOCXRenderer()
    );
    // Only DOCX is exercised; the same instance fills the pdf/epub slots the type requires.
    const exportProject = new ExportProjectUseCase(
      repository,
      { docx: docxExport, pdf: docxExport, epub: docxExport },
      new ManualLayoutSelector(),
      projectService
    );
    return { repository, projectService, importUseCase, exportProject };
  }

  it('shows the stored title page, then loses it entirely once the stored front matter is cleared', async () => {
    const { repository, projectService, importUseCase, exportProject } = await harness();
    const buffer = await buildTestDocxBuffer({ heading: 'Chapter One', paragraphs: ['Hello.'] });

    const imported = await importUseCase.execute({
      buffer,
      filename: 'The Stored Title.docx',
      mimeType: DOCX_MIME,
    });
    const id = imported.projectId!;

    // 1. The export shows the front matter import stored.
    const withFront = await documentXml((await exportProject.execute(id, 'docx'))!);
    expect(withFront).toContain('The Stored Title');

    // 2. Clear the stored front matter and re-export. If the project path still synthesised from
    //    metadata (title is unchanged), the title page would reappear — it must not.
    const project = (await repository.findById(id))!;
    const cleared = projectService.replaceBook(project, { ...project.book, frontMatter: {} });
    await repository.save(cleared);

    const withoutFront = await documentXml((await exportProject.execute(id, 'docx'))!);
    expect(withoutFront).not.toContain('The Stored Title');
  });
});
