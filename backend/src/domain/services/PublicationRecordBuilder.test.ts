import { describe, it, expect } from 'vitest';
import { PublicationRecordBuilder } from './PublicationRecordBuilder';
import { ProjectService } from './ProjectService';
import { createBook } from '../models/Book';
import type { PublishingReport } from '../models/PublishingReport';

const builder = new PublicationRecordBuilder();
const settings = { layoutName: 'kdp-6x9', themeName: 'classic' };

function service() {
  let n = 0;
  return new ProjectService(() => `id-${++n}`);
}

const book = (title = 'Le Guide de Jean', isbn?: string) =>
  createBook({ title, author: 'Jean Dupont', language: 'fr', isbn });

const report = (target: string, status: 'PASS' | 'FAIL', at: Date): PublishingReport => ({
  status,
  target,
  issues: [],
  warnings: [],
  artifacts: ['pdf'],
  generatedAt: at,
  duration: 12,
  summary: `${status} - 0 errors, 0 warnings`,
});

describe('PublicationRecordBuilder', () => {
  it('carries the book identity an author would recognise', () => {
    const s = service();
    const project = s.create(book('Le Guide de Jean', '978-0'), settings, 'Working draft');

    const record = builder.build(project);

    expect(record.projectName).toBe('Working draft');
    expect(record.bookTitle).toBe('Le Guide de Jean');
    expect(record.author).toBe('Jean Dupont');
    expect(record.isbn).toBe('978-0');
  });

  it('records failures alongside successes - a rejection is part of the history', () => {
    const s = service();
    let project = s.create(book(), settings);
    project = s.recordPublication(project, report('kdp', 'FAIL', new Date('2026-01-01')));
    project = s.recordPublication(project, report('kdp', 'PASS', new Date('2026-02-01')));

    const record = builder.build(project);

    expect(record.entries.map((e) => e.status)).toEqual(['FAIL', 'PASS']);
  });

  it('reads oldest first - a history, not a library listing', () => {
    const s = service();
    let project = s.create(book(), settings);
    project = s.recordPublication(project, report('kobo', 'PASS', new Date('2026-06-01')));
    project = s.recordPublication(project, report('kdp', 'PASS', new Date('2026-01-01')));

    expect(builder.build(project).entries.map((e) => e.target)).toEqual(['kdp', 'kobo']);
  });

  it('resolves the version reference into a number, not an internal id', () => {
    const s = service();
    let project = s.create(book(), settings);
    project = s.snapshot(project);
    project = s.snapshot(project);
    const secondVersion = project.versions[1];
    project = s.recordPublication(
      project,
      report('kdp', 'PASS', new Date('2026-01-01')),
      secondVersion.id
    );

    expect(builder.build(project).entries[0].versionNumber).toBe(2);
  });

  it('leaves the version number absent when the attempt was not linked to one', () => {
    const s = service();
    let project = s.create(book(), settings);
    project = s.recordPublication(project, report('kdp', 'PASS', new Date('2026-01-01')));

    expect(builder.build(project).entries[0].versionNumber).toBeUndefined();
  });

  it('produces an empty record rather than throwing for a project that never published', () => {
    const record = builder.build(service().create(book(), settings));

    expect(record.entries).toEqual([]);
    expect(record.bookTitle).toBe('Le Guide de Jean');
  });

  it('preserves non-ASCII exactly', () => {
    const project = service().create(book('红楼梦'), settings, 'Édition Spéciale');

    const record = builder.build(project);

    expect(record.bookTitle).toBe('红楼梦');
    expect(record.projectName).toBe('Édition Spéciale');
  });
});

describe('PublicationRecordBuilder - when the record is worth offering (ADR-0044)', () => {
  it('a project that published successfully has a record worth keeping', () => {
    const s = service();
    let project = s.create(book(), settings);
    project = s.recordPublication(project, report('kdp', 'PASS', new Date('2026-01-01')));

    expect(builder.hasRecordWorthKeeping(project)).toBe(true);
  });

  it('failed attempts alone do not count - that is a discarded attempt, not a history', () => {
    const s = service();
    let project = s.create(book(), settings);
    project = s.recordPublication(project, report('kdp', 'FAIL', new Date('2026-01-01')));

    expect(builder.hasRecordWorthKeeping(project)).toBe(false);
  });

  it('a draft that never published has nothing to offer', () => {
    expect(builder.hasRecordWorthKeeping(service().create(book(), settings))).toBe(false);
  });
});
