import { describe, it, expect } from 'vitest';
import { RequiredMetadataFieldsRule } from './RequiredMetadataFieldsRule';
import { createBook } from '../../models/Book';
import type { PublishingBundle } from '../../models/PublishingBundle';

function bundle(): PublishingBundle {
  return { manuscript: {}, metadata: { title: '', author: '', language: '' }, assets: [], manifest: { formatsIncluded: [], hasCover: false, assembledAt: new Date() } };
}

describe('RequiredMetadataFieldsRule', () => {
  it('reports no issues when every required field is present', () => {
    const rule = new RequiredMetadataFieldsRule(['title', 'author', 'isbn', 'language']);
    const book = createBook({ title: 'T', author: 'A', language: 'en', isbn: '978-0' });

    const issues = rule.evaluate({ book, bundle: bundle() });

    expect(issues).toHaveLength(0);
  });

  it('reports one ERROR per missing required field', () => {
    const rule = new RequiredMetadataFieldsRule(['title', 'author', 'isbn', 'language']);
    const book = createBook({ title: 'T', author: 'A', language: 'en' }); // no isbn

    const issues = rule.evaluate({ book, bundle: bundle() });

    expect(issues).toEqual([
      { code: 'MISSING_REQUIRED_METADATA', message: 'Required metadata field "isbn" is missing.', severity: 'ERROR' },
    ]);
  });

  it('treats an empty string the same as a missing field', () => {
    const rule = new RequiredMetadataFieldsRule(['title']);
    const book = createBook({ title: '', author: 'A', language: 'en' });

    const issues = rule.evaluate({ book, bundle: bundle() });

    expect(issues.some((i) => i.code === 'MISSING_REQUIRED_METADATA')).toBe(true);
  });

  it('only checks the fields it was configured with, not a hardcoded KDP list', () => {
    const rule = new RequiredMetadataFieldsRule(['description']);
    const book = createBook({ title: 'T', author: 'A', language: 'en' }); // no isbn either, but not checked

    const issues = rule.evaluate({ book, bundle: bundle() });

    expect(issues).toEqual([
      { code: 'MISSING_REQUIRED_METADATA', message: 'Required metadata field "description" is missing.', severity: 'ERROR' },
    ]);
  });
});
