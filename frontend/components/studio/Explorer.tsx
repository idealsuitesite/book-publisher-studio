'use client';

import type { ProjectDTO } from 'shared-types';
import { unstructuredFinding, type BookFacts } from '@/lib/bookFacts';
import { cx } from '@/components/ui';

/**
 * The Workspace views the Explorer opens (PRODUCT_EXPERIENCE §2.3). The tree IS the Domain
 * model — Book / Production / Record — which is why every node is real on day one. Stations
 * became views; the technical menu died here.
 */
export type StudioView =
  // The new editorial workspace (AUTHOR_EXPERIENCE_DR M1) — the primary surface being built beside
  // the existing stations, which stay as the working safety net until M4 dissolves them.
  | 'workspace'
  | 'dashboard'
  | 'structure'
  | 'validation'
  | 'layout'
  | 'proof'
  | 'editions'
  | 'history';

interface ExplorerNode {
  view: StudioView;
  label: string;
  /** Ambient status — a real count or state, never decoration. */
  status?: string;
  warn?: boolean;
}

interface ExplorerGroup {
  label: string;
  nodes: ExplorerNode[];
}

export function buildExplorer(
  project: ProjectDTO,
  facts: BookFacts,
  layoutLabel: string,
  measuredPages?: number
): ExplorerGroup[] {
  const errors = project.report.issues.filter((issue) => issue.severity === 'ERROR').length;
  const warnings = project.report.issues.length - errors;
  // ADR-0049: zero detected chapters on a book-length manuscript is a blocking-grade state,
  // and the tree must say so where the count lives — not display "0 ch" as a neutral fact.
  const unstructured = unstructuredFinding(project.report);

  return [
    {
      label: project.name,
      nodes: [
        // The new surface leads; Overview stays beside it until M4 (D7 re-homes then removes it).
        { view: 'workspace', label: 'Workspace', status: 'new' },
        { view: 'dashboard', label: 'Overview', status: `${project.report.score.overall}` },
      ],
    },
    {
      label: 'Book',
      nodes: [
        {
          view: 'structure',
          label: 'Structure',
          status: unstructured
            ? '0 ch — needs review'
            : `${facts.chapters} ch${facts.sections ? ` · ${facts.sections} sec` : ''}`,
          warn: Boolean(unstructured),
        },
        ...(facts.images ? [{ view: 'structure' as const, label: 'Images', status: `${facts.images}` }] : []),
        ...(facts.citations ? [{ view: 'structure' as const, label: 'Citations', status: `${facts.citations}` }] : []),
        ...(facts.footnotes ? [{ view: 'structure' as const, label: 'Footnotes', status: `${facts.footnotes}` }] : []),
        ...(facts.tables ? [{ view: 'structure' as const, label: 'Tables', status: `${facts.tables}` }] : []),
      ],
    },
    {
      label: 'Production',
      nodes: [
        { view: 'layout', label: 'Layout', status: layoutLabel },
        {
          view: 'validation',
          label: 'Ready for Print',
          status: errors + warnings === 0 ? '✓' : `${errors ? `${errors}!` : ''}${errors && warnings ? ' ' : ''}${warnings ? `${warnings}` : ''}`,
          warn: errors > 0,
        },
        { view: 'proof', label: 'Proof', status: measuredPages ? `${measuredPages} p.` : undefined },
        { view: 'editions', label: 'Editions', status: 'PDF · EPUB · DOCX' },
      ],
    },
    {
      label: 'Record',
      nodes: [
        {
          view: 'history',
          label: 'History',
          status:
            project.versions.length + project.publications.length > 0
              ? `${project.versions.length} v · ${project.publications.length} pub`
              : undefined,
        },
      ],
    },
  ];
}

interface ExplorerProps {
  groups: ExplorerGroup[];
  active: StudioView;
  onSelect: (view: StudioView) => void;
  bookVoice?: boolean;
}

export function Explorer({ groups, active, onSelect, bookVoice = true }: ExplorerProps) {
  return (
    <nav aria-label="Project explorer" className="flex flex-col gap-5">
      {groups.map((group, index) => (
        <div key={group.label}>
          <p
            className={cx(
              'mb-1.5 px-2 text-xs font-semibold',
              index === 0 ? 'text-app-text' : 'uppercase tracking-wide text-app-text-muted'
            )}
            // The project's own name renders in the book's voice (VISUAL_LANGUAGE §4).
            style={index === 0 && bookVoice ? { fontFamily: 'var(--font-book), Georgia, serif' } : undefined}
          >
            {group.label}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.nodes.map((node) => (
              <li key={`${node.view}-${node.label}`}>
                <button
                  onClick={() => onSelect(node.view)}
                  aria-current={active === node.view && node.label !== 'Images' ? 'page' : undefined}
                  className={cx(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm',
                    'transition-colors duration-[var(--motion-micro)]',
                    active === node.view
                      ? 'bg-app-surface-2 font-medium text-app-text shadow-[var(--shadow-sheet)]'
                      : 'text-app-text-muted hover:bg-app-surface-2 hover:text-app-text'
                  )}
                >
                  <span>{node.label}</span>
                  {node.status && (
                    <span
                      className={cx('text-xs tabular-nums', node.warn ? 'text-app-error' : 'text-app-text-muted')}
                    >
                      {node.status}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
