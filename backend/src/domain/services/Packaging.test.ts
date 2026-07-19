import { describe, it, expect } from 'vitest';
import { Packaging } from './Packaging';
import { createBook } from '../models/Book';
import { KDP6x9PageLayout } from '../layouts/KDP6x9PageLayout';
import type { RenderedOutput } from '../models/PublishingReport';

/** A rendered artifact with its render-time metrics (ADR-0042). */
const output = (text: string, pageCount?: number): RenderedOutput => ({
  bytes: Buffer.from(text),
  metrics: { pageCount, pageLayout: KDP6x9PageLayout },
});

describe('Packaging', () => {
  const packaging = new Packaging();

  it('assembles a bundle carrying every rendered format received, not one pre-chosen format', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });
    const renderedOutputs = { pdf: output('pdf'), epub: output('epub') };

    const bundle = packaging.assemble(book, renderedOutputs);

    expect(bundle.manuscript).toBe(renderedOutputs);
    expect(bundle.manifest.formatsIncluded).toEqual(['pdf', 'epub']);
  });

  it('carries the book metadata unchanged', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });
    const bundle = packaging.assemble(book, {});
    expect(bundle.metadata).toBe(book.metadata);
  });

  it('leaves cover undefined and hasCover false when the book has no embedded cover image (real ASTBuilder gap, Risk 4)', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });
    const bundle = packaging.assemble(book, {});
    expect(bundle.cover).toBeUndefined();
    expect(bundle.manifest.hasCover).toBe(false);
  });

  it('decodes a real embedded base64 cover image into a Buffer', () => {
    const base64 = Buffer.from('fake-image-bytes').toString('base64');
    const book = createBook({
      title: 'T',
      author: 'A',
      language: 'en',
      coverImage: { type: 'image', id: 'cover-1', url: '', base64 },
    });

    const bundle = packaging.assemble(book, {});

    expect(bundle.cover).toEqual(Buffer.from('fake-image-bytes'));
    expect(bundle.manifest.hasCover).toBe(true);
  });

  it('leaves assets empty - no real caller needs anything else this sprint', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });
    const bundle = packaging.assemble(book, {});
    expect(bundle.assets).toEqual([]);
  });

  it('records every included format, in pdf/epub/docx order', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });
    const bundle = packaging.assemble(book, {
      docx: output('d'),
      pdf: output('p'),
      epub: output('e'),
    });
    expect(bundle.manifest.formatsIncluded).toEqual(['pdf', 'epub', 'docx']);
  });

  it('carries render metrics through assembly untouched - Packaging measures nothing itself', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });

    const bundle = packaging.assemble(book, { pdf: output('p', 214), epub: output('e') });

    expect(bundle.manuscript.pdf?.metrics.pageCount).toBe(214);
    // Reflowable: absence is a real answer, not a missing value (ADR-0042).
    expect(bundle.manuscript.epub?.metrics.pageCount).toBeUndefined();
  });

  it('records an empty formatsIncluded list when no format was rendered', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });
    const bundle = packaging.assemble(book, {});
    expect(bundle.manifest.formatsIncluded).toEqual([]);
  });
});
