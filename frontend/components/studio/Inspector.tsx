'use client';

import type { ProjectDTO } from 'shared-types';
import type { BookFacts } from '@/lib/bookFacts';
import type { StudioView } from './Explorer';

/**
 * The Inspector (PRODUCT_EXPERIENCE §2.5): contextual to the selection, never empty, every
 * fact measured or stored. The contract: each view declares its rows; the fallback is the
 * book's summary — an Inspector with nothing to say does not exist.
 */
interface Row {
  label: string;
  value: string;
  warn?: boolean;
}

export function inspectorRows(
  view: StudioView,
  project: ProjectDTO,
  facts: BookFacts,
  layoutLabel: string,
  themeLabel: string,
  measuredPages?: number
): Row[] {
  const meta = project.book.metadata;
  const bookRows: Row[] = [
    { label: 'Title', value: meta.title },
    { label: 'Author', value: meta.author },
    { label: 'Language', value: meta.language.toUpperCase() },
    ...(project.book.wordCount != null ? [{ label: 'Words', value: project.book.wordCount.toLocaleString('en-US') }] : []),
    ...(measuredPages ? [{ label: 'Pages (measured)', value: String(measuredPages) }] : []),
    ...(project.sourceFilename ? [{ label: 'Source', value: project.sourceFilename }] : []),
  ];

  switch (view) {
    case 'layout':
      return [
        { label: 'Preset', value: layoutLabel },
        { label: 'Theme', value: themeLabel },
        // Honest to the ADR: the gutter defect is disclosed where layout is inspected.
        { label: 'Gutter', value: 'not yet applied (ADR-0043)', warn: true },
        { label: 'Recto/verso', value: 'planned (LAYOUT_FIDELITY)' },
      ];
    case 'validation': {
      const c = project.report.score.categories;
      return [
        { label: 'Structure', value: `${c.structure}` },
        { label: 'Metadata', value: `${c.metadata}`, warn: c.metadata < 80 },
        { label: 'Typography', value: `${c.typography}` },
        { label: 'Accessibility', value: `${c.accessibility}` },
        { label: 'ISBN', value: meta.isbn ?? 'missing', warn: !meta.isbn },
      ];
    }
    case 'proof':
      return [
        { label: 'Layout', value: layoutLabel },
        { label: 'Theme', value: themeLabel },
        ...(measuredPages ? [{ label: 'Pages', value: String(measuredPages) }] : [{ label: 'Pages', value: 'refresh the proof' }]),
      ];
    case 'editions':
    case 'history':
      return [
        { label: 'Versions', value: String(project.versions.length) },
        { label: 'Publications', value: String(project.publications.length) },
        {
          label: 'Last publication',
          value:
            project.publications.length > 0
              ? `${project.publications[project.publications.length - 1].target.toUpperCase()} · ${project.publications[project.publications.length - 1].status}`
              : 'none yet',
        },
        { label: 'ISBN', value: meta.isbn ?? 'missing', warn: !meta.isbn },
      ];
    case 'structure':
      return [
        { label: 'Chapters', value: String(facts.chapters) },
        { label: 'Sections', value: String(facts.sections) },
        { label: 'Images', value: String(facts.images) },
        { label: 'Citations', value: String(facts.citations) },
        { label: 'Footnotes', value: String(facts.footnotes) },
        { label: 'Tables', value: String(facts.tables) },
      ];
    default:
      return bookRows;
  }
}

export function Inspector({ rows, title }: { rows: Row[]; title: string }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-text-muted">{title}</h2>
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-3 border-b border-app-border py-1.5 last:border-b-0"
          >
            <dt className="shrink-0 text-xs text-app-text-muted">{row.label}</dt>
            <dd
              className={`truncate text-right text-xs font-medium tabular-nums ${row.warn ? 'text-app-warning' : 'text-app-text'}`}
              title={row.value}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
