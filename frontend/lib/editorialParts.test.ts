import { describe, it, expect } from 'vitest';
import { classifyEditorialTitle, EDITORIAL_CATEGORIES } from './editorialParts';

/**
 * MINI_DR_EDITORIAL_PARTS — the canonical-title classifier, asserted on the two properties that
 * make Option A honest: it recognises real editorial parts (so the count and panel can be truthful),
 * and — the CTO's chief verification point — it NEVER absorbs a real chapter, so correcting the
 * miscount cannot recreate the inverse defect.
 */
describe('classifyEditorialTitle', () => {
  it('recognises editorial parts by exact leading segment (the faith-alone real cases)', () => {
    // Whole-title match, and match up to a subtitle separator — the two shapes faith-alone shows.
    expect(classifyEditorialTitle('INTRODUCTION')?.key).toBe('introduction');
    expect(classifyEditorialTitle('Conclusion: Nothing but Faith')?.key).toBe('conclusion');
  });

  it('is EN/FR-agnostic — French titles classify from the FR names, not English-by-default', () => {
    expect(classifyEditorialTitle('Préface')?.key).toBe('preface');
    expect(classifyEditorialTitle('Bibliographie')?.key).toBe('bibliography');
    expect(classifyEditorialTitle('Annexe')?.key).toBe('appendix');
    expect(classifyEditorialTitle('Remerciements')?.key).toBe('acknowledgments');
    // The hyphen inside a canonical name must NOT be treated as a subtitle separator.
    expect(classifyEditorialTitle('Avant-propos')?.key).toBe('foreword');
  });

  it('is case- and separator-tolerant (em/en dash and spaced hyphen)', () => {
    expect(classifyEditorialTitle('bibliography')?.key).toBe('bibliography');
    expect(classifyEditorialTitle('Introduction — A Note')?.key).toBe('introduction');
    expect(classifyEditorialTitle('Appendix – Tables')?.key).toBe('appendix');
    expect(classifyEditorialTitle('Introduction - The Beginning')?.key).toBe('introduction');
  });

  it('classifies the ambiguous CTO-kept members (prologue/conclusion/epilogue)', () => {
    expect(classifyEditorialTitle('Prologue')?.key).toBe('prologue');
    expect(classifyEditorialTitle('Epilogue')?.key).toBe('epilogue');
    expect(classifyEditorialTitle('Épilogue')?.key).toBe('epilogue');
  });

  // THE false-positive guard (CTO's most-watched point): correcting the miscount must never absorb a
  // real chapter. A real chapter's leading segment is never a bare canonical name.
  it('NEVER absorbs a real chapter — the inverse defect must not appear', () => {
    expect(classifyEditorialTitle('Chapter One: What Is Faith?')).toBeUndefined();
    expect(classifyEditorialTitle('Introduction to Quantum Fields')).toBeUndefined(); // no separator -> whole title, not "introduction"
    expect(classifyEditorialTitle('Chapter Fifteen: Faith Pleases God')).toBeUndefined();
    expect(classifyEditorialTitle('The Prologue of Saint John')).toBeUndefined(); // "the prologue of saint john" != "prologue"
    expect(classifyEditorialTitle('Notes on a Scandal')).toBeUndefined(); // whole title, not the bare "notes"
    expect(classifyEditorialTitle('')).toBeUndefined();
    expect(classifyEditorialTitle(undefined)).toBeUndefined();
  });

  // Disclosed limitation of the strict exact-segment rule (MINI_DR_EDITORIAL_PARTS §8): an
  // ENUMERATED part ("Appendix A", "Annexe 1") has a leading segment that is not the bare canonical
  // name, so it reads as a chapter — a false NEGATIVE (safe/visible/correctable), never a false
  // positive. Asserted as intended behaviour under the CTO-locked rule, not an accident.
  it('declines enumerated parts under the strict rule (a disclosed false negative, not a false positive)', () => {
    expect(classifyEditorialTitle('Appendix A')).toBeUndefined();
    expect(classifyEditorialTitle('Annexe 1 : Détails')).toBeUndefined();
  });

  it('every category is well-formed (lowercased names, unique keys)', () => {
    const keys = EDITORIAL_CATEGORIES.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const category of EDITORIAL_CATEGORIES) {
      expect(category.names.length).toBeGreaterThan(0);
      for (const name of category.names) expect(name).toBe(name.toLowerCase());
    }
  });
});
