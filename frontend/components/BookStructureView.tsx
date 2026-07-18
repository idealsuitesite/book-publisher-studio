import type { BookDTO } from 'shared-types';

// Sprint 7 commit 6 - renders the real BookDTO a successful import returns. Deliberately no
// validation findings here (report.issues/.score) - that's commit 7's job.
interface BookStructureViewProps {
  book: BookDTO;
  filename: string | null;
  onReset: () => void;
}

function contentLabel(content: BookDTO['mainContent'][number]): string {
  if (content.type === 'chapter') {
    return `Chapter ${content.number}: ${content.title}`;
  }
  return content.title || 'Untitled section';
}

export function BookStructureView({ book, filename, onReset }: BookStructureViewProps) {
  const stats: Array<{ label: string; value: string }> = [];
  if (book.wordCount != null) stats.push({ label: 'Words', value: book.wordCount.toLocaleString() });
  if (book.pageCount != null) stats.push({ label: 'Pages', value: String(book.pageCount) });
  if (book.readingTime != null) stats.push({ label: 'Reading time', value: `${book.readingTime} min` });

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 rounded-2xl border-2 border-emerald-600 px-8 py-8 text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Import complete</p>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{book.metadata.title}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {book.metadata.author} · {filename}
          </p>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
        >
          Import another file
        </button>
      </div>

      {stats.length > 0 && (
        <dl className="flex gap-6 text-sm">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-zinc-500 dark:text-zinc-400">{stat.label}</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-50">{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <ul className="flex flex-col gap-2">
        {book.mainContent.map((content) => (
          <li key={content.id} className="text-sm text-zinc-900 dark:text-zinc-50">
            {contentLabel(content)}
            {content.type === 'chapter' && content.sections && content.sections.length > 0 && (
              <ul className="ml-4 mt-1 flex flex-col gap-1 text-zinc-500 dark:text-zinc-400">
                {content.sections.map((section) => (
                  <li key={section.id}>{section.title || 'Untitled section'}</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
