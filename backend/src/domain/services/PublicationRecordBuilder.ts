import type { Project } from '../models/Project';

/**
 * One publication attempt, flattened for an author to keep.
 *
 * Deliberately not a `PublicationEvent`: this is a record handed to a person, so it carries the
 * book's identity at the time and resolves the version reference into a number an author can
 * recognise. Ids that only mean something inside this system are left out.
 */
export interface PublicationRecordEntry {
  target: string;
  status: 'PASS' | 'FAIL';
  occurredAt: Date;
  /** The version number that produced it, when the attempt was linked to one. */
  versionNumber?: number;
  summary: string;
}

export interface PublicationRecord {
  projectName: string;
  bookTitle: string;
  // Optional (FOUNDER_TRAVERSAL defect 2): the record carries the book's real author or none.
  author?: string;
  isbn?: string;
  generatedAt: Date;
  entries: PublicationRecordEntry[];
}

/**
 * Builds the record of what an author actually published, for them to keep.
 *
 * Exists because of the one thing genuine deletion costs (ADR-0044): deleting a project destroys
 * the history of publications that really happened. The resolution is not to retain data the
 * author asked us to erase — **we own the offer, not the retention.** Handing them the record and
 * then deleting is both honest and complete; keeping a copy "for their benefit" is the pattern
 * that turns a deletion feature into indefinite storage.
 *
 * Built even though deletion is not offered in the UI yet, for two reasons: an author's own
 * publication history is a legitimate thing to read on its own terms, and this must exist before
 * a delete button can ever be offered, so building it now is what keeps that decision cheap.
 *
 * Format-agnostic on purpose (Decision 5). This returns data; whether it becomes JSON, PDF or a
 * printed page is a Presentation choice, and putting a format here would drag file concerns into
 * the Domain.
 */
export class PublicationRecordBuilder {
  build(project: Project, now: Date = new Date()): PublicationRecord {
    const versionNumbers = new Map(project.versions.map((v) => [v.id, v.number]));

    return {
      projectName: project.name,
      bookTitle: project.book.metadata.title,
      author: project.book.metadata.author,
      isbn: project.book.metadata.isbn,
      generatedAt: now,
      // Chronological: this is read as a history, not as a library listing, so oldest first is
      // the order that makes it a story rather than a table.
      entries: [...project.publications]
        .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
        .map((event) => ({
          target: event.target,
          status: event.report.status,
          occurredAt: event.occurredAt,
          versionNumber: event.versionId ? versionNumbers.get(event.versionId) : undefined,
          summary: event.report.summary,
        })),
    };
  }

  /**
   * True when deleting this project would destroy the record of a real, successful publication.
   *
   * The trigger for offering the export before a destructive delete. Failures alone do not
   * qualify: an author deleting a project that never successfully published is discarding an
   * attempt, not a publication history.
   */
  hasRecordWorthKeeping(project: Project): boolean {
    return project.publications.some((event) => event.report.status === 'PASS');
  }
}
