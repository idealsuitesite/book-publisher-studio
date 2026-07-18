'use client';

import { useState } from 'react';
import { importManuscript } from '@/lib/api-client';

// Sprint 7 commit 5 (docs/architecture/diagrams/SPRINT_7_KICKOFF.md) - the dropzone commit 4
// shipped as static UI now drives the real ThemeEngine/ASTBuilder pipeline via a real
// POST /api/manuscripts/import. Still deliberately minimal: no book structure rendering yet
// (commit 6's job) - just Drop -> Uploading -> Import complete/failed, per the CTO's own
// "even without displaying the book" framing.
type Status = 'idle' | 'uploading' | 'success' | 'error';

const CARD_CLASSES =
  'flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border-2 px-10 py-20 text-center transition-colors';

export function UploadDropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [filename, setFilename] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(file: File) {
    setStatus('uploading');
    setFilename(file.name);
    setMessage(null);

    try {
      const result = await importManuscript(file);
      if (result.report.status === 'success') {
        setStatus('success');
      } else {
        setStatus('error');
        setMessage(result.report.errors.join(' ') || 'The import pipeline reported errors.');
      }
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong.');
    }
  }

  function reset() {
    setStatus('idle');
    setFilename(null);
    setMessage(null);
  }

  if (status === 'uploading') {
    return (
      <div className={`${CARD_CLASSES} border-zinc-300 dark:border-zinc-700`}>
        <p className="animate-pulse text-lg font-medium text-zinc-900 dark:text-zinc-50">Uploading…</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{filename}</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className={`${CARD_CLASSES} border-emerald-600`}>
        <p className="text-lg font-medium text-emerald-600 dark:text-emerald-400">Import complete</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{filename}</p>
        <button
          onClick={reset}
          className="mt-2 text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
        >
          Import another file
        </button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={`${CARD_CLASSES} border-red-600`}>
        <p className="text-lg font-medium text-red-600 dark:text-red-400">Import failed</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
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
