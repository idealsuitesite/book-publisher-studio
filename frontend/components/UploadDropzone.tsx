'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { importManuscript } from '@/lib/api-client';
import { Button } from '@/components/ui';

// HOME_WORKSPACE.md §0: import lives on Home and ENDS WITH A REDIRECT. A successful import
// creates a project (ADR-0047) and the user lands in its Workspace — everything about the
// imported book (structure, validation, layout, preview, publish) is a Workspace concern,
// never inlined here. This component's whole job is: get a DOCX in, hand the user their
// project. The old post-import vertical pipeline it used to render retired with the
// ProgressStepper (§0, stations-not-steps).
type State =
  | { status: 'idle' }
  | { status: 'uploading'; filename: string }
  | { status: 'error'; filename: string; message: string };

const CARD_CLASSES =
  'flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border-2 px-10 py-20 text-center transition-colors';

/**
 * `full` — the drag-and-drop card (the empty-library / first-run screen, where import is the point).
 * `button` — a compact primary "Import a manuscript" action that opens the file picker directly
 * (MINI_DR_HOME_STATE_LAYOUT §2.2a): used on a NON-empty library, where import is a quick one-off, not
 * a full form competing with the book list. Both share the same file input + import→redirect logic.
 */
export function UploadDropzone({ variant = 'full' }: { variant?: 'full' | 'button' }) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });

  async function handleFile(file: File) {
    setState({ status: 'uploading', filename: file.name });

    try {
      const result = await importManuscript(file);
      if (result.report.status === 'success' && result.projectId) {
        router.push(`/projects/${result.projectId}`);
        return;
      }
      setState({
        status: 'error',
        filename: file.name,
        message:
          result.report.status === 'success'
            ? 'The import succeeded but no project was created.'
            : result.report.errors.join(' ') || 'The import pipeline reported errors.',
      });
    } catch (error) {
      setState({
        status: 'error',
        filename: file.name,
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  }

  // Button variant (non-empty library): a compact primary action, not the full drop card.
  if (variant === 'button') {
    const input = (
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />
    );
    return (
      <div className="flex flex-col items-end gap-1">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 border-app-accent bg-app-surface-2 px-5 py-2.5 text-sm font-medium text-app-text transition-colors hover:bg-app-surface-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-app-accent">
          {input}
          <span>{state.status === 'uploading' ? 'Uploading…' : 'Import a manuscript'}</span>
        </label>
        {state.status === 'error' && (
          <p className="text-xs text-app-error">
            {state.message}{' '}
            <Button variant="link" className="text-xs" onClick={() => setState({ status: 'idle' })}>
              Try again
            </Button>
          </p>
        )}
      </div>
    );
  }

  if (state.status === 'uploading') {
    return (
      <div className={`${CARD_CLASSES} border-app-border`}>
        <p className="animate-pulse text-lg font-medium text-app-text">Uploading…</p>
        <p className="text-sm text-app-text-muted">{state.filename}</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={`${CARD_CLASSES} border-app-error`}>
        <p className="text-lg font-medium text-app-error">Import failed</p>
        <p className="text-sm text-app-text-muted">{state.message}</p>
        <Button variant="link" className="mt-2" onClick={() => setState({ status: 'idle' })}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    // A <label> wrapping a real file input, not a bare <div>.
    //
    // The dropzone once had no input, no tabIndex, no role and no keyboard handler - only
    // onDrop. Importing is this application's single entry point, so keyboard users, screen
    // reader users, and anyone who clicks instead of dragging could not use the product at all
    // (found by Sprint 9 Commit 0's accessibility baseline). Drag-and-drop is retained as an
    // additional convenience, not as the only way in.
    <label
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void handleFile(file);
      }}
      className={`${CARD_CLASSES} cursor-pointer border-dashed focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-app-accent ${
        isDragging
          ? 'border-app-accent bg-app-surface-2'
          : 'border-app-border'
      }`}
    >
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        // sr-only rather than hidden or display:none: the input must stay focusable and
        // announced. Hiding it outright would recreate the very defect this fixes.
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          // Reset so selecting the same file twice in a row still fires onChange.
          event.target.value = '';
        }}
      />
      <span className="text-lg font-medium text-app-text">
        Drop your DOCX here, or choose a file
      </span>
      <span className="text-sm text-app-text-muted">.docx manuscripts only</span>
    </label>
  );
}
