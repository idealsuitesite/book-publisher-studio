import type { BookDTO, ValidationIssueDTO } from 'shared-types';
import { Button, Card } from '@/components/ui';

// Sprint 7 commit 6 - renders the real BookDTO a successful import returns. Deliberately no
// validation findings here (report.issues/.score) - that's ValidationSummary's job (commit 7),
// rendered as a sibling by UploadDropzone. ONE exception, by design (ADR-0049): the
// UNSTRUCTURED_MANUSCRIPT finding renders here too, because "0 chapters detected" is a fact
// ABOUT the structure this panel claims to show - hiding it behind another tab is how the
// CTO discovered the state at the Proof instead of at the door.
interface BookStructureViewProps {
  book: BookDTO;
  filename: string | null;
  onReset: () => void;
  /** The ADR-0049 finding when the report carries it - message and suggestion come from the backend, never invented here. */
  structureFinding?: ValidationIssueDTO;
}

function contentLabel(content: BookDTO['mainContent'][number]): string {
  if (content.type === 'chapter') {
    return `Chapter ${content.number}: ${content.title}`;
  }
  return content.title || 'Untitled section';
}

export function BookStructureView({ book, filename, onReset, structureFinding }: BookStructureViewProps) {
  const stats: Array<{ label: string; value: string }> = [];
  if (book.wordCount != null) stats.push({ label: 'Words', value: book.wordCount.toLocaleString() });
  if (book.pageCount != null) stats.push({ label: 'Pages', value: String(book.pageCount) });
  if (book.readingTime != null) stats.push({ label: 'Reading time', value: `${book.readingTime} min` });

  return (
    <Card tone="success" className="flex max-w-2xl flex-col gap-6 px-8 py-8 text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-app-success">Import complete</p>
          <h2 className="text-xl font-semibold text-app-text">{book.metadata.title}</h2>
          <p className="text-sm text-app-text-muted">
            {book.metadata.author} · {filename}
          </p>
        </div>
        <Button variant="link" className="shrink-0" onClick={onReset}>
          Import another file
        </Button>
      </div>

      {structureFinding && (
        <div role="alert" className="rounded-md border border-app-error bg-app-surface-2 px-4 py-3">
          <p className="text-sm font-semibold text-app-error">0 chapters detected — needs review</p>
          <p className="mt-1 text-sm text-app-text">{structureFinding.message}.</p>
          {structureFinding.suggestion && (
            <p className="mt-1 text-sm text-app-text-muted">{structureFinding.suggestion}.</p>
          )}
        </div>
      )}

      {stats.length > 0 && (
        <dl className="flex gap-6 text-sm">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-app-text-muted">{stat.label}</dt>
              <dd className="font-medium text-app-text">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/*
        The full structure is collapsed by default, deliberately (CTO decision, 2026-07-18).
        This panel answers "what did I import?" — showing every chapter and sub-section made its
        height proportional to the manuscript, so a 500-page book buried Validation/Layout/
        Preview under its own table of contents. That is an information-hierarchy defect, not a
        CSS one: "what did I import" and "show me the whole book" are different needs, and the
        second one belongs to a structure surface, not the import confirmation.

        A native <details> disclosure: correct semantics for free (button role, aria-expanded,
        keyboard toggling). The expanded list is height-capped and scrolls internally, so even
        opened it can never dominate the page.
      */}
      <details className="group">
        <summary className="cursor-pointer select-none text-sm font-medium text-app-text underline underline-offset-4 dark:text-app-text">
          Structure — {book.mainContent.length} {book.mainContent.length === 1 ? 'part' : 'parts'}
        </summary>
        <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto pr-2">
          {book.mainContent.map((content) => (
            <li key={content.id} className="text-sm text-app-text">
              {contentLabel(content)}
              {content.type === 'chapter' && content.sections && content.sections.length > 0 && (
                <ul className="ml-4 mt-1 flex flex-col gap-1 text-app-text-muted">
                  {content.sections.map((section) => (
                    <li key={section.id}>{section.title || 'Untitled section'}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
