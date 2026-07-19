'use client';

import { useState } from 'react';
import type { PublishingResponseDTO } from 'shared-types';
import { publishProject } from '@/lib/api-client';
import { Button, Card, Badge } from '@/components/ui';

interface PublishPanelProps {
  projectId: string;
  /** Fired after a publish attempt lands, so the Workspace can refresh History. */
  onPublished?: () => void;
}

/**
 * The Publish station's submission half (HOME_WORKSPACE.md §0). Runs the real KDP validation
 * pipeline from the STORED source and — via the backend — writes the attempt into the
 * project's history, PASS or FAIL. A rejection is exactly the history an author needs.
 */
export function PublishPanel({ projectId, onPublished }: PublishPanelProps) {
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'publishing' }
    | { status: 'done'; report: PublishingResponseDTO }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  async function publish() {
    setState({ status: 'publishing' });
    try {
      const report = await publishProject(projectId);
      setState({ status: 'done', report });
      onPublished?.();
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Publish failed.' });
    }
  }

  return (
    <Card className="flex max-w-2xl flex-col gap-4 px-8 py-6 text-left">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-app-text">Publish to KDP</h3>
        <Button onClick={() => void publish()} disabled={state.status === 'publishing'}>
          {state.status === 'publishing' ? 'Validating…' : 'Validate for KDP'}
        </Button>
      </div>
      <p className="text-sm text-app-text-muted">
        Runs Amazon KDP&apos;s real submission rules against this book and records the attempt in the
        project&apos;s history. No account is contacted — this validates, it does not submit.
      </p>

      {state.status === 'error' && (
        <p className="text-sm text-app-error">{state.message}</p>
      )}

      {state.status === 'done' && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm font-medium text-app-text">
            <Badge severity={state.report.status === 'PASS' ? 'success' : 'error'}>
              {state.report.status}
            </Badge>
            {state.report.summary}
          </p>
          {state.report.issues.length > 0 && (
            <ul className="flex flex-col gap-2">
              {state.report.issues.map((issue, index) => (
                <li
                  key={`${issue.code}-${index}`}
                  className={`border-l-2 pl-3 text-sm ${
                    issue.severity === 'ERROR' ? 'border-app-error' : 'border-app-warning'
                  }`}
                >
                  <span className="text-app-text">{issue.message}</span>
                  <span className="block text-xs text-app-text-muted">{issue.code}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
