'use client';

import { useRef, useState } from 'react';
import type { ProjectDTO, BookDTO } from 'shared-types';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Card, cx } from '@/components/ui';
import { countContentWords, unstructuredFinding } from '@/lib/bookFacts';
import { editStructure, ApiError } from '@/lib/api-client';

/**
 * The Structure station's editor (STRUCTURE_EDITING.md phase 3). "Organize my book" — reorder and
 * (later commits) rename — as its own workspace surface. Commit 4 makes chapters reorderable.
 *
 * Reorder is server-authoritative (Phase 3 D6, consistent with Q5's no-concurrency): on drop we
 * POST the mutation and the parent re-renders from the returned project — no optimistic local
 * order to reconcile. dnd-kit gives us the accessible gesture (drag handle + keyboard sensor +
 * announcements) that a non-technical author needs; @dnd-kit was chosen for exactly that (D1).
 */
interface StructureEditorProps {
  project: ProjectDTO;
  /** Server-authoritative apply: the fresh project returned by an edit (D6). */
  onEdited: (updated: ProjectDTO) => void;
}

function chapterHeading(content: BookDTO['mainContent'][number]): string {
  if (content.type === 'chapter') return `Chapter ${content.number}: ${content.title}`;
  return content.title || 'Untitled section';
}

/**
 * The reorder handler, extracted so it is unit-testable in isolation — the gesture pipeline
 * (dnd-kit + real layout) is proven separately by the commit-8 Playwright test, not in jsdom
 * (Phase 3 §3bis / Q5). Given the drop's active/over ids and the current id order, it computes the
 * mainContent indices the backend `reorderChapters` expects, calls the API, and applies the result.
 */
export async function applyReorder(
  projectId: string,
  orderedIds: string[],
  activeId: string,
  overId: string,
  deps: {
    editStructure: typeof editStructure;
    onEdited: (updated: ProjectDTO) => void;
    onError: (message: string) => void;
  }
): Promise<void> {
  const fromIndex = orderedIds.indexOf(activeId);
  const toIndex = orderedIds.indexOf(overId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
  try {
    const updated = await deps.editStructure(projectId, { type: 'reorderChapters', fromIndex, toIndex });
    deps.onEdited(updated);
  } catch (error) {
    deps.onError(
      error instanceof ApiError ? 'That reorder could not be saved.' : 'Could not reach the server to save the reorder.'
    );
  }
}

/**
 * The rename handler, extracted for the same reason as `applyReorder` — unit-testable in isolation.
 * Empty titles are refused (the backend also trims/rejects); an unchanged title makes no call.
 */
export async function applyRename(
  projectId: string,
  id: string,
  title: string,
  deps: {
    editStructure: typeof editStructure;
    onEdited: (updated: ProjectDTO) => void;
    onError: (message: string) => void;
  }
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  try {
    const updated = await deps.editStructure(projectId, { type: 'rename', id, title: trimmed });
    deps.onEdited(updated);
  } catch (error) {
    deps.onError(
      error instanceof ApiError ? 'That rename could not be saved.' : 'Could not reach the server to save the rename.'
    );
  }
}

/**
 * Undo the last edit: restore the snapshot each reorder/rename takes *before* applying (backend
 * snapshot-before-edit). `restoreVersion` takes no new snapshot and deletes nothing (append-only
 * log), so this is single-level "undo the last change"; the History station holds the full log for
 * deeper restores. Returns whether it succeeded so the caller can drop the undo affordance.
 */
export async function applyUndo(
  projectId: string,
  versionId: string,
  deps: {
    editStructure: typeof editStructure;
    onEdited: (updated: ProjectDTO) => void;
    onError: (message: string) => void;
  }
): Promise<boolean> {
  try {
    const updated = await deps.editStructure(projectId, { type: 'restoreVersion', versionId });
    deps.onEdited(updated);
    return true;
  } catch (error) {
    deps.onError(
      error instanceof ApiError ? 'That undo could not be applied.' : 'Could not reach the server to undo.'
    );
    return false;
  }
}

/** Promote a paragraph to a chapter (CREATE_CHAPTER.md) — carve structure out of a manuscript the
 * importer could not (the founder's gap). Extracted for isolated jsdom testing, like the others. */
export async function applyPromote(
  projectId: string,
  blockId: string,
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'promoteToChapter', blockId }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That block could not be made a chapter.' : 'Could not reach the server.');
  }
}

/** Merge a chapter back into the previous container — the inverse of promote. */
export async function applyMerge(
  projectId: string,
  chapterId: string,
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'mergeChapterIntoPrevious', chapterId }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That chapter could not be merged back.' : 'Could not reach the server.');
  }
}

/**
 * Inline click-to-edit title (D3): a quiet button that becomes an input on click, commits on Enter
 * or blur, cancels on Esc, and refuses an empty title (reverts). No modal — the author keeps their
 * place in the book. A cancel flag routes both Enter and Esc through the single blur commit so the
 * edit is applied exactly once.
 */
function EditableTitle({
  value,
  ariaLabel,
  disabled,
  onCommit,
}: {
  value: string;
  ariaLabel: string;
  disabled: boolean;
  onCommit: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelling = useRef(false);

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={`Rename ${ariaLabel}`}
        className="rounded text-left underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed disabled:no-underline"
      >
        {value || 'Untitled'}
      </button>
    );
  }

  const finish = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (!cancelling.current && trimmed && trimmed !== value) onCommit(trimmed);
    cancelling.current = false;
  };

  return (
    <input
      autoFocus
      aria-label={`Rename ${ariaLabel}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelling.current = true;
          e.currentTarget.blur();
        }
      }}
      className="w-full rounded border border-app-border bg-app-surface-1 px-1.5 py-0.5 text-app-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
    />
  );
}

type ContentBlocks = BookDTO['mainContent'][number]['content'];

function blockPreview(block: ContentBlocks[number]): string {
  if ('text' in block && typeof block.text === 'string') {
    const t = block.text.trim();
    return t.length > 80 ? `${t.slice(0, 80)}…` : t || '(empty paragraph)';
  }
  return `[${block.type}]`;
}

/**
 * The block-aware view (CREATE_CHAPTER.md D5): a height-capped, truncated list of a container's own
 * paragraphs, each offering "Make this a chapter". Shown expanded for an unstructured (untitled)
 * container — where the author must act — and on demand for a chapter. Height-capped on purpose:
 * the panel must never grow with the manuscript (the old BookStructureView `<details>` lesson).
 */
function BlockList({ blocks, disabled, onPromote }: { blocks: ContentBlocks; disabled: boolean; onPromote: (blockId: string) => void }) {
  return (
    <ul className="mt-1.5 flex max-h-56 flex-col gap-0.5 overflow-y-auto border-l border-app-border pl-3">
      {blocks.map((block) => (
        <li key={block.id} className="flex items-center justify-between gap-2 py-0.5 text-sm">
          <span className="min-w-0 flex-1 truncate text-app-text-muted">{blockPreview(block)}</span>
          {(block.type === 'paragraph' || block.type === 'heading') && (
            <button
              onClick={() => onPromote(block.id)}
              disabled={disabled}
              className="shrink-0 rounded px-1.5 py-0.5 text-xs text-app-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed disabled:text-app-text-muted disabled:no-underline"
            >
              Make this a chapter
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function SortableChapterRow({
  content,
  index,
  disabled,
  onRename,
  onPromote,
  onMerge,
}: {
  content: BookDTO['mainContent'][number];
  index: number;
  disabled: boolean;
  onRename: (id: string, title: string) => void;
  onPromote: (blockId: string) => void;
  onMerge: (chapterId: string) => void;
}) {
  const isUnstructured = content.type === 'section' && !content.title.trim();
  const canMerge = content.type === 'chapter' && index > 0;
  const blocks = content.content;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: content.id,
    disabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cx(
        'rounded-md border border-app-border bg-app-surface-1 px-2 py-2.5',
        isDragging && 'opacity-60 shadow-[var(--shadow-sheet)]'
      )}
    >
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${chapterHeading(content)}`}
          disabled={disabled}
          className="shrink-0 cursor-grab rounded px-1 text-app-text-muted hover:text-app-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed"
        >
          ⠿
        </button>
        <span className="flex flex-1 items-center gap-1 text-sm font-medium text-app-text">
          {content.type === 'chapter' && <span className="shrink-0 text-app-text-muted">Chapter {content.number}:</span>}
          <EditableTitle
            value={content.title}
            ariaLabel={chapterHeading(content)}
            disabled={disabled}
            onCommit={(title) => onRename(content.id, title)}
          />
        </span>
        <span className="shrink-0 text-xs tabular-nums text-app-text-muted">
          {countContentWords(content).toLocaleString('en-US')} words
        </span>
        {canMerge && (
          <button
            onClick={() => onMerge(content.id)}
            disabled={disabled}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-app-text-muted hover:text-app-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed"
          >
            Merge back
          </button>
        )}
      </div>

      {/* CREATE_CHAPTER.md D5: block rows expanded for the unstructured container (act here), on
          demand for a chapter. Only text blocks (paragraph/heading) can become a chapter. */}
      {isUnstructured ? (
        <div className="mt-1">
          <p className="text-xs text-app-text-muted">Turn a paragraph into a chapter to build your structure:</p>
          <BlockList blocks={blocks} disabled={disabled} onPromote={onPromote} />
        </div>
      ) : blocks.length > 0 ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer select-none text-xs text-app-text-muted">
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'} — split into chapters
          </summary>
          <BlockList blocks={blocks} disabled={disabled} onPromote={onPromote} />
        </details>
      ) : null}

      {content.type === 'chapter' && content.sections && content.sections.length > 0 && (
        <ul className="ml-6 mt-1.5 flex flex-col gap-1 border-l border-app-border pl-3">
          {content.sections.map((section) => (
            <li key={section.id} className="flex items-center justify-between gap-3 text-app-text-muted">
              <EditableTitle
                value={section.title || ''}
                ariaLabel={section.title || 'Untitled section'}
                disabled={disabled}
                onCommit={(title) => onRename(section.id, title)}
              />
              <span className="shrink-0 text-xs tabular-nums text-app-text-muted">
                {countContentWords(section).toLocaleString('en-US')} words
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function StructureEditor({ project, onEdited }: StructureEditorProps) {
  const book = project.book;
  const finding = unstructuredFinding(project.report);
  const items = book.mainContent.map((c) => c.id);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The snapshot to restore to undo the last edit — set when an edit lands, cleared once undone.
  const [undoVersionId, setUndoVersionId] = useState<string | null>(null);

  // An edit returns the fresh project whose newest version is the pre-edit snapshot: the undo target.
  function captureUndo(updated: ProjectDTO) {
    onEdited(updated);
    const latest = updated.versions[updated.versions.length - 1];
    setUndoVersionId(latest ? latest.id : null);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Announcements speak in the author's terms (chapter headings), not internal ids.
  const label = (id: string | number) => {
    const c = book.mainContent.find((x) => x.id === id);
    return c ? chapterHeading(c) : String(id);
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${label(active.id)} is over ${label(over.id)}.` : ''),
    onDragEnd: ({ active, over }) => (over ? `Moved ${label(active.id)}. Saving.` : `Left ${label(active.id)} where it was.`),
    onDragCancel: ({ active }) => `Cancelled moving ${label(active.id)}.`,
  };

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setError(null);
    setPending(true);
    await applyReorder(project.id, items, String(active.id), String(over.id), {
      editStructure,
      onEdited: captureUndo,
      onError: setError,
    });
    setPending(false);
  }

  async function onRename(id: string, title: string) {
    setError(null);
    setPending(true);
    await applyRename(project.id, id, title, { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  async function onPromote(blockId: string) {
    setError(null);
    setPending(true);
    await applyPromote(project.id, blockId, { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  async function onMerge(chapterId: string) {
    setError(null);
    setPending(true);
    await applyMerge(project.id, chapterId, { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  async function onUndo() {
    if (!undoVersionId) return;
    setError(null);
    setPending(true);
    const ok = await applyUndo(project.id, undoVersionId, { editStructure, onEdited, onError: setError });
    if (ok) setUndoVersionId(null);
    setPending(false);
  }

  return (
    <Card className="flex w-full max-w-2xl flex-col gap-5 px-8 py-7 text-left">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-app-text">Structure</h2>
          <p className="mt-0.5 text-sm text-app-text-muted">
            {book.mainContent.length} {book.mainContent.length === 1 ? 'part' : 'parts'} · drag to reorder, click a title to rename
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {undoVersionId && (
            <Button variant="link" onClick={() => void onUndo()} disabled={pending} className="text-sm">
              Undo last change
            </Button>
          )}
          <span className="text-xs text-app-text-muted" aria-live="polite">
            {pending ? 'Saving…' : ''}
          </span>
        </div>
      </div>

      {finding && (
        <div role="alert" className="rounded-md border border-app-error bg-app-surface-2 px-4 py-3">
          <p className="text-sm font-semibold text-app-error">0 chapters detected — needs review</p>
          <p className="mt-1 text-sm text-app-text">{finding.message}.</p>
          {finding.suggestion && <p className="mt-1 text-sm text-app-text-muted">{finding.suggestion}.</p>}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-app-error">
          {error}
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{ announcements }}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {book.mainContent.map((content, index) => (
              <SortableChapterRow
                key={content.id}
                content={content}
                index={index}
                disabled={pending}
                onRename={onRename}
                onPromote={onPromote}
                onMerge={onMerge}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </Card>
  );
}
