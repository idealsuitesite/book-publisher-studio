'use client';

import { useMemo, useState } from 'react';
import type {
  ProjectDTO,
  EditorialObjectDTO,
  EditorialSourceRefDTO,
  ContentDTO,
  SectionDTO,
  BlockDTO,
} from 'shared-types';
import { cx } from '@/components/ui';

/**
 * The editorial workspace (AUTHOR_EXPERIENCE_DR §8 M1-C2) — the new primary surface, built beside
 * the old stations (the safety net) until it fully carries them (M4). This commit is the READ studio:
 * the typed editorial skeleton on the LEFT (`project.skeleton`, the D1 projection) and the selected
 * object's document in the CENTRE, read-only. C3 adds the permanent Proof as the third panel; editing
 * (D3) and the live loop (D4) arrive in M2. Navigation only — no mutation reaches the book here.
 *
 * The D8 grammar, designed in from the start (CTO Divergence-2 condition, locked by C2's judge): the
 * skeleton exposes NO title-retype path (titles are static text, never inputs) and NO authorable
 * number (the chapter number is a rendered datum — `CHAPTER_TITLE_PRESENTATION` — never an editable
 * field). Confirm-not-retype and computed numbers are properties of the skeleton's grammar; they are
 * built here, before M2's editing wiring, so nothing can later introduce a retype path unnoticed.
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

export function EditorialWorkspace({ project }: { project: ProjectDTO }) {
  const objects = project.skeleton.objects;
  const [selectedKey, setSelectedKey] = useState<string | undefined>(() => firstSelectableKey(objects));

  const selected = useMemo(
    () => objects.find((o) => refKey(o.sourceRef) === selectedKey),
    [objects, selectedKey]
  );

  return (
    <div className="flex w-full flex-1 gap-6">
      {/* LEFT — the typed editorial skeleton */}
      <nav
        aria-label="Editorial skeleton"
        className="w-64 shrink-0 overflow-y-auto rounded-lg border border-app-border bg-app-surface-1 p-3"
      >
        <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
          Editorial skeleton
        </p>
        <ul className="flex flex-col gap-0.5">
          {objects.map((object) => {
            const key = refKey(object.sourceRef);
            const active = key === selectedKey;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(key)}
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
      </nav>

      {/* CENTRE — the selected object's document, read-only */}
      <article
        aria-label="Document"
        className="flex-1 overflow-y-auto rounded-lg border border-app-border bg-app-surface-1 px-8 py-7"
      >
        {selected ? (
          <DocumentView project={project} object={selected} />
        ) : (
          <p className="text-sm text-app-text-muted">This book has no editorial objects yet.</p>
        )}
      </article>
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

function DocumentView({ project, object }: { project: ProjectDTO; object: EditorialObjectDTO }) {
  // The number header — a rendered datum, NOT an editable field (CHAPTER_TITLE_PRESENTATION).
  const header =
    object.type === 'chapter' && object.number !== undefined ? `Chapter ${object.number}` : placeLabel(object);

  const content = object.sourceRef.kind === 'content' ? findTopLevelContent(project, object.sourceRef.id) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">{header}</p>
      {/* The document title — static text, never an input in the read studio (D8). */}
      <h2 className="text-2xl font-semibold text-app-text" style={{ fontFamily: 'var(--font-book), Georgia, serif' }}>
        {object.title}
      </h2>
      {content ? (
        <ContentBody content={content} />
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

function placeLabel(object: EditorialObjectDTO): string {
  if (object.type === 'part-opener') return 'Part divider';
  if (object.place === 'front') return 'Front matter';
  if (object.place === 'back') return 'Back matter';
  return 'Section';
}

/** Read-only render of a chapter/section's blocks, then its nested sections. */
function ContentBody({ content }: { content: ContentDTO }) {
  const children: SectionDTO[] = (content.type === 'chapter' ? content.sections : content.subsections) ?? [];
  return (
    <div className="flex flex-col gap-3 text-app-text">
      {(content.content ?? []).map((block) => (
        <BlockView key={block.id} block={block} />
      ))}
      {children.map((section) => (
        <section key={section.id} className="mt-3 flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-app-text">{section.title}</h3>
          <ContentBody content={section} />
        </section>
      ))}
    </div>
  );
}

function BlockView({ block }: { block: BlockDTO }) {
  switch (block.type) {
    case 'heading':
      return <p className="font-semibold text-app-text">{block.text}</p>;
    case 'paragraph':
      return (
        <p className={cx('leading-relaxed', block.callout && 'border-l-2 border-app-border pl-3 italic')}>
          {block.text}
        </p>
      );
    case 'quote':
    case 'scripture':
      return (
        <blockquote className="border-l-2 border-app-border pl-3 italic text-app-text-muted">{block.text}</blockquote>
      );
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
