import type { BookDTO, BlockDTO, ContentDTO, ImportReportDTO, ValidationIssueDTO, ProjectDTO } from 'shared-types';
import { classifyEditorialTitle, type DetectedEditorialPart } from './editorialParts';

/**
 * The key that drives the living Proof's re-ink (PreviewPanel). It must change whenever the
 * rendered book would change: layout, theme, OR a structure edit (STRUCTURE_EDITING_PHASE3.md D5).
 * The structure token is `updatedAt`, not `versions.length`, because undo (`restoreVersion`)
 * mutates the book without taking a snapshot — `updatedAt` advances on every book mutation, so
 * switching to the Proof after a reorder/rename/undo shows the new content with no manual re-export.
 */
export function proofRefreshKey(project: ProjectDTO): string {
  // Includes accentOverride so a shade change re-inks the Proof on its OWN signal, not merely as a
  // side effect of updatedAt — closing the D5 stale-Proof risk explicitly (MINI_DR_PER_THEME_ACCENT,
  // the same class as the undo-vs-versions.length trap in STRUCTURE_EDITING_PHASE3).
  return `${project.settings.layoutName}/${project.settings.themeName}/${project.settings.accentOverride ?? ''}/${project.updatedAt}`;
}

/**
 * The book's body, counted from the real AST (PRODUCT_EXPERIENCE §10.6: the Explorer as living
 * inventory). Everything here is derived client-side from what the import already produced —
 * no endpoint invented for numbers the payload carries.
 */
export interface BookFacts {
  chapters: number;
  sections: number;
  images: number;
  /** Quote + scripture blocks — the manuscript's citations. */
  citations: number;
  footnotes: number;
  tables: number;
  /**
   * Top-level parts recognised as editorial (preface/introduction/bibliography/…) by canonical
   * title (MINI_DR_EDITORIAL_PARTS). These are EXCLUDED from `chapters` above — that is the
   * miscount fix: faith-alone reports 15 chapters + 2 editorial parts, not "17 ch". Presentation
   * only; the Book is unchanged, the export is unchanged (§6).
   */
  editorialParts: DetectedEditorialPart[];
}

/**
 * The ADR-0049 state, read from the REAL report — the UI never re-derives it from counts
 * (a small chapterless document is legitimate; only the validator knows the threshold).
 * Every surface that shows chapter counts consults this: Explorer, status bar, Structure
 * station (IMPORT_FIDELITY.md commit 2).
 */
export function unstructuredFinding(report: ImportReportDTO): ValidationIssueDTO | undefined {
  return report.issues.find((issue) => issue.code === 'UNSTRUCTURED_MANUSCRIPT');
}

/**
 * Words in ONE chapter/section, nested sections included — the per-part figure Reedsy shows in
 * its sidebar (EXPLORER_PARITY.md §4, the one gap the CTO approved for immediate build: a
 * client-side walk, zero backend). Same tokenization as the global count: split on whitespace.
 */
export function countContentWords(content: ContentDTO): number {
  let words = 0;
  for (const block of content.content ?? []) {
    if ('text' in block && typeof block.text === 'string') {
      words += block.text.trim() ? block.text.trim().split(/\s+/).length : 0;
    } else if (block.type === 'list') {
      for (const item of block.items ?? []) {
        words += item.trim() ? item.trim().split(/\s+/).length : 0;
      }
    }
  }
  const children = content.type === 'chapter' ? content.sections : content.subsections;
  for (const child of children ?? []) words += countContentWords(child as ContentDTO);
  return words;
}

export function computeBookFacts(book: BookDTO): BookFacts {
  const facts: BookFacts = { chapters: 0, sections: 0, images: 0, citations: 0, footnotes: 0, tables: 0, editorialParts: [] };

  const countBlocks = (blocks: BlockDTO[] | undefined): void => {
    for (const block of blocks ?? []) {
      if (block.type === 'image') facts.images += 1;
      else if (block.type === 'quote' || block.type === 'scripture') facts.citations += 1;
      else if (block.type === 'footnote') facts.footnotes += 1;
      else if (block.type === 'table') facts.tables += 1;
    }
  };

  // An editorial part's own images/citations/footnotes/tables are still real content facts, so its
  // blocks are counted deep — only its identity as a chapter/section is withheld.
  const countBlocksDeep = (content: ContentDTO): void => {
    countBlocks(content.content);
    const children = content.type === 'chapter' ? content.sections : content.subsections;
    for (const child of children ?? []) countBlocksDeep(child as ContentDTO);
  };

  // Classification is TOP-LEVEL only (MINI_DR_EDITORIAL_PARTS): a canonical title nested inside a
  // chapter is ordinary content, only a top-level part is an editorial part. A recognised part is
  // recorded and excluded from the chapter/section count — the miscount fix — but its blocks still
  // count. Everything else keeps the exact previous logic.
  for (const content of book.mainContent) {
    const category = classifyEditorialTitle(content.title);
    if (category) {
      facts.editorialParts.push({
        key: category.key,
        label: category.label,
        placement: category.placement,
        detectedTitle: content.title,
      });
      countBlocksDeep(content);
      continue;
    }
    if (content.type === 'chapter') {
      facts.chapters += 1;
      countBlocks(content.content);
      for (const section of content.sections ?? []) {
        facts.sections += 1;
        countBlocks(section.content);
        for (const sub of section.subsections ?? []) {
          facts.sections += 1;
          countBlocks(sub.content);
        }
      }
    } else {
      facts.sections += 1;
      countBlocks(content.content);
    }
  }
  return facts;
}
