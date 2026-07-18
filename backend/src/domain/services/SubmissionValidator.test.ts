import { describe, it, expect } from 'vitest';
import { SubmissionValidator } from './SubmissionValidator';
import { KDPRuleProvider } from './publishing/KDPRuleProvider';
import { createBook } from '../models/Book';
import type { ValidationRuleProvider } from '../ports/ValidationRuleProvider';
import type { PostRenderValidationRule } from './publishing/PostRenderValidationRule';
import type { PublishingBundle } from '../models/PublishingBundle';

function bundleWith(overrides: Partial<PublishingBundle['manifest']> = {}): PublishingBundle {
  return {
    manuscript: {},
    metadata: { title: '', author: '', language: '' },
    assets: [],
    manifest: { formatsIncluded: [], hasCover: false, assembledAt: new Date(), ...overrides },
  };
}

describe('SubmissionValidator', () => {
  it('depends only on the ValidationRuleProvider abstraction - a fake provider works with no KDP class involved', () => {
    const rule: PostRenderValidationRule = {
      name: 'FakeRule',
      evaluate: () => [{ code: 'FAKE', message: 'fake issue', severity: 'ERROR' }],
    };
    const fakeProvider: ValidationRuleProvider = { getRules: () => [rule] };
    const validator = new SubmissionValidator(fakeProvider);
    const book = createBook({ title: 'T', author: 'A', language: 'en' });

    const issues = validator.validate({ book, bundle: bundleWith() });

    expect(issues).toEqual([{ code: 'FAKE', message: 'fake issue', severity: 'ERROR' }]);
  });

  it('flattens findings from every rule the provider returns', () => {
    const validator = new SubmissionValidator(new KDPRuleProvider());
    const book = createBook({ title: '', author: '', language: '' }); // fails every required-field check

    const issues = validator.validate({ book, bundle: bundleWith() });

    // RequiredMetadataFieldsRule (3 missing) + PageCountRule (unknown) + CoverPresenceRule (no cover)
    // + InteriorFormatAvailabilityRule (no format) = 6 findings from 4 rules
    expect(issues.length).toBeGreaterThan(1);
    expect(issues.map((i) => i.code)).toContain('MISSING_REQUIRED_METADATA');
    expect(issues.map((i) => i.code)).toContain('NO_ACCEPTED_INTERIOR_FORMAT');
  });

  it('returns no issues for a fully compliant manuscript', () => {
    const validator = new SubmissionValidator(new KDPRuleProvider());
    const book = { ...createBook({ title: 'T', author: 'A', language: 'en', isbn: '978-0' }), pageCount: 200 };

    const issues = validator.validate({ book, bundle: bundleWith({ formatsIncluded: ['pdf'], hasCover: true }) });

    expect(issues).toHaveLength(0);
  });
});
