import { describe, it, expect } from 'vitest';
import { KDPRuleProvider } from './KDPRuleProvider';
import { KDP_RULE_DATA } from './KDPRuleData';
import { createBook } from '../../models/Book';
import type { PublishingBundle } from '../../models/PublishingBundle';

function emptyBundle(): PublishingBundle {
  return {
    manuscript: {},
    metadata: { title: '', author: '', language: '' },
    assets: [],
    manifest: { formatsIncluded: [], hasCover: false, assembledAt: new Date() },
  };
}

describe('KDPRuleProvider', () => {
  it('implements ValidationRuleProvider - getRules() returns the 5 real rules, not a promise or a class', () => {
    const provider = new KDPRuleProvider();

    const rules = provider.getRules();

    expect(rules).toHaveLength(5);
    expect(rules.map((r) => r.name).sort()).toEqual([
      'CoverPresenceRule',
      'InteriorFormatAvailabilityRule',
      'PageCountRule',
      'RequiredMetadataFieldsRule',
      'StructurePresenceRule',
    ]);
  });

  it('defaults to the real spike-verified KDP_RULE_DATA when no data is injected', () => {
    const provider = new KDPRuleProvider();
    const [requiredFieldsRule] = provider.getRules();
    const book = createBook({ title: '', author: '', language: '' });

    const issues = requiredFieldsRule.evaluate({ book, bundle: emptyBundle() });

    expect(issues.map((i) => i.message)).toEqual(
      KDP_RULE_DATA.requiredMetadataFields.map((f) => `Required metadata field "${f}" is missing.`)
    );
  });

  it('accepts injected KDPRuleData, for a future test double or a KDP spec update', () => {
    const customData = { ...KDP_RULE_DATA, requiredMetadataFields: ['title' as const] };
    const provider = new KDPRuleProvider(customData);
    const [requiredFieldsRule] = provider.getRules();
    const book = createBook({ title: '', author: '', language: '' });

    const issues = requiredFieldsRule.evaluate({ book, bundle: emptyBundle() });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('"title"');
  });
});
