'use client';

import { useState } from 'react';
import type { ExportFormat } from '@/lib/api-client';
import { Button, Card } from '@/components/ui';

// Sprint 7 commit 9b - real export/download, completing the originally-planned Commit 9
// (export + preview, split at CTO direction into 9a/preview and 9b/this file so an
// export-pipeline problem's root cause - document generation vs. download mechanism - is
// immediately identifiable). Each format is its own independent real round trip against the
// stateless backend (Sprint 7 Decision 2) - it does not reuse commit 9a's preview blob, even
// for PDF, so all three formats behave identically. onDownloaded (commit 11) is a
// real-completion callback for ProgressStepper, fired only after a real successful download.
interface ExportPanelProps {
  /** Filename stem for downloads, e.g. the project name. */
  downloadName: string;
  /** Produces the file for a format. Injected (HOME_WORKSPACE.md Decision 6): the Workspace
   * passes a project-based exporter rendering from the STORED source. */
  exporter: (format: ExportFormat) => Promise<Blob>;
  onDownloaded?: () => void;
}

const FORMATS: { format: ExportFormat; label: string }[] = [
  { format: 'pdf', label: 'PDF edition' },
  { format: 'docx', label: 'DOCX edition' },
  { format: 'epub', label: 'EPUB edition' },
];


export function ExportPanel({ exporter, downloadName, onDownloaded }: ExportPanelProps) {
  // FOUNDER_TRAVERSAL defect 5: only the button IN FLIGHT changes state. The founder read the old
  // "disable all three while one exports" as "PDF selected all three editions". Each format is an
  // independent round trip (see the header note), so we track a SET of in-flight formats — a
  // button reflects only its OWN export, the other two stay untouched and clickable.
  const [exporting, setExporting] = useState<ReadonlySet<ExportFormat>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDownload(format: ExportFormat) {
    setExporting((prev) => new Set(prev).add(format));
    setErrorMessage(null);
    try {
      const blob = await exporter(format);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${downloadName}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      onDownloaded?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `${format.toUpperCase()} export failed.`);
    } finally {
      setExporting((prev) => {
        const next = new Set(prev);
        next.delete(format);
        return next;
      });
    }
  }

  return (
    <Card className="flex max-w-2xl flex-col gap-4 px-8 py-6 text-left">
      <h3 className="text-lg font-semibold text-app-text">Editions</h3>

      {errorMessage && <p className="text-sm text-app-error">{errorMessage}</p>}

      <div className="flex flex-wrap gap-3">
        {FORMATS.map(({ format, label }) => (
          <Button
            key={format}
            variant="secondary"
            onClick={() => void handleDownload(format)}
            disabled={exporting.has(format)}
          >
            {exporting.has(format) ? 'Exporting…' : label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
