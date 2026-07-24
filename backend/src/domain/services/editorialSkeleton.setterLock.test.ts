import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as skeletonModule from './editorialSkeleton';
import { projectEditorialSkeleton } from './editorialSkeleton';
import { createBook, type Book } from '../models/Book';

/**
 * D1 setter-lock (AUTHOR_EXPERIENCE_DR §3 D1 / §8 M0-C1, test (i) of two). The load-bearing
 * invariant of the projected read model is a SINGLE WRITE PATH: nothing writes INTO the projection,
 * so it cannot become a fourth representation drifting from the Book. This test enforces that
 * mechanically, three ways — the runtime surface, the import surface, and the returned object.
 * Its complement is `editorialSkeleton.coherence.test.ts` (the read follows the write).
 */

const SOURCE = readFileSync(join(__dirname, 'editorialSkeleton.ts'), 'utf8');

function bookWith2Chapters(): Book {
  return createBook({ title: 'T', author: 'A', language: 'en' }, [
    { type: 'chapter', id: 'c1', number: 1, title: 'One', content: [], createdAt: new Date(), updatedAt: new Date() },
    { type: 'chapter', id: 'c2', number: 2, title: 'Two', content: [], createdAt: new Date(), updatedAt: new Date() },
  ]);
}

describe('editorialSkeleton — the setter-lock (nothing writes into the projection)', () => {
  it('exposes exactly one runtime export — the pure projection — and no mutator', () => {
    // Types are erased at runtime; the only runtime value the module exports must be the projection.
    // A setter or an in-place editor would show up here as a second exported function.
    expect(Object.keys(skeletonModule).sort()).toEqual(['projectEditorialSkeleton']);
    expect(typeof skeletonModule.projectEditorialSkeleton).toBe('function');
  });

  it('imports no mutation — only the immutable Book model and the read-only classifier', () => {
    const importLines = SOURCE.split('\n').filter((line) => /^\s*import\b/.test(line));
    const imports = importLines.join('\n');
    // The write path lives elsewhere; the projection must never pull in a writer. (Scanned on the
    // IMPORT lines, not the prose — the module comment legitimately names the ops it dispatches.)
    expect(imports).not.toMatch(/BookEditingService/);
    expect(imports).not.toMatch(/EditBookUseCase/);
    // Every import is from the Book model or the structure taxonomy (the classifier) — nothing else,
    // so no mutating collaborator can slip in unnoticed.
    for (const line of importLines) {
      expect(line).toMatch(/from '(\.\.\/models\/Book|\.\/structureAssist\/structureTaxonomy)'/);
    }
  });

  it('returns a DEEPLY frozen skeleton — a consumer cannot write into it', () => {
    const skeleton = projectEditorialSkeleton(bookWith2Chapters());

    expect(Object.isFrozen(skeleton)).toBe(true);
    expect(Object.isFrozen(skeleton.objects)).toBe(true);
    for (const object of skeleton.objects) {
      expect(Object.isFrozen(object)).toBe(true);
      expect(Object.isFrozen(object.sourceRef)).toBe(true);
    }

    // Strict mode (ESM): writing a frozen property throws rather than silently no-op'ing — the
    // runtime half of "no code path writes into the projection".
    const first = skeleton.objects[0];
    expect(() => {
      (first as { title: string }).title = 'hacked';
    }).toThrow(TypeError);
    expect(() => {
      (skeleton.objects as unknown as { push: (x: unknown) => void }).push(first);
    }).toThrow(TypeError);
  });
});
