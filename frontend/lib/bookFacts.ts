import type { BookDTO, BlockDTO, ContentDTO, ImportReportDTO, ValidationIssueDTO } from 'shared-types';

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

export function computeBookFacts(book: BookDTO): BookFacts {
  const facts: BookFacts = { chapters: 0, sections: 0, images: 0, citations: 0, footnotes: 0, tables: 0 };

  const countBlocks = (blocks: BlockDTO[] | undefined): void => {
    for (const block of blocks ?? []) {
      if (block.type === 'image') facts.images += 1;
      else if (block.type === 'quote' || block.type === 'scripture') facts.citations += 1;
      else if (block.type === 'footnote') facts.footnotes += 1;
      else if (block.type === 'table') facts.tables += 1;
    }
  };

  const walk = (contents: ContentDTO[]): void => {
    for (const content of contents) {
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
  };
  walk(book.mainContent);
  return facts;
}
