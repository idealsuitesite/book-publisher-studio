'use client';

import { useEffect, useState } from 'react';
import type { ImportResponseDTO, ManuscriptOptionsDTO } from 'shared-types';
import { getManuscriptOptions, importManuscript } from '@/lib/api-client';
import { BookStructureView } from '@/components/BookStructureView';
import { Button } from '@/components/ui';
import { ValidationSummary } from '@/components/ValidationSummary';
import { FormatSelector } from '@/components/FormatSelector';
import { PreviewPanel } from '@/components/PreviewPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { ProgressStepper } from '@/components/ProgressStepper';

// Sprint 7 commit 5 (docs/architecture/diagrams/SPRINT_7_KICKOFF.md) - the dropzone commit 4
// shipped as static UI now drives the real ThemeEngine/ASTBuilder pipeline via a real
// POST /api/manuscripts/import. Commit 6 added the real book structure view on success
// (BookStructureView). Commit 7 added the real validation findings (ValidationSummary).
// Commit 8 added the format/layout selector (FormatSelector). Commit 9a added the real PDF
// preview (PreviewPanel) - the success state keeps the real dropped File (not just its name)
// since the stateless backend needs the real bytes resent for export/preview. Commit 9b added
// real export/download for all 3 formats (ExportPanel), completing the originally-planned
// Commit 9. Commit 11 adds ProgressStepper - every step's "done" flag is real state (a real
// import, a real generated preview, a real completed download), not a fixed/simulated bar -
// plus human-readable format/theme labels threaded down to PreviewPanel.
type State =
  | { status: 'idle' }
  | { status: 'uploading'; filename: string }
  | { status: 'success'; file: File; result: ImportResponseDTO }
  | { status: 'error'; filename: string; message: string };

const CARD_CLASSES =
  'flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border-2 px-10 py-20 text-center transition-colors';

export function UploadDropzone() {
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });
  const [options, setOptions] = useState<ManuscriptOptionsDTO | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  useEffect(() => {
    if (state.status !== 'success' || options) return;
    void getManuscriptOptions().then((result) => {
      setOptions(result);
      setSelectedLayout(result.layouts[0]?.name ?? null);
      setSelectedTheme(result.themes[0]?.name ?? null);
    });
  }, [state.status, options]);

  async function handleFile(file: File) {
    setState({ status: 'uploading', filename: file.name });

    try {
      const result = await importManuscript(file);
      if (result.report.status === 'success') {
        setState({ status: 'success', file, result });
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
    setOptions(null);
    setSelectedLayout(null);
    setSelectedTheme(null);
    setHasPreviewed(false);
    setHasExported(false);
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
    const layoutLabel = options?.layouts.find((l) => l.name === selectedLayout)?.label ?? selectedLayout ?? '';
    const themeLabel = options?.themes.find((t) => t.name === selectedTheme)?.label ?? selectedTheme ?? '';

    return (
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <ProgressStepper
          steps={[
            { label: 'Import', done: true },
            { label: 'Structure', done: true },
            { label: 'Validation', done: true },
            { label: 'Layout', done: Boolean(selectedLayout && selectedTheme) },
            { label: 'Preview', done: hasPreviewed },
            { label: 'Export', done: hasExported },
          ]}
        />
        <BookStructureView book={state.result.book} filename={state.file.name} onReset={reset} />
        <ValidationSummary report={state.result.report} />
        {options && selectedLayout && selectedTheme && (
          <FormatSelector
            options={options}
            selectedLayout={selectedLayout}
            selectedTheme={selectedTheme}
            onLayoutChange={setSelectedLayout}
            onThemeChange={setSelectedTheme}
          />
        )}
        {selectedLayout && selectedTheme && (
          <PreviewPanel
            file={state.file}
            layout={selectedLayout}
            theme={selectedTheme}
            layoutLabel={layoutLabel}
            themeLabel={themeLabel}
            onGenerated={() => setHasPreviewed(true)}
          />
        )}
        {selectedLayout && selectedTheme && (
          <ExportPanel
            file={state.file}
            layout={selectedLayout}
            theme={selectedTheme}
            onDownloaded={() => setHasExported(true)}
          />
        )}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className={`${CARD_CLASSES} border-red-600`}>
        <p className="text-lg font-medium text-red-600 dark:text-red-400">Import failed</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{state.message}</p>
        <Button variant="link" className="mt-2" onClick={reset}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    // A <label> wrapping a real file input, not a bare <div>.
    //
    // Before this fix the dropzone had no input, no tabIndex, no role and no keyboard handler -
    // only onDrop. Importing is this application's single entry point, so keyboard users,
    // screen reader users, and anyone who clicks instead of dragging could not use the product
    // at all (found by Sprint 9 Commit 0's accessibility baseline). Drag-and-drop is retained
    // as an additional convenience, not as the only way in.
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
      className={`${CARD_CLASSES} cursor-pointer border-dashed focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-zinc-900 dark:focus-within:outline-zinc-50 ${
        isDragging
          ? 'border-zinc-900 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-900'
          : 'border-zinc-300 dark:border-zinc-700'
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
      <span className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
        Drop your DOCX here, or choose a file
      </span>
      <span className="text-sm text-zinc-500 dark:text-zinc-400">.docx manuscripts only</span>
    </label>
  );
}
