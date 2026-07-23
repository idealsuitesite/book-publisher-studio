'use client';

import { useRef, useState } from 'react';
import type { ProjectDTO, BookDTO, StructureMutation } from 'shared-types';
import { FrontMatterEditor } from './FrontMatterEditor';
import { StructureSuggestionsPanel } from './StructureSuggestionsPanel';
import { CleanupSuggestionsPanel } from './CleanupSuggestionsPanel';
import { SubchapterSuggestionsPanel } from './SubchapterSuggestionsPanel';
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
import { classifyEditorialTitle } from '@/lib/editorialParts';
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
  // A part divider (PART_LEVEL_STRUCTURE) is announced by its own title — it has no chapter
  // number ("Part I: …" already names itself).
  if (content.type === 'chapter' && content.partOpener) return content.title;
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

/** Mark or unmark a paragraph as a callout (MINI_DR_CALLOUTS commit 4) — the author's gesture
 * that makes the theme's chrome reachable from a real manuscript; extracted like the others. */
export async function applySetCallout(
  projectId: string,
  blockId: string,
  on: boolean,
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'setCallout', blockId, on }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That callout change could not be saved.' : 'Could not reach the server.');
  }
}

/** Move a paragraph's text into its chapter's subtitle field (MINI_DR_SUBTITLE_FIELD commit 3)
 * — the gesture that retires Novel's subtitle-drop-cap limitation; extracted like the others. */
export async function applyMarkAsSubtitle(
  projectId: string,
  blockId: string,
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'markAsSubtitle', blockId }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That subtitle change could not be saved.' : 'Could not reach the server.');
  }
}

/** The inverse: the subtitle returns as the chapter's first paragraph. */
export async function applyClearSubtitle(
  projectId: string,
  chapterId: string,
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'clearSubtitle', chapterId }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That subtitle change could not be saved.' : 'Could not reach the server.');
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

/** Insert a "Part I / Part II" divider before the entry at `index` (PART_LEVEL_STRUCTURE): a
 * titled page grouping the chapters that follow it, by position. Extracted for jsdom testing. */
export async function applyInsertPartOpener(
  projectId: string,
  index: number,
  title: string,
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'insertPartOpener', index, title: trimmed }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That part divider could not be added.' : 'Could not reach the server.');
  }
}

/** Remove a part divider (opener-only — a real chapter can never be deleted through this op; its
 * chapters simply flow to the previous part). Extracted for jsdom testing. */
export async function applyRemovePartOpener(
  projectId: string,
  id: string,
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'removePartOpener', id }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That part divider could not be removed.' : 'Could not reach the server.');
  }
}

/** Edit or clear the rendered front-matter sections (Phase 3b, MINI_DR_EDIT_FRONT_MATTER):
 * undefined leaves a section untouched, null clears it, an object replaces it whole. */
export async function applyEditFrontMatter(
  projectId: string,
  patch: Pick<Extract<StructureMutation, { type: 'editFrontMatter' }>, 'titlePage' | 'copyrightPage'>,
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'editFrontMatter', ...patch }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That front-matter change could not be saved.' : 'Could not reach the server.');
  }
}

/** Tag a top-level part for export placement — front/back matter, or 'main' to revert to a chapter
 * (MINI_DR_EDITORIAL_PLACEMENT). The author action; never auto-inferred. Extracted for jsdom testing. */
export async function applySetPartRole(
  projectId: string,
  id: string,
  role: 'front' | 'back' | 'main',
  deps: { editStructure: typeof editStructure; onEdited: (updated: ProjectDTO) => void; onError: (message: string) => void }
): Promise<void> {
  try {
    deps.onEdited(await deps.editStructure(projectId, { type: 'setPartRole', id, role }));
  } catch (error) {
    deps.onError(error instanceof ApiError ? 'That placement could not be saved.' : 'Could not reach the server.');
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
function BlockList({
  blocks,
  disabled,
  onPromote,
  onSetCallout,
  canMarkSubtitle = false,
  onMarkSubtitle,
}: {
  blocks: ContentBlocks;
  disabled: boolean;
  onPromote: (blockId: string) => void;
  onSetCallout: (blockId: string, on: boolean) => void;
  /** MINI_DR_SUBTITLE_FIELD decision 5 + A2: true only for a top-level chapter with NO subtitle. */
  canMarkSubtitle?: boolean;
  onMarkSubtitle?: (blockId: string) => void;
}) {
  const actionBtn =
    'shrink-0 rounded px-1.5 py-0.5 text-xs text-app-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed disabled:text-app-text-muted disabled:no-underline';
  return (
    <ul className="mt-1.5 flex max-h-56 flex-col gap-0.5 overflow-y-auto border-l border-app-border pl-3">
      {blocks.map((block, index) => (
        <li key={block.id} className="flex items-center justify-between gap-2 py-0.5 text-sm">
          <span className="min-w-0 flex-1 truncate text-app-text-muted">{blockPreview(block)}</span>
          {/* MINI_DR_SUBTITLE_FIELD commit 3: FIRST paragraph row only (A2, disclosed v1
              boundary — the gesture means "the line under the title") and only while the
              chapter has no subtitle (decision 5: clear first, explicitly). */}
          {canMarkSubtitle && index === 0 && block.type === 'paragraph' && onMarkSubtitle && (
            <button
              onClick={() => onMarkSubtitle(block.id)}
              disabled={disabled}
              title="Move this line into the chapter's subtitle, under the title"
              className={actionBtn}
            >
              Make this the chapter subtitle
            </button>
          )}
          {/* MINI_DR_CALLOUTS commit 4: the marking gesture, on the row already rendered (D5 —
              no new rows, the folded panel's height budget untouched). Generic per D2: the badge
              names the mechanism, never a taxonomy. */}
          {block.type === 'paragraph' &&
            (block.callout === true ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded bg-app-surface-2 px-1.5 py-0.5 text-xs text-app-text-muted">Callout</span>
                <button
                  onClick={() => onSetCallout(block.id, false)}
                  disabled={disabled}
                  title="Return this passage to ordinary body text"
                  className={actionBtn}
                >
                  Remove callout
                </button>
              </span>
            ) : (
              <button
                onClick={() => onSetCallout(block.id, true)}
                disabled={disabled}
                title="Distinguish this passage with a callout rule in the exported book"
                className={actionBtn}
              >
                Set off as callout
              </button>
            ))}
          {(block.type === 'paragraph' || block.type === 'heading') && (
            <button onClick={() => onPromote(block.id)} disabled={disabled} className={actionBtn}>
              Make this a chapter
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Editorial placement control (MINI_DR_EDITORIAL_PLACEMENT): tag a top-level part as front/back
 * matter so it exports before/after the chapters, or revert to a chapter. When the part's title is
 * canonical (Introduction, Bibliography, …) and it is not yet tagged, the classifier SUGGESTS a
 * placement (ADR-0049 suggest-never-impose) — but the author always decides; nothing auto-relocates.
 */
function PlacementControl({
  content,
  disabled,
  onSetRole,
}: {
  content: BookDTO['mainContent'][number];
  disabled: boolean;
  onSetRole: (id: string, role: 'front' | 'back' | 'main') => void;
}) {
  const btn =
    'shrink-0 rounded px-1.5 py-0.5 text-xs text-app-text-muted hover:text-app-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed';

  if (content.role) {
    return (
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="rounded bg-app-surface-2 px-1.5 py-0.5 text-xs text-app-text-muted">
          {content.role === 'front' ? 'Front matter' : 'Back matter'}
        </span>
        <button onClick={() => onSetRole(content.id, 'main')} disabled={disabled} className={btn}>
          Make a chapter
        </button>
      </span>
    );
  }

  const suggestion = classifyEditorialTitle(content.title);
  return (
    <span className="flex shrink-0 items-center gap-1">
      <button
        onClick={() => onSetRole(content.id, 'front')}
        disabled={disabled}
        className={cx(btn, suggestion?.placement === 'front' && 'text-app-accent')}
        title={suggestion?.placement === 'front' ? `Looks like your ${suggestion.label}` : undefined}
      >
        → front
      </button>
      <button
        onClick={() => onSetRole(content.id, 'back')}
        disabled={disabled}
        className={cx(btn, suggestion?.placement === 'back' && 'text-app-accent')}
        title={suggestion?.placement === 'back' ? `Looks like your ${suggestion.label}` : undefined}
      >
        → back
      </button>
    </span>
  );
}

function SortableChapterRow({
  content,
  index,
  disabled,
  onRename,
  onPromote,
  onMerge,
  onSetRole,
  onInsertPart,
  onRemovePart,
  onSetCallout,
  onMarkSubtitle,
  onClearSubtitle,
}: {
  content: BookDTO['mainContent'][number];
  index: number;
  disabled: boolean;
  onRename: (id: string, title: string) => void;
  onPromote: (blockId: string) => void;
  onMerge: (chapterId: string) => void;
  onSetRole: (id: string, role: 'front' | 'back' | 'main') => void;
  onInsertPart: (index: number) => void;
  onRemovePart: (id: string) => void;
  onSetCallout: (blockId: string, on: boolean) => void;
  onMarkSubtitle: (blockId: string) => void;
  onClearSubtitle: (chapterId: string) => void;
}) {
  const isPartOpener = content.type === 'chapter' && content.partOpener === true;
  const isUnstructured = content.type === 'section' && !content.title.trim();
  const canMerge = content.type === 'chapter' && !isPartOpener && index > 0;
  const blocks = content.content;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: content.id,
    disabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  // A part divider's row (PART_LEVEL_STRUCTURE round 1): its own badge, rename, remove — no word
  // count (it carries none), no merge/placement/blocks/sections. It drags as a plain entry
  // (§3.5: entries move individually; dragging a divider does NOT drag its chapters).
  if (isPartOpener) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className={cx(
          'rounded-md border border-app-accent/40 bg-app-surface-2 px-2 py-2',
          isDragging && 'opacity-60 shadow-[var(--shadow-sheet)]'
        )}
      >
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${content.title}`}
            disabled={disabled}
            className="shrink-0 cursor-grab rounded px-1 text-app-text-muted hover:text-app-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed"
          >
            ⠿
          </button>
          <span className="shrink-0 rounded bg-app-surface-1 px-1.5 py-0.5 text-xs font-medium text-app-accent">Part</span>
          <span className="flex flex-1 items-center text-sm font-medium text-app-text">
            <EditableTitle value={content.title} ariaLabel={content.title} disabled={disabled} onCommit={(t) => onRename(content.id, t)} />
          </span>
          <button
            onClick={() => onRemovePart(content.id)}
            disabled={disabled}
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-app-text-muted hover:text-app-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed"
          >
            Remove divider
          </button>
        </div>
      </li>
    );
  }

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
        {!isUnstructured && <PlacementControl content={content} disabled={disabled} onSetRole={onSetRole} />}
        <button
          onClick={() => onInsertPart(index)}
          disabled={disabled}
          title="Start a part here — inserts a Part divider above this entry"
          aria-label={`Start a part before ${chapterHeading(content)}`}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-app-text-muted hover:text-app-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed"
        >
          + Part
        </button>
      </div>

      {/* MINI_DR_SUBTITLE_FIELD commit 3: a populated chapter shows its subtitle in the header
          area with the visible clear gesture (decision 5 — its own undo, no hidden compound). */}
      {content.type === 'chapter' && content.subtitle && (
        <div className="mt-1 flex items-center gap-2 pl-6">
          <span className="min-w-0 flex-1 truncate text-sm italic text-app-text-muted">{content.subtitle}</span>
          <button
            onClick={() => onClearSubtitle(content.id)}
            disabled={disabled}
            title="Return the subtitle to the chapter's first paragraph"
            className="shrink-0 rounded px-1.5 py-0.5 text-xs text-app-text-muted hover:text-app-text hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed"
          >
            Remove subtitle
          </button>
        </div>
      )}

      {/* CREATE_CHAPTER.md D5: block rows expanded for the unstructured container (act here), on
          demand for a chapter. Only text blocks (paragraph/heading) can become a chapter. */}
      {isUnstructured ? (
        <div className="mt-1">
          <p className="text-xs text-app-text-muted">Turn a paragraph into a chapter to build your structure:</p>
          <BlockList blocks={blocks} disabled={disabled} onPromote={onPromote} onSetCallout={onSetCallout} />
        </div>
      ) : blocks.length > 0 ? (
        <details className="mt-1.5">
          <summary className="cursor-pointer select-none text-xs text-app-text-muted">
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'} — split into chapters
          </summary>
          <BlockList
            blocks={blocks}
            disabled={disabled}
            onPromote={onPromote}
            onSetCallout={onSetCallout}
            canMarkSubtitle={content.type === 'chapter' && !isPartOpener && !content.subtitle}
            onMarkSubtitle={onMarkSubtitle}
          />
        </details>
      ) : null}

      {/* SECTION_FOLDING (MINI_DR_SECTION_FOLDING, Option C): a chapter's sections fold behind a
          per-chapter disclosure, COLLAPSED by default — the header (title + word count + controls)
          stays visible, only the sub-section detail folds. Restores the pre-Phase-3 behaviour a
          refactor dropped, so the panel's height is no longer proportional to the manuscript. */}
      {content.type === 'chapter' && content.sections && content.sections.length > 0 && (
        <details className="ml-6 mt-1.5 border-l border-app-border pl-3">
          <summary className="cursor-pointer select-none text-xs text-app-text-muted">
            {content.sections.length} {content.sections.length === 1 ? 'section' : 'sections'}
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
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
        </details>
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

  async function onSetRole(id: string, role: 'front' | 'back' | 'main') {
    setError(null);
    setPending(true);
    await applySetPartRole(project.id, id, role, { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  // Inserted with a default title, renamed inline right after — the promoteToChapter precedent
  // (title first, refine with the existing EditableTitle; no modal interrupting the author).
  async function onInsertPart(index: number) {
    setError(null);
    setPending(true);
    await applyInsertPartOpener(project.id, index, 'New part', { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  async function onRemovePart(id: string) {
    setError(null);
    setPending(true);
    await applyRemovePartOpener(project.id, id, { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  async function onSetCallout(blockId: string, on: boolean) {
    setError(null);
    setPending(true);
    await applySetCallout(project.id, blockId, on, { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  async function onMarkSubtitle(blockId: string) {
    setError(null);
    setPending(true);
    await applyMarkAsSubtitle(project.id, blockId, { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  async function onClearSubtitle(chapterId: string) {
    setError(null);
    setPending(true);
    await applyClearSubtitle(project.id, chapterId, { editStructure, onEdited: captureUndo, onError: setError });
    setPending(false);
  }

  async function onEditFrontMatter(
    patch: Pick<Extract<StructureMutation, { type: 'editFrontMatter' }>, 'titlePage' | 'copyrightPage'>
  ) {
    setError(null);
    setPending(true);
    await applyEditFrontMatter(project.id, patch, { editStructure, onEdited: captureUndo, onError: setError });
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
          {/* Wording pass (PART_LEVEL_STRUCTURE §6): "parts" used to mean list entries here, which
              would collide head-on with Part dividers. The summary now counts what things ARE. */}
          <p className="mt-0.5 text-sm text-app-text-muted">
            {(() => {
              const chapters = book.mainContent.filter((c) => c.type === 'chapter' && !c.partOpener).length;
              const dividers = book.mainContent.filter((c) => c.type === 'chapter' && c.partOpener === true).length;
              const others = book.mainContent.length - chapters - dividers;
              const bits = [
                dividers > 0 ? `${dividers} ${dividers === 1 ? 'part' : 'parts'}` : null,
                `${chapters} ${chapters === 1 ? 'chapter' : 'chapters'}`,
                others > 0 ? `${others} ${others === 1 ? 'other entry' : 'other entries'}` : null,
              ].filter(Boolean);
              return bits.join(' · ');
            })()}{' '}
            · drag to reorder, click a title to rename
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

      {/* STRUCTURE_ASSIST: chapters the author typed as text, offered for one-gesture confirmation.
          Silent (renders nothing) when there is nothing to suggest — the over-structured pole. */}
      <StructureSuggestionsPanel projectId={project.id} refreshKey={project.updatedAt} onEdited={captureUndo} />

      {/* STRUCTURE_CLEANUP: empty CHAPTER n / editorial markers the author styled as their own
          headings, offered for one-gesture collapse. Silent when there is nothing to collapse —
          the bidirectional mirror (an under-structured book yields nothing here). */}
      <CleanupSuggestionsPanel projectId={project.id} refreshKey={project.updatedAt} onEdited={captureUndo} />

      {/* SUBCHAPTER_PROMOTION: a recurring editorial name (e.g. "Conclusion" in every chapter) offered
          as a per-chapter section — the founder's continuity, never N peer chapters. Silent when
          nothing recurs (the third silence pole). */}
      <SubchapterSuggestionsPanel projectId={project.id} refreshKey={project.updatedAt} onEdited={captureUndo} />

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
          {/* Height-cap backstop (MINI_DR_SECTION_FOLDING §4): per-chapter collapse already bounds
              the default height, but a section-dense book with many chapters expanded must still
              never grow without bound — the D5 principle. dnd-kit auto-scrolls this container. */}
          <ul className="flex max-h-[70vh] flex-col gap-1.5 overflow-y-auto pr-1">
            {book.mainContent.map((content, index) => (
              <SortableChapterRow
                key={content.id}
                content={content}
                index={index}
                disabled={pending}
                onRename={onRename}
                onPromote={onPromote}
                onMerge={onMerge}
                onSetRole={onSetRole}
                onInsertPart={onInsertPart}
                onRemovePart={onRemovePart}
                onSetCallout={onSetCallout}
                onMarkSubtitle={onMarkSubtitle}
                onClearSubtitle={onClearSubtitle}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Phase 3b (MINI_DR_EDIT_FRONT_MATTER): the rendered front-matter sections, editable.
          Keyed on updatedAt so a server-applied edit re-seeds the form with the stored values. */}
      <FrontMatterEditor
        key={project.updatedAt}
        frontMatter={book.frontMatter}
        disabled={pending}
        onApply={(patch) => void onEditFrontMatter(patch)}
      />
    </Card>
  );
}
