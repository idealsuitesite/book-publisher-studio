'use client';

import { useState } from 'react';
import type { ImportResponseDTO } from 'shared-types';
import { importManuscript } from '@/lib/api-client';
import { BookStructureView } from '@/components/BookStructureView';
import { ValidationSummary } from '@/components/ValidationSummary';

// Sprint 7 commit 5 (docs/architecture/diagrams/SPRINT_7_KICKOFF.md) - the dropzone commit 4
// shipped as static UI now drives the real ThemeEngine/ASTBuilder pipeline via a real
// POST /api/manuscripts/import. Commit 6 added the real book structure view on success
// (BookStructureView). Commit 7 adds the real validation findings (ValidationSummary) below
// it - format/layout selection (commit 8) and export/preview (commit 9) are still deliberately
// not wired here.
type State =
  | { status: 'idle' }
  | { status: 'uploading'; filename: string }
  | { status: 'success'; filename: string; result: ImportResponseDTO }
  | { status: 'error'; filename: string; message: string };

const CARD_CLASSES =
  'flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border-2 px-10 py-20 text-center transition-colors';

export function UploadDropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });

  async function handleFile(file: File) {
    setState({ status: 'uploading', filename: file.name });

    try {
      const result = await importManuscript(file);
      if (result.report.status === 'success') {
        setState({ status: 'success', filename: file.name, result });
      } else {
        setState({
          status: 'error',
          filename: file.name,
          message: result.report.errors.join(' ') || 'The import pipeline reported errors.',
        });
      }
    } catch (error) {
      setState({
        status: 'error',
        filename: file.name,
        message: error instanceof Error ? error.message : 'Something went wrong.',
      });
    }
  }

  function reset() {
    setState({ status: 'idle' });
  }

  if (state.status === 'uploading') {
    return (
      <div className={`${CARD_CLASSES} border-zinc-300 dark:border-zinc-700`}>
        <p className="animate-pulse text-lg font-medium text-zinc-900 dark:text-zinc-50">Uploading…</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{state.filename}</p>
      </div>
    );
  }

  if (state.status === 'success') {
    return (
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <BookStructureView book={state.result.book} filename={state.filename} onReset={reset} />
        <ValidationSummary report={state.result.report} />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={`${CARD_CLASSES} border-red-600`}>
        <p className="text-lg font-medium text-red-600 dark:text-red-400">Import failed</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{state.message}</p>
        <button
          onClick={reset}
          className="mt-2 text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div
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
      className={`${CARD_CLASSES} border-dashed ${
        isDragging
          ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-900'
          : 'border-zinc-300 dark:border-zinc-700'
      }`}
    >
      <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Drop your DOCX here</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">.docx manuscripts only</p>
    </div>
  );
}
