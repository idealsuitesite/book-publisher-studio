'use client';

import { useState } from 'react';

// Sprint 7 commit 4 (docs/architecture/diagrams/SPRINT_7_KICKOFF.md) - the first real screen,
// deliberately static. Visual drag state only, no wiring to POST /api/manuscripts/import yet -
// that's commit 5's job (the actual upload flow). This commit's whole job is to make Book
// Publisher Studio show a real screen for the first time, per the CTO's explicit "even if the
// only feature is 'Drop your DOCX here'" direction.
export function UploadDropzone() {
  const [isDragging, setIsDragging] = useState(false);

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
      }}
      className={`flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-10 py-20 text-center transition-colors ${
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
