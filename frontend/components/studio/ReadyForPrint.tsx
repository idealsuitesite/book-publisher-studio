'use client';

import { useEffect, useState } from 'react';
import type { ImportReportDTO } from 'shared-types';
import { Card } from '@/components/ui';

/**
 * Ready for Print (PRODUCT_EXPERIENCE §4.6): the checklist that replaced "60/100". The 8 real
 * rules and 4 real score categories, each finding carrying the intelligent-engine shape
 * (§10.2): consequence · action — never a bare defect.
 *
 * The checks tick IN SEQUENCE (VISUAL_LANGUAGE §6): the studio audibly goes down the list.
 */
const CATEGORY_LABELS: Record<string, string> = {
  structure: 'Structure',
  metadata: 'Metadata',
  typography: 'Typography',
  accessibility: 'Accessibility',
};

export function ReadyForPrint({ report }: { report: ImportReportDTO }) {
  const [ticked, setTicked] = useState(0);
  const categories = Object.entries(report.score.categories);

  useEffect(() => {
    let count = 0;
    const interval = setInterval(() => {
      count += 1;
      setTicked(count);
      if (count >= categories.length) clearInterval(interval);
    }, 90);
    return () => clearInterval(interval);
  }, [categories.length, report]);

  const blocking = report.issues.filter((issue) => issue.severity === 'ERROR');
  const advisories = report.issues.filter((issue) => issue.severity !== 'ERROR');
  const ready = blocking.length === 0;

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold text-app-text">
          {ready ? 'Ready for Print' : 'Almost ready'}
        </h2>
        <p className="text-app-text">
          <span className="text-3xl font-semibold tabular-nums">{report.score.overall}</span>
          <span className="text-sm text-app-text-muted"> Professional Score</span>
        </p>
      </div>

      <Card className="grid grid-cols-2 gap-x-8 gap-y-2 px-6 py-5 sm:grid-cols-4">
        {categories.map(([category, score], index) => {
          const ok = score >= 80;
          const visible = index < ticked;
          return (
            <div
              key={category}
              className={`flex items-center gap-2 text-sm transition-opacity duration-[var(--motion-micro)] motion-reduce:opacity-100 ${
                visible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <span className={ok ? 'text-app-success' : 'text-app-warning'}>{ok ? '✓' : '⚠'}</span>
              <span className="text-app-text">{CATEGORY_LABELS[category] ?? category}</span>
              <span className="ml-auto text-xs tabular-nums text-app-text-muted">{score}</span>
            </div>
          );
        })}
      </Card>

      {report.issues.length === 0 ? (
        <p className="text-sm text-app-text-muted">Every check passed. This book is ready to become editions.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {blocking.length > 0 && (
            <FindingList title={`Blocking (${blocking.length})`} issues={blocking} tone="error" />
          )}
          {advisories.length > 0 && (
            <FindingList title={`Advisories (${advisories.length})`} issues={advisories} tone="warning" />
          )}
        </div>
      )}
    </div>
  );
}

function FindingList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: ImportReportDTO['issues'];
  tone: 'error' | 'warning';
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-app-text">{title}</h3>
      <ul className="flex flex-col gap-2">
        {issues.map((issue, index) => (
          <li
            key={`${issue.code}-${index}`}
            className={`border-l-2 pl-3 text-sm ${tone === 'error' ? 'border-app-error' : 'border-app-warning'}`}
          >
            <span className="text-app-text">{issue.message}</span>
            {/* consequence · action (§10.2): the suggestion is the action; a finding never
                appears without a way forward when the engine knows one. */}
            {issue.suggestion && <span className="block text-xs text-app-accent">→ {issue.suggestion}</span>}
            {issue.location && <span className="block text-xs text-app-text-muted">{issue.location}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
