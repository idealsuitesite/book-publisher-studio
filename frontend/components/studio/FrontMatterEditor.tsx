'use client';

import { useState } from 'react';
import type { FrontMatterDTO, TitlePageDTO, CopyrightPageDTO, StructureMutation } from 'shared-types';
import { Button } from '@/components/ui';

/**
 * The front-matter editor (Phase 3b, MINI_DR_EDIT_FRONT_MATTER §2.5): the author edits or
 * removes the title page and the copyright page — the two sections every export renders.
 *
 * Replace-whole semantics (§2.2): each Save submits its section's COMPLETE field set, so the
 * form carries every field — a partial form would silently wipe the fields it omitted. Server-
 * authoritative like every structure edit: the parent applies the returned project, snapshot
 * and undo ride the existing mutation path for free.
 */
interface FrontMatterEditorProps {
  frontMatter: FrontMatterDTO | undefined;
  disabled: boolean;
  onApply: (patch: Pick<Extract<StructureMutation, { type: 'editFrontMatter' }>, 'titlePage' | 'copyrightPage'>) => void;
}

const inputCls =
  'w-full rounded border border-app-border bg-app-surface-1 px-2 py-1 text-sm text-app-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent';
const labelCls = 'flex flex-col gap-0.5 text-xs text-app-text-muted';
const saveCls =
  'w-fit rounded px-2 py-1 text-xs font-medium text-app-text underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent disabled:cursor-not-allowed disabled:opacity-50';

export function FrontMatterEditor({ frontMatter, disabled, onApply }: FrontMatterEditorProps) {
  const [title, setTitle] = useState<TitlePageDTO>({
    title: frontMatter?.titlePage?.title ?? '',
    subtitle: frontMatter?.titlePage?.subtitle ?? '',
    author: frontMatter?.titlePage?.author ?? '',
    tagline: frontMatter?.titlePage?.tagline ?? '',
  });
  const [copyright, setCopyright] = useState<CopyrightPageDTO>({
    text: frontMatter?.copyrightPage?.text ?? '',
    isbn: frontMatter?.copyrightPage?.isbn ?? '',
    copyrightText: frontMatter?.copyrightPage?.copyrightText ?? '',
    legalNotice: frontMatter?.copyrightPage?.legalNotice ?? '',
    printingInfo: frontMatter?.copyrightPage?.printingInfo ?? '',
  });

  const canSaveTitle = title.title.trim() !== '' && title.author.trim() !== '';
  const canSaveCopyright = copyright.text.trim() !== '';

  return (
    <details className="mt-1.5 rounded-md border border-app-border px-3 py-2">
      <summary className="cursor-pointer select-none text-sm font-medium text-app-text">
        Title page &amp; copyright
        <span className="ml-2 text-xs font-normal text-app-text-muted">
          {frontMatter?.titlePage ? 'title page' : 'no title page'} · {frontMatter?.copyrightPage ? 'copyright page' : 'no copyright page'}
        </span>
      </summary>

      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <section aria-label="Title page" className="flex flex-col gap-1.5">
          <label className={labelCls}>
            Title
            <input className={inputCls} value={title.title} disabled={disabled} onChange={(e) => setTitle({ ...title, title: e.target.value })} />
          </label>
          <label className={labelCls}>
            Subtitle
            <input className={inputCls} value={title.subtitle} disabled={disabled} onChange={(e) => setTitle({ ...title, subtitle: e.target.value })} />
          </label>
          <label className={labelCls}>
            Author
            <input className={inputCls} value={title.author} disabled={disabled} onChange={(e) => setTitle({ ...title, author: e.target.value })} />
          </label>
          <label className={labelCls}>
            Tagline
            <input className={inputCls} value={title.tagline} disabled={disabled} onChange={(e) => setTitle({ ...title, tagline: e.target.value })} />
          </label>
          <div className="flex items-center gap-2">
            <button
              className={saveCls}
              disabled={disabled || !canSaveTitle}
              title={canSaveTitle ? undefined : 'A title page needs a title and an author'}
              onClick={() => onApply({ titlePage: title })}
            >
              Save title page
            </button>
            {frontMatter?.titlePage && (
              <Button variant="link" className="text-xs" disabled={disabled} onClick={() => onApply({ titlePage: null })}>
                Remove page
              </Button>
            )}
          </div>
        </section>

        <section aria-label="Copyright page" className="flex flex-col gap-1.5">
          <label className={labelCls}>
            Copyright line
            <input className={inputCls} value={copyright.text} disabled={disabled} onChange={(e) => setCopyright({ ...copyright, text: e.target.value })} />
          </label>
          <label className={labelCls}>
            ISBN
            <input className={inputCls} value={copyright.isbn} disabled={disabled} onChange={(e) => setCopyright({ ...copyright, isbn: e.target.value })} />
          </label>
          <label className={labelCls}>
            Legal notice
            <input className={inputCls} value={copyright.legalNotice} disabled={disabled} onChange={(e) => setCopyright({ ...copyright, legalNotice: e.target.value })} />
          </label>
          <label className={labelCls}>
            Printing info
            <input className={inputCls} value={copyright.printingInfo} disabled={disabled} onChange={(e) => setCopyright({ ...copyright, printingInfo: e.target.value })} />
          </label>
          <div className="flex items-center gap-2">
            <button
              className={saveCls}
              disabled={disabled || !canSaveCopyright}
              title={canSaveCopyright ? undefined : 'A copyright page needs its copyright line'}
              onClick={() => onApply({ copyrightPage: copyright })}
            >
              Save copyright page
            </button>
            {frontMatter?.copyrightPage && (
              <Button variant="link" className="text-xs" disabled={disabled} onClick={() => onApply({ copyrightPage: null })}>
                Remove page
              </Button>
            )}
          </div>
        </section>
      </div>
    </details>
  );
}
