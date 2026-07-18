import { describe, it, expect } from 'vitest';
import { KDPTarget } from './KDPTarget';
import { Packaging } from '../Packaging';
import { SubmissionValidator } from '../SubmissionValidator';
import { KDPRuleProvider } from './KDPRuleProvider';
import { createBook } from '../../models/Book';
import type { Book } from '../../models/Book';
import type { PublishingBundle } from '../../models/PublishingBundle';
import type { RenderedOutputs, PublishingIssue } from '../../models/PublishingReport';
import type { ValidationRuleProvider } from '../../ports/ValidationRuleProvider';
import type { PostRenderValidationRule } from './PostRenderValidationRule';

function compliantBook(): Book {
  return {
    ...createBook({ title: 'T', author: 'A', language: 'en', isbn: '978-0' }),
    pageCount: 200,
  };
}

describe('KDPTarget - real integration (Packaging + SubmissionValidator + KDPRuleProvider)', () => {
  const target = new KDPTarget(new Packaging(), new SubmissionValidator(new KDPRuleProvider()));

  it('returns a PASS report with target "kdp" for a fully compliant manuscript', () => {
    const report = target.prepare(compliantBook(), { pdf: Buffer.from('pdf') });

    expect(report.status).toBe('PASS');
    expect(report.target).toBe('kdp');
    // issues includes every finding regardless of severity - here, only the real,
    // honestly-disclosed cover-image gap (Risk 4), a WARNING, not an ERROR - so status is
    // still PASS.
    expect(report.issues).toEqual([
      { code: 'NO_COVER_IMAGE', message: 'No cover image was found in the manuscript.', severity: 'WARNING' },
    ]);
    expect(report.warnings).toEqual(['No cover image was found in the manuscript.']);
  });

  it('returns FAIL when the manuscript has at least one real ERROR-severity finding', () => {
    const incomplete = createBook({ title: 'T', author: 'A', language: 'en' }); // no isbn, no pageCount

    const report = target.prepare(incomplete, {});

    expect(report.status).toBe('FAIL');
    expect(report.issues.some((i) => i.code === 'MISSING_REQUIRED_METADATA')).toBe(true);
  });

  it('artifacts reflects exactly the bundle\'s formatsIncluded - not a separate computation', () => {
    const report = target.prepare(compliantBook(), { pdf: Buffer.from('p'), docx: Buffer.from('d') });

    expect(report.artifacts).toEqual(['pdf', 'docx']);
  });

  it('duration is a real, non-negative measurement', () => {
    const report = target.prepare(compliantBook(), {});

    expect(report.duration).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(report.duration)).toBe(true);
  });

  it('does not mutate the book it receives', () => {
    const book = compliantBook();
    const snapshot = structuredClone(book);

    target.prepare(book, { pdf: Buffer.from('p') });

    expect(book).toEqual(snapshot);
  });
});

describe('KDPTarget - is a consumer, never a replacement (CTO requirement, Commit 3->4 review)', () => {
  it('calls Packaging.assemble() exactly once per prepare()', () => {
    let assembleCalls = 0;
    const spyPackaging: Pick<Packaging, 'assemble'> = {
      assemble(book, renderedOutputs) {
        assembleCalls += 1;
        return new Packaging().assemble(book, renderedOutputs);
      },
    };
    const target = new KDPTarget(spyPackaging as Packaging, new SubmissionValidator(new KDPRuleProvider()));

    target.prepare(compliantBook(), {});

    expect(assembleCalls).toBe(1);
  });

  it('calls SubmissionValidator.validate() exactly once per prepare(), with the exact bundle Packaging produced', () => {
    let receivedBundle: PublishingBundle | undefined;
    const realPackaging = new Packaging();
    const spyValidator: Pick<SubmissionValidator, 'validate'> = {
      validate(context) {
        receivedBundle = context.bundle;
        return [];
      },
    };
    const target = new KDPTarget(realPackaging, spyValidator as SubmissionValidator);
    const book = compliantBook();
    const renderedOutputs: RenderedOutputs = { pdf: Buffer.from('p') };

    target.prepare(book, renderedOutputs);

    expect(receivedBundle).toEqual(realPackaging.assemble(book, renderedOutputs));
  });

  it('uses SubmissionValidator\'s findings verbatim - never adds, drops, or re-derives an issue', () => {
    const fakeIssues: PublishingIssue[] = [
      { code: 'FAKE_ERROR', message: 'a fake finding', severity: 'ERROR' },
    ];
    const fakeRule: PostRenderValidationRule = { name: 'FakeRule', evaluate: () => fakeIssues };
    const fakeProvider: ValidationRuleProvider = { getRules: () => [fakeRule] };
    const target = new KDPTarget(new Packaging(), new SubmissionValidator(fakeProvider));

    const report = target.prepare(compliantBook(), {});

    expect(report.issues).toEqual(fakeIssues);
    expect(report.status).toBe('FAIL');
  });
});

describe('createKDPTarget', () => {
  it('wires a real, working KDPTarget end to end', async () => {
    const { createKDPTarget } = await import('./createKDPTarget');
    const target = createKDPTarget();

    const report = target.prepare(compliantBook(), { pdf: Buffer.from('pdf') });

    expect(report.target).toBe('kdp');
    expect(report.status).toBe('PASS');
  });
});
