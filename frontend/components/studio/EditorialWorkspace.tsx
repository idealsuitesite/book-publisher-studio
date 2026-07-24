'use client';

import { useCallback, useMemo, useState, type ReactNode, type ReactElement } from 'react';
import type {
  ProjectDTO,
  EditorialObjectDTO,
  EditorialSourceRefDTO,
  ContentDTO,
  SectionDTO,
  BlockDTO,
  StructureMutation,
} from 'shared-types';
import { cx } from '@/components/ui';
import { LiveProof } from '@/components/studio/LiveProof';
import { editStructure } from '@/lib/api-client';
import { describeStructureError } from '@/lib/structure-errors';

/**
 * The editorial workspace (AUTHOR_EXPERIENCE_DR §8 M1–M2) — the new primary surface, built beside the
 * old stations (the safety net) until it fully carries them (M4). Three panels: the typed editorial
 * skeleton on the LEFT (`project.skeleton`, the D1 projection), the selected object's document in the
 * CENTRE, and the living Proof PERMANENT on the RIGHT (C3, Principle 3).
 *
 * M2-C4 adds CONTEXTUAL EDITING (D3, criterion B): a "Convert to…" menu on the selected block/object
 * dispatches the EXISTING ops — no new conversion is invented (Insert is out). Every gesture goes
 * through `editStructure` → `EditBookUseCase` and the panel re-renders from the returned project (the
 * fresh `ProjectDTO.skeleton` included). This is the SINGLE WRITE PATH held under real use (CTO graven
 * gate point 1): the UI NEVER mutates the projection or the book directly — it dispatches an op and
 * reads the result. Editing is enabled only when `onEdited` is provided.
 *
 * The D8 grammar (CTO Divergence-2, locked by C2's judge and preserved through M2): the skeleton
 * exposes NO title-retype path (titles are static text, never inputs) and NO authorable number (the
 * number is a rendered datum — `CHAPTER_TITLE_PRESENTATION`). C4's editing is entirely menu-driven —
 * no text entry — so no textbox exists even in the editing studio; title editing is D6's own surface
 * (M3). The founder's real book 3 proved WHY the number is computed: his titles say "CHAPTER 1/3/8"
 * while the skeleton counts a clean 1..n beneath them (DR D8, terrain validation).
 */

function refKey(ref: EditorialSourceRefDTO): string {
  return ref.kind === 'content' ? `content:${ref.id}` : `front-matter:${ref.slot}`;
}

/** The first navigable object — a body chapter if there is one, else the first object of any kind. */
function firstSelectableKey(objects: readonly EditorialObjectDTO[]): string | undefined {
  const chapter = objects.find((o) => o.type === 'chapter');
  return (chapter ?? objects[0]) ? refKey((chapter ?? objects[0]).sourceRef) : undefined;
}

function findTopLevelContent(project: ProjectDTO, id: string): ContentDTO | undefined {
  return project.book.mainContent.find((c) => c.id === id);
}

const PLACE_BADGE: Record<'front' | 'back', string> = { front: 'Front', back: 'Back' };

/**
 * The living-Proof wiring, injected by the page. Optional: the read tests exercise skeleton+document
 * without mounting the Proof pipeline. When present, the Proof is the permanent third panel (C3).
 */
export interface WorkspaceProof {
  exporter: () => Promise<Blob>;
  /** A GEOMETRY-only key (theme/layout/accent/typography — NOT `updatedAt`): a change forces a full
   *  render. Content edits go through `editNonce` (the region loop), so this must exclude `updatedAt`,
   *  else every edit would trigger a full render and defeat the loop. */
  settingsKey: string;
  layoutLabel: string;
  themeLabel: string;
  onPageCount?: (pages: number | null) => void;
}

export function EditorialWorkspace({
  project,
  proof,
  onEdited,
}: {
  project: ProjectDTO;
  proof?: WorkspaceProof;
  /** Enables editing (D3). Given the returned project after an op, so the parent re-renders. */
  onEdited?: (updated: ProjectDTO) => void;
}) {
  const objects = project.skeleton.objects;
  const [selectedKey, setSelectedKey] = useState<string | undefined>(() => firstSelectableKey(objects));
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after each successful CONTENT edit — the live Proof region-re-inks the visible window (D4).
  const [editNonce, setEditNonce] = useState(0);
  // The last returnable change (AUTHOR_EXPERIENCE M3 P1-defect: the promote gesture needed a visible
  // undo). Set after any versioning edit; the newest version is the pre-edit snapshot, so restoring it
  // returns the author to exactly where they were. Cleared once they return, or when they navigate away.
  const [lastChange, setLastChange] = useState<{ versionId: string; label: string } | null>(null);

  // Resolve the open object; if a prior selection was edited away (merged/collapsed), fall back to the
  // first object rather than an empty centre.
  const resolved = useMemo(() => {
    const match = objects.find((o) => refKey(o.sourceRef) === selectedKey);
    return match ?? objects.find((o) => refKey(o.sourceRef) === firstSelectableKey(objects));
  }, [objects, selectedKey]);

  const dispatch = useCallback(
    async (mutation: StructureMutation): Promise<boolean> => {
      if (!onEdited || busy) return false;
      setBusy(true);
      setError(null);
      try {
        const updated = await editStructure(project.id, mutation);
        onEdited(updated); // the single write path: read the result, never mutate locally
        setSelectedBlockId(null);
        setEditNonce((n) => n + 1); // signal the live Proof to region-re-ink the visible window
        if (mutation.type === 'restoreVersion') {
          setLastChange(null); // the author just returned — no change to offer returning from
        } else {
          // The snapshot-before-edit is the newest version; restoring it returns the author here.
          const newest = updated.versions[updated.versions.length - 1];
          setLastChange(newest ? { versionId: newest.id, label: changeLabel(mutation) } : null);
        }
        return true;
      } catch (e) {
        setError(describeStructureError(e)); // author-language, never a raw server string (P1-defect)
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onEdited, busy, project.id]
  );

  const editing = Boolean(onEdited);

  return (
    <div className="flex w-full flex-1 gap-6">
      {/* LEFT — the typed editorial skeleton (static rows; the grammar lock) */}
      <nav
        aria-label="Editorial skeleton"
        className="w-64 shrink-0 overflow-y-auto rounded-lg border border-app-border bg-app-surface-1 p-3"
      >
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-app-text-muted">Editorial skeleton</p>
        <ul className="flex flex-col gap-0.5">
          {objects.map((object) => {
            const key = refKey(object.sourceRef);
            const active = key === (resolved ? refKey(resolved.sourceRef) : undefined);
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedKey(key);
                    setSelectedBlockId(null);
                  }}
                  aria-current={active ? 'true' : undefined}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                    'transition-colors duration-[var(--motion-micro)]',
                    active
                      ? 'bg-app-surface-2 font-medium text-app-text shadow-[var(--shadow-sheet)]'
                      : 'text-app-text-muted hover:bg-app-surface-2 hover:text-app-text'
                  )}
                >
                  <SkeletonLead object={object} />
                  {/* Title is STATIC TEXT — never an input (the D8 no-retype grammar). */}
                  <span className="truncate">{object.title}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* D2 (M3-C7): compose a dead-but-typed front-matter section from the author's own words. */}
        {editing && <AddFrontMatterAffordance busy={busy} onDispatch={dispatch} />}
      </nav>

      {/* CENTRE — the selected object's document */}
      <article
        aria-label="Document"
        className="flex-1 overflow-y-auto rounded-lg border border-app-border bg-app-surface-1 px-8 py-7"
      >
        {/* The visible way back from the last gesture (P1-defect): shown where the change was just made. */}
        {editing && lastChange && (
          <div className="mx-auto mb-4 w-full max-w-2xl">
            <UndoBar
              label={lastChange.label}
              busy={busy}
              onUndo={() => dispatch({ type: 'restoreVersion', versionId: lastChange.versionId })}
            />
          </div>
        )}
        {resolved ? (
          <DocumentView
            project={project}
            object={resolved}
            editing={editing}
            busy={busy}
            error={error}
            selectedBlockId={selectedBlockId}
            onSelectBlock={setSelectedBlockId}
            onDispatch={dispatch}
          />
        ) : (
          <p className="text-sm text-app-text-muted">This book has no editorial objects yet.</p>
        )}
      </article>

      {/* RIGHT — the living Proof, permanent (Principle 3), with the D4 region-fetch loop (C5). */}
      {proof && (
        <div aria-label="Proof" className="w-[26rem] shrink-0 overflow-y-auto" role="region">
          <LiveProof
            projectId={project.id}
            exporter={proof.exporter}
            settingsKey={proof.settingsKey}
            layoutLabel={proof.layoutLabel}
            themeLabel={proof.themeLabel}
            editNonce={editNonce}
            onPageCount={proof.onPageCount}
          />
        </div>
      )}
    </div>
  );
}

/** The leading marker of a skeleton row: a computed number for a body chapter, a place badge for
 *  front/back matter, a "Part" tag for a divider. The number is a DATUM — rendered, never editable. */
function SkeletonLead({ object }: { object: EditorialObjectDTO }) {
  if (object.type === 'part-opener') {
    return <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-app-text-muted">Part</span>;
  }
  if (object.type === 'chapter' && object.number !== undefined) {
    return <span className="w-5 shrink-0 text-right text-xs tabular-nums text-app-text-muted">{object.number}</span>;
  }
  if (object.place === 'front' || object.place === 'back') {
    return (
      <span className="shrink-0 rounded bg-app-surface-2 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-app-text-muted">
        {PLACE_BADGE[object.place]}
      </span>
    );
  }
  return <span className="w-5 shrink-0" aria-hidden="true" />;
}

interface DocumentViewProps {
  project: ProjectDTO;
  object: EditorialObjectDTO;
  editing: boolean;
  busy: boolean;
  error: string | null;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onDispatch: (mutation: StructureMutation) => void;
}

function DocumentView({ project, object, editing, busy, error, selectedBlockId, onSelectBlock, onDispatch }: DocumentViewProps) {
  const header =
    object.type === 'chapter' && object.number !== undefined ? `Chapter ${object.number}` : placeLabel(object);
  const content = object.sourceRef.kind === 'content' ? findTopLevelContent(project, object.sourceRef.id) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">{header}</p>
      {/* The document title — static text in M2 (the editable title-field is D6's surface, M3). */}
      <h2 className="text-2xl font-semibold text-app-text" style={{ fontFamily: 'var(--font-book), Georgia, serif' }}>
        {object.title}
      </h2>

      {editing && <ObjectActions project={project} object={object} busy={busy} onDispatch={onDispatch} />}
      {editing && selectedBlockId && <BlockActions busy={busy} onDispatch={onDispatch} blockId={selectedBlockId} />}
      {error && (
        <p role="alert" className="rounded-md border border-app-error/40 bg-app-error/10 px-3 py-2 text-sm text-app-error">
          {error}
        </p>
      )}

      {content ? (
        <ContentBody
          content={content}
          editing={editing}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
        />
      ) : (
        <p className="text-sm text-app-text-muted">
          {object.sourceRef.kind === 'front-matter'
            ? 'A composed front-matter section — its content renders in the Proof.'
            : 'No content to show.'}
        </p>
      )}
    </div>
  );
}

/** Object-level ops on the OPEN top-level object: placement (setPartRole), merge, remove-divider. */
function ObjectActions({
  project,
  object,
  busy,
  onDispatch,
}: {
  project: ProjectDTO;
  object: EditorialObjectDTO;
  busy: boolean;
  onDispatch: (mutation: StructureMutation) => void;
}) {
  if (object.sourceRef.kind !== 'content') return null;
  const id = object.sourceRef.id;

  if (object.type === 'part-opener') {
    return (
      <ActionBar label="Divider">
        <ActionButton busy={busy} onClick={() => onDispatch({ type: 'removePartOpener', id })}>
          Remove divider
        </ActionButton>
      </ActionBar>
    );
  }

  const index = project.book.mainContent.findIndex((c) => c.id === id);
  const canMerge = object.type === 'chapter' && index > 0;
  const roleOptions: { label: string; role: 'front' | 'main' | 'back'; active: boolean }[] = [
    { label: 'Front', role: 'front', active: object.place === 'front' },
    { label: 'Body', role: 'main', active: object.place === 'body' },
    { label: 'Back', role: 'back', active: object.place === 'back' },
  ];

  return (
    <ActionBar label="This object">
      <span className="text-xs text-app-text-muted">Placement</span>
      <div className="flex overflow-hidden rounded-md border border-app-border">
        {roleOptions.map((option) => (
          <button
            key={option.role}
            type="button"
            disabled={busy || option.active}
            onClick={() => onDispatch({ type: 'setPartRole', id, role: option.role })}
            className={cx(
              'px-2 py-1 text-xs',
              option.active ? 'bg-app-surface-2 font-medium text-app-text' : 'text-app-text-muted hover:bg-app-surface-2'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {canMerge && (
        <ActionButton busy={busy} onClick={() => onDispatch({ type: 'mergeChapterIntoPrevious', chapterId: id })}>
          Merge into previous
        </ActionButton>
      )}
    </ActionBar>
  );
}

/** Block-level "Convert to…" ops on the SELECTED line — the existing create ops, no new conversion. */
function BlockActions({ blockId, busy, onDispatch }: { blockId: string; busy: boolean; onDispatch: (m: StructureMutation) => void }) {
  return (
    <ActionBar label="Convert selection to">
      <ActionButton busy={busy} onClick={() => onDispatch({ type: 'promoteToChapter', blockId })}>
        Chapter
      </ActionButton>
      <ActionButton busy={busy} onClick={() => onDispatch({ type: 'promoteToSubsection', blockId })}>
        Section of this chapter
      </ActionButton>
      <ActionButton busy={busy} onClick={() => onDispatch({ type: 'markAsSubtitle', blockId })}>
        Subtitle
      </ActionButton>
    </ActionBar>
  );
}

function ActionBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-app-border bg-app-surface-2/40 px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">{label}</span>
      {children}
    </div>
  );
}

function ActionButton({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-md border border-app-border px-2.5 py-1 text-xs font-medium text-app-text hover:bg-app-surface-2 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function placeLabel(object: EditorialObjectDTO): string {
  if (object.type === 'part-opener') return 'Part divider';
  if (object.place === 'front') return 'Front matter';
  if (object.place === 'back') return 'Back matter';
  return 'Section';
}

/** A short editorial label for the just-made change — what the undo bar says the author can return from.
 *  Exhaustive over the mutation union, so a new op must give itself a name here. */
function changeLabel(m: StructureMutation): string {
  switch (m.type) {
    case 'promoteToChapter':
      return 'New chapter';
    case 'promoteToSubsection':
      return 'New section';
    case 'batchApply':
      return m.op === 'promoteToChapter' ? 'Chapters created' : m.op === 'collapseMarker' ? 'Markers collapsed' : 'Sections created';
    case 'mergeChapterIntoPrevious':
      return 'Merged into previous';
    case 'reorderChapters':
      return 'Reordered';
    case 'rename':
      return 'Renamed';
    case 'setPartRole':
      return 'Placement changed';
    case 'insertPartOpener':
      return 'Divider added';
    case 'removePartOpener':
      return 'Divider removed';
    case 'collapseMarker':
      return 'Marker collapsed';
    case 'setCallout':
      return m.on ? 'Callout marked' : 'Callout cleared';
    case 'markAsSubtitle':
      return 'Subtitle set';
    case 'clearSubtitle':
      return 'Subtitle cleared';
    case 'editFrontMatter':
      return 'Front matter edited';
    case 'addFrontMatterSection':
      return m.section === 'dedication' ? 'Dedication added' : 'Preface added';
    case 'restoreVersion':
      return 'Returned';
    default: {
      const _exhaustive: never = m; // a new mutation type must name itself here
      void _exhaustive;
      return 'Changed';
    }
  }
}

/** The visible way back from the last gesture — surfaced at the gesture's result (P1-defect: the promote
 *  gesture had the mechanic but no affordance). One undo point restores the pre-edit state exactly. */
function UndoBar({ label, busy, onUndo }: { label: string; busy: boolean; onUndo: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-md border border-app-border bg-app-surface-2/60 px-3 py-2"
    >
      <span className="text-sm text-app-text-muted">
        <span className="font-medium text-app-text">{label}.</span> You can undo this.
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onUndo}
        className="rounded-md border border-app-border px-2.5 py-1 text-xs font-medium text-app-text hover:bg-app-surface-2 disabled:opacity-50"
      >
        Undo
      </button>
    </div>
  );
}

/**
 * Compose a dedication or preface from the author's own words (D2, M3-C7) — the add affordance the C6
 * backend was waiting for. Text entry is legitimate here (this is COMPOSITION, not the D8 title-retype
 * grammar the skeleton locks): the author writes the section. The typed text is NEVER lost on failure —
 * the form closes only on success; a failed add leaves the words in place and the workspace error bar
 * explains why (the acceptance criterion: no gesture leaves the author unable to return).
 */
function AddFrontMatterAffordance({
  busy,
  onDispatch,
}: {
  busy: boolean;
  onDispatch: (m: StructureMutation) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<'closed' | 'choose' | 'dedication' | 'preface'>('closed');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const reset = () => {
    setMode('closed');
    setTitle('');
    setText('');
  };

  const submit = async () => {
    const mutation: StructureMutation =
      mode === 'preface'
        ? { type: 'addFrontMatterSection', section: 'preface', title, text }
        : { type: 'addFrontMatterSection', section: 'dedication', text };
    const ok = await onDispatch(mutation);
    if (ok) reset(); // keep the words on failure — never lose the author's text
  };

  const canSubmit = !busy && text.trim() !== '' && (mode !== 'preface' || title.trim() !== '');

  if (mode === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setMode('choose')}
        className="mt-3 flex w-full items-center gap-2 rounded-md border border-dashed border-app-border px-2 py-1.5 text-left text-sm text-app-text-muted hover:border-app-text-muted hover:text-app-text"
      >
        <span aria-hidden="true">＋</span> Add front-matter…
      </button>
    );
  }

  if (mode === 'choose') {
    return (
      <div className="mt-3 flex flex-col gap-1.5 rounded-md border border-app-border p-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-app-text-muted">Add front-matter</p>
        <button type="button" onClick={() => setMode('dedication')} className="rounded px-2 py-1 text-left text-sm text-app-text hover:bg-app-surface-2">
          Dedication
        </button>
        <button type="button" onClick={() => setMode('preface')} className="rounded px-2 py-1 text-left text-sm text-app-text hover:bg-app-surface-2">
          Preface
        </button>
        <button type="button" onClick={reset} className="rounded px-2 py-1 text-left text-xs text-app-text-muted hover:bg-app-surface-2">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-md border border-app-border p-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
        {mode === 'preface' ? 'Preface' : 'Dedication'}
      </p>
      {mode === 'preface' && (
        <input
          type="text"
          aria-label="Preface title"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          className="rounded border border-app-border bg-app-surface-1 px-2 py-1 text-sm text-app-text"
        />
      )}
      <textarea
        aria-label={mode === 'preface' ? 'Preface text' : 'Dedication text'}
        placeholder={mode === 'preface' ? 'Write the preface…' : 'For…'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={busy}
        rows={mode === 'preface' ? 5 : 2}
        className="rounded border border-app-border bg-app-surface-1 px-2 py-1 text-sm text-app-text"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={submit}
          className="rounded-md border border-app-border px-2.5 py-1 text-xs font-medium text-app-text hover:bg-app-surface-2 disabled:opacity-50"
        >
          Add
        </button>
        <button type="button" onClick={reset} disabled={busy} className="rounded px-2 py-1 text-xs text-app-text-muted hover:bg-app-surface-2">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Read-only render of a chapter/section's blocks, then its nested sections. When editing, paragraph
 *  and heading blocks are selectable (the "Convert to…" targets) — no other block type is a target. */
function ContentBody({
  content,
  editing,
  selectedBlockId,
  onSelectBlock,
}: {
  content: ContentDTO;
  editing: boolean;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
}) {
  const children: SectionDTO[] = (content.type === 'chapter' ? content.sections : content.subsections) ?? [];
  return (
    <div className="flex flex-col gap-3 text-app-text">
      {(content.content ?? []).map((block) => (
        <BlockView
          key={block.id}
          block={block}
          editing={editing}
          selected={block.id === selectedBlockId}
          onSelect={onSelectBlock}
        />
      ))}
      {children.map((section) => (
        <section key={section.id} className="mt-3 flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-app-text">{section.title}</h3>
          <ContentBody content={section} editing={editing} selectedBlockId={selectedBlockId} onSelectBlock={onSelectBlock} />
        </section>
      ))}
    </div>
  );
}

function BlockView({
  block,
  editing,
  selected,
  onSelect,
}: {
  block: BlockDTO;
  editing: boolean;
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const selectable = editing && (block.type === 'paragraph' || block.type === 'heading');
  const inner = renderBlock(block);
  if (!selectable) return inner;
  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? null : block.id)}
      aria-pressed={selected}
      className={cx(
        'rounded-md px-2 py-1 text-left transition-colors duration-[var(--motion-micro)]',
        selected ? 'bg-app-accent/10 ring-1 ring-app-accent' : 'hover:bg-app-surface-2'
      )}
    >
      {inner}
    </button>
  );
}

function renderBlock(block: BlockDTO): ReactElement | null {
  switch (block.type) {
    case 'heading':
      return <p className="font-semibold text-app-text">{block.text}</p>;
    case 'paragraph':
      return (
        <p className={cx('leading-relaxed', block.callout && 'border-l-2 border-app-border pl-3 italic')}>{block.text}</p>
      );
    case 'quote':
    case 'scripture':
      return <blockquote className="border-l-2 border-app-border pl-3 italic text-app-text-muted">{block.text}</blockquote>;
    case 'list':
      return block.ordered ? (
        <ol className="ml-5 list-decimal leading-relaxed">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      ) : (
        <ul className="ml-5 list-disc leading-relaxed">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case 'image':
      return (
        <p className="text-sm text-app-text-muted">[image{block.caption ? `: ${block.caption}` : block.alt ? `: ${block.alt}` : ''}]</p>
      );
    case 'table':
      return <p className="text-sm text-app-text-muted">[table{block.caption ? `: ${block.caption}` : ''}]</p>;
    default:
      // Footnotes render inline in the export, not as standalone read-view blocks; skip. (Dividers /
      // page-breaks are not carried on BlockDTO at all.)
      return null;
  }
}
