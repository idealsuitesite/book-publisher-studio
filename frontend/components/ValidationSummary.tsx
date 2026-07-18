import type { ImportReportDTO, ValidationIssueDTO } from 'shared-types';

// Sprint 7 commit 7 - renders the real ImportReportDTO.issues/.score a successful import
// returns, sibling to BookStructureView (commit 6). Format/layout selection (commit 8) and
// export/preview (commit 9) are still deliberately not wired here.
//
// Commit 11 (CTO direction): severity labels softened to plain title case (was shouty
// all-caps "WARNING (4)") and a real overall count line added - the underlying severities and
// counts are unchanged, only the copy/styling.
interface ValidationSummaryProps {
  report: ImportReportDTO;
}

const SEVERITY_ORDER: ValidationIssueDTO['severity'][] = ['ERROR', 'WARNING', 'INFO', 'SUGGESTION'];

const SEVERITY_LABELS: Record<ValidationIssueDTO['severity'], string> = {
  ERROR: 'Critical',
  WARNING: 'Warning',
  INFO: 'Information',
  SUGGESTION: 'Suggestion',
};

const SEVERITY_CLASSES: Record<ValidationIssueDTO['severity'], string> = {
  ERROR: 'border-red-600 text-red-600 dark:text-red-400',
  WARNING: 'border-amber-500 text-amber-600 dark:text-amber-400',
  INFO: 'border-blue-500 text-blue-600 dark:text-blue-400',
  SUGGESTION: 'border-zinc-400 text-zinc-500 dark:text-zinc-400',
};

const CATEGORY_LABELS: Record<keyof ImportReportDTO['score']['categories'], string> = {
  structure: 'Structure',
  metadata: 'Metadata',
  typography: 'Typography',
  accessibility: 'Accessibility',
};

export function ValidationSummary({ report }: ValidationSummaryProps) {
  const { score, issues } = report;
  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: issues.filter((issue) => issue.severity === severity),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 rounded-2xl border-2 border-zinc-300 px-8 py-8 text-left dark:border-zinc-700">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Validation</h3>
        <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {score.overall}
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">/100</span>
        </p>
      </div>

      <dl className="flex flex-wrap gap-6 text-sm">
        {(Object.keys(score.categories) as Array<keyof typeof score.categories>).map((category) => (
          <div key={category}>
            <dt className="text-zinc-500 dark:text-zinc-400">{CATEGORY_LABELS[category]}</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-50">{score.categories[category]}</dd>
          </div>
        ))}
      </dl>

      {issues.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No issues found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {issues.length} {issues.length === 1 ? 'thing' : 'things'} to improve
          </p>
          <ul className="flex flex-col gap-3">
            {grouped.map((group) => (
              <li key={group.severity} className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  {SEVERITY_LABELS[group.severity]}{' '}
                  <span className="font-normal text-zinc-500 dark:text-zinc-400">({group.items.length})</span>
                </p>
                <ul className="flex flex-col gap-2">
                  {group.items.map((issue, index) => (
                    <li
                      key={`${issue.code}-${index}`}
                      className={`border-l-2 pl-3 text-sm ${SEVERITY_CLASSES[issue.severity]}`}
                    >
                      <span className="text-zinc-900 dark:text-zinc-50">{issue.message}</span>
                      {issue.suggestion && (
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400">{issue.suggestion}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
