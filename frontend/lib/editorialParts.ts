/**
 * Editorial-part recognition (MINI_DR_EDITORIAL_PARTS, Option A of PROOF_EDITORIAL_CONTROL_SCOPE).
 *
 * A real manuscript's editorial parts — preface, introduction, bibliography, annex, … — import as
 * ordinary top-level chapters/sections (ASTBuilder sets frontMatter/backMatter to {}), so the studio
 * miscounts them: faith-alone's "INTRODUCTION" and "Conclusion" inflate its chapter count from 15
 * to 17. That displayed figure is not incomplete, it is FALSE — an ADR-0050 fidelity defect in the
 * studio's own reporting.
 *
 * This module recognises editorial parts by their CANONICAL TITLE — a lookup, not the closed 0%
 * HEURISTIC_STRUCTURE_DETECTION inference (unstyled chapter boundaries carry no signal; a top-level
 * title that IS "Introduction" carries a very strong one). It is PRESENTATION-ONLY: it never mutates
 * the Book, never populates frontMatter/backMatter, never moves content. It drives the honest count
 * (bookFacts) and the presence/absence panel (Proof). Correct placement in the EXPORT is out of scope
 * — that would be Option B/C, its own review (MINI_DR_EDITORIAL_PARTS §6).
 *
 * The false-positive safeguard is EXACTNESS (CTO's chief verification point): a part is editorial iff
 * its LEADING SEGMENT — the title up to an optional subtitle separator — equals a canonical name
 * exactly. "Conclusion: Nothing but Faith" matches (segment "Conclusion"); "Chapter One: What Is
 * Faith?" and "Introduction to Quantum Fields" do NOT (segment "Chapter One" / whole "Introduction
 * to Quantum Fields"). So the correction can never recreate the inverse defect by absorbing a real
 * chapter.
 */

export type EditorialPlacement = 'front' | 'back';

export interface EditorialCategory {
  /** Stable key, e.g. 'introduction'. */
  key: string;
  /** Display label (English canonical), e.g. 'Introduction'. */
  label: string;
  placement: EditorialPlacement;
  /** Canonical names, EN + FR, lowercased — the union matched against (CTO: never English-by-default). */
  names: string[];
}

/**
 * The recognised editorial parts, EN + FR (CTO-locked list, MINI_DR_EDITORIAL_PARTS §5.1). The
 * ambiguous members prologue/conclusion/epilogue are IN by CTO decision: faith-alone's Conclusion is
 * a genuine editorial part, and the exact leading-segment rule already filters fiction's narrative
 * "Prologue: …" chapters. Order is front-matter then back-matter, for the panel's grouping.
 */
export const EDITORIAL_CATEGORIES: EditorialCategory[] = [
  { key: 'dedication', label: 'Dedication', placement: 'front', names: ['dedication', 'dédicace'] },
  { key: 'epigraph', label: 'Epigraph', placement: 'front', names: ['epigraph', 'épigraphe'] },
  { key: 'foreword', label: 'Foreword', placement: 'front', names: ['foreword', 'avant-propos'] },
  { key: 'preface', label: 'Preface', placement: 'front', names: ['preface', 'préface'] },
  { key: 'prologue', label: 'Prologue', placement: 'front', names: ['prologue'] },
  { key: 'introduction', label: 'Introduction', placement: 'front', names: ['introduction'] },
  { key: 'acknowledgments', label: 'Acknowledgments', placement: 'front', names: ['acknowledgments', 'acknowledgements', 'remerciements'] },
  { key: 'conclusion', label: 'Conclusion', placement: 'back', names: ['conclusion'] },
  { key: 'epilogue', label: 'Epilogue', placement: 'back', names: ['epilogue', 'épilogue'] },
  { key: 'afterword', label: 'Afterword', placement: 'back', names: ['afterword', 'postface'] },
  { key: 'appendix', label: 'Appendix', placement: 'back', names: ['appendix', 'appendices', 'annexe', 'annexes'] },
  { key: 'bibliography', label: 'Bibliography', placement: 'back', names: ['bibliography', 'references', 'bibliographie', 'références'] },
  { key: 'glossary', label: 'Glossary', placement: 'back', names: ['glossary', 'glossaire'] },
  { key: 'index', label: 'Index', placement: 'back', names: ['index'] },
  { key: 'notes', label: 'Notes', placement: 'back', names: ['notes'] },
  { key: 'colophon', label: 'Colophon', placement: 'back', names: ['colophon'] },
  { key: 'about', label: 'About the Author', placement: 'back', names: ['about the author', "à propos de l'auteur"] },
];

/**
 * The title's leading segment: everything up to the first subtitle separator, trimmed and lowercased.
 * Separators are ':', '—' (em dash), '–' (en dash), and a SPACE-hyphen-SPACE ' - '. A bare '-' is
 * deliberately NOT a separator — it lives inside real canonical names ("Avant-propos"), so splitting
 * on it would break the French foreword match. So "Conclusion: Nothing but Faith" -> "conclusion",
 * "Introduction - The Beginning" -> "introduction", but "Avant-propos" -> "avant-propos" (whole).
 */
function leadingSegment(title: string): string {
  const match = title.match(/^(.*?)(?::|—|–|\s-\s)/);
  const segment = match ? match[1] : title;
  return segment.trim().toLowerCase();
}

/**
 * The category an editorial-part title names, or undefined if the title is an ordinary chapter.
 * Exact leading-segment match against the EN+FR union — the safeguard that keeps a real chapter
 * (whose leading segment is never a bare canonical name) from being absorbed.
 */
export function classifyEditorialTitle(title: string | undefined): EditorialCategory | undefined {
  if (!title) return undefined;
  const segment = leadingSegment(title);
  if (!segment) return undefined;
  return EDITORIAL_CATEGORIES.find((category) => category.names.includes(segment));
}

/** A recognised editorial part, with the real title it was detected from (honest evidence, ADR-0049). */
export interface DetectedEditorialPart {
  key: string;
  label: string;
  placement: EditorialPlacement;
  /** The manuscript's actual title, e.g. 'Conclusion: Nothing but Faith'. */
  detectedTitle: string;
}
