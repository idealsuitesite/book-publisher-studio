import type { Book, FrontMatter, TitlePage, CopyrightPage } from '../models/Book';

/**
 * Builds the front matter a professional book requires — a title page and a copyright page —
 * from metadata the `Book` already carries.
 *
 * Why this exists: `FrontMatter` (title page, copyright page, dedication, TOC, preface,
 * foreword, introduction, acknowledgments) has been fully typed since Sprint 1 and, apart from
 * `toc`, entirely unconsumed. `ASTBuilder` sets `frontMatter: {}` on every import and nothing
 * ever fills it. The practical consequence is that **every book this software has exported
 * opens directly on Chapter 1** — no title page, no copyright page, no ISBN, no rights notice.
 * That is the difference between a converted document and a publishable book, and it is the
 * gap behind the request for professional-grade output.
 *
 * Read-only by construction (ADR-0001, ADR-0027's discipline): this never mutates `Book`. It
 * returns a new `FrontMatter`, and the caller decides what to do with it.
 *
 * Deliberately conservative: a field is emitted only when the metadata to fill it genuinely
 * exists. A copyright page asserting "© undefined" or an ISBN line reading "ISBN: " is worse
 * than no line at all, because it looks authored. Missing metadata stays missing and stays
 * visible in the validation report, which is already what tells the author to supply it.
 */
export class FrontMatterBuilder {
  /**
   * Returns front matter derived from the book's metadata, preserving anything already present.
   * Existing entries always win — a hand-authored title page is never overwritten by a
   * generated one.
   */
  build(book: Book): FrontMatter {
    const existing = book.frontMatter;

    return {
      ...existing,
      titlePage: existing.titlePage ?? this.buildTitlePage(book),
      copyrightPage: existing.copyrightPage ?? this.buildCopyrightPage(book),
    };
  }

  private buildTitlePage(book: Book): TitlePage | undefined {
    const { title, subtitle, author } = book.metadata;

    // A title page needs a real title (FOUNDER_TRAVERSAL defect 2). The two former fallbacks —
    // 'Untitled' and 'Unknown author' — are removed together in the same change: neutralising
    // only the ASTBuilder default would just move the invention down one floor to here. `title`
    // is the filename stand-in and is present in practice; `author` prints only when it exists.
    if (!title?.trim()) return undefined;

    return {
      title: title.trim(),
      subtitle: subtitle?.trim() || undefined,
      author: author?.trim() || undefined,
    };
  }

  private buildCopyrightPage(book: Book): CopyrightPage | undefined {
    const { copyright, author, publicationDate, isbn, publisher, license, rights } = book.metadata;

    // `text` is the only required field on CopyrightPage, so a copyright line must exist for
    // the page to be worth emitting. Derived from the author and year when not supplied
    // explicitly - the near-universal convention, and better than omitting the page entirely
    // from a book that clearly has an author.
    const year = publicationDate ? new Date(publicationDate).getFullYear() : undefined;
    const derived = author?.trim() ? `© ${year ?? new Date().getFullYear()} ${author.trim()}` : undefined;
    const text = copyright?.trim() || derived;

    if (!text) return undefined;

    const legalParts = [
      publisher?.trim() ? `Published by ${publisher.trim()}` : undefined,
      rights?.trim(),
      license?.trim() ? `Licensed under ${license.trim()}` : undefined,
    ].filter(Boolean);

    return {
      text,
      isbn: isbn?.trim() || undefined,
      copyrightText: copyright?.trim() || undefined,
      legalNotice: legalParts.length > 0 ? legalParts.join(' · ') : undefined,
    };
  }
}
