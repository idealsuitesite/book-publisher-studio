import { describe, it, expect } from 'vitest';
import { Packaging } from './Packaging';
import { createBook } from '../models/Book';

describe('Packaging', () => {
  const packaging = new Packaging();

  it('assembles a bundle carrying every rendered format received, not one pre-chosen format', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });
    const renderedOutputs = { pdf: Buffer.from('pdf'), epub: Buffer.from('epub') };

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
      docx: Buffer.from('d'),
      pdf: Buffer.from('p'),
      epub: Buffer.from('e'),
    });
    expect(bundle.manifest.formatsIncluded).toEqual(['pdf', 'epub', 'docx']);
  });

  it('records an empty formatsIncluded list when no format was rendered', () => {
    const book = createBook({ title: 'T', author: 'A', language: 'en' });
    const bundle = packaging.assemble(book, {});
    expect(bundle.manifest.formatsIncluded).toEqual([]);
  });
});
