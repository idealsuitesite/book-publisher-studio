'use client';

import type { ProjectDTO, BookDTO } from 'shared-types';
import { Card } from '@/components/ui';
import { countContentWords, unstructuredFinding } from '@/lib/bookFacts';

/**
 * The Structure station's editor (STRUCTURE_EDITING.md phase 3). Replaces the read-only
 * import-confirmation card that used to stand in here: "what did I import?" (a confirmation) and
 * "organize my book" (an editor) are different needs (Phase 3 D2), and only the second belongs to
 * a workspace station. The old `BookStructureView` was, on inspection, wired ONLY here — there is
 * no separate import-confirmation screen — so it is replaced, not kept beside this.
 *
 * This commit renders the chapters/sections read-only, in the row layout the next commits make
 * interactive (drag handle for reorder, click-to-edit for rename). The ADR-0049 "0 chapters"
 * banner is carried over: it is a fact ABOUT the structure this surface shows.
 */
interface StructureEditorProps {
  project: ProjectDTO;
}

function chapterHeading(content: BookDTO['mainContent'][number]): string {
  if (content.type === 'chapter') return `Chapter ${content.number}: ${content.title}`;
  return content.title || 'Untitled section';
}

export function StructureEditor({ project }: StructureEditorProps) {
  const book = project.book;
  const finding = unstructuredFinding(project.report);

  return (
    <Card className="flex w-full max-w-2xl flex-col gap-5 px-8 py-7 text-left">
      <div>
        <h2 className="text-xl font-semibold text-app-text">Structure</h2>
        <p className="mt-0.5 text-sm text-app-text-muted">
          {book.mainContent.length} {book.mainContent.length === 1 ? 'part' : 'parts'}
        </p>
      </div>

      {finding && (
        <div role="alert" className="rounded-md border border-app-error bg-app-surface-2 px-4 py-3">
          <p className="text-sm font-semibold text-app-error">0 chapters detected — needs review</p>
          <p className="mt-1 text-sm text-app-text">{finding.message}.</p>
          {finding.suggestion && <p className="mt-1 text-sm text-app-text-muted">{finding.suggestion}.</p>}
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {book.mainContent.map((content) => (
          <li key={content.id} className="rounded-md border border-app-border bg-app-surface-1 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-app-text">{chapterHeading(content)}</span>
              <span className="shrink-0 text-xs tabular-nums text-app-text-muted">
                {countContentWords(content).toLocaleString('en-US')} words
              </span>
            </div>
            {content.type === 'chapter' && content.sections && content.sections.length > 0 && (
              <ul className="ml-4 mt-1.5 flex flex-col gap-1 border-l border-app-border pl-3">
                {content.sections.map((section) => (
                  <li key={section.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-app-text-muted">{section.title || 'Untitled section'}</span>
                    <span className="shrink-0 text-xs tabular-nums text-app-text-muted">
                      {countContentWords(section).toLocaleString('en-US')} words
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
