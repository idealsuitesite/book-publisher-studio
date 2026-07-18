'use client';

import { useState } from 'react';
import { exportManuscript, type ExportFormat } from '@/lib/api-client';

// Sprint 7 commit 9b - real export/download, completing the originally-planned Commit 9
// (export + preview, split at CTO direction into 9a/preview and 9b/this file so an
// export-pipeline problem's root cause - document generation vs. download mechanism - is
// immediately identifiable). Each format is its own independent real round trip against the
// stateless backend (Sprint 7 Decision 2) - it does not reuse commit 9a's preview blob, even
// for PDF, so all three formats behave identically. onDownloaded (commit 11) is a
// real-completion callback for ProgressStepper, fired only after a real successful download.
interface ExportPanelProps {
  file: File;
  layout: string;
  theme: string;
  onDownloaded?: () => void;
}

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'pdf', label: 'Download PDF' },
  { format: 'docx', label: 'Download DOCX' },
  { format: 'epub', label: 'Download EPUB' },
];

function baseName(filename: string): string {
  return filename.replace(/\.[^./]+$/, '');
}

export function ExportPanel({ file, layout, theme, onDownloaded }: ExportPanelProps) {
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload(format: ExportFormat) {
    setExportingFormat(format);
    setErrorMessage(null);
    try {
      const blob = await exportManuscript({ file, theme, layout, format });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${baseName(file.name)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      onDownloaded?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `${format.toUpperCase()} export failed.`);
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 rounded-2xl border-2 border-zinc-300 px-8 py-6 text-left dark:border-zinc-700">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Export</h3>

      {errorMessage && <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>}

      <div className="flex flex-wrap gap-3">
        {FORMATS.map(({ format, label }) => (
          <button
            key={format}
            onClick={() => void handleDownload(format)}
            disabled={exportingFormat !== null}
            className="rounded-lg border-2 border-zinc-900 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors disabled:opacity-50 dark:border-zinc-50 dark:text-zinc-50"
          >
            {exportingFormat === format ? 'Exporting…' : label}
          </button>
        ))}
      </div>
    </div>
  );
}
