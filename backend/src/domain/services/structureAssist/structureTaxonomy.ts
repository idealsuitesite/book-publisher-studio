/**
 * STRUCTURE_ASSIST — the shared structure taxonomy (STRUCTURE_ASSIST_DR.md §4, D1).
 *
 * A Domain resource, NOT shared-types: shared-types is types-only ("no runtime behavior", its
 * README), and this is runtime data + match logic — so per D1 it lives here, where the suggester
 * reads it. (The frontend's presentation-only `editorialParts.ts` is a separate consumer; unifying
 * the two around one representation is a follow-up within the chantier, DR §4.)
 *
 * The taxonomy is `{ 17 canonical editorial names, EN+FR } ∪ { numbered-chapter patterns, EN+FR }`
 * — reusing the CTO-locked editorial list (MINI_DR_EDITORIAL_PARTS) and extending it with the
 * numbered patterns the founder's manuscript actually carries. D3: NARROW first — `CHAPTER n` /
 * `Chapitre n` and the spelled forms EN+FR; `Part n` / roman numerals are NOT included until
 * measured without false positives on real manuscripts (n=1 today; no widening on hypothesis).
 */

export type MarkerKind = 'editorial' | 'numbered-chapter';

export interface StructureMarker {
  /** 'editorial' (a canonical part name) or 'numbered-chapter' (CHAPTER n / spelled). */
  kind: MarkerKind;
  /** Stable key: an editorial category key, or 'chapter' for a numbered chapter. */
  key: string;
  /** Display label for the proposed chapter title (the manuscript's own text is the evidence). */
  label: string;
}

/**
 * Canonical editorial names, EN + FR, lowercased — the union matched as a leading segment (the
 * MINI_DR_EDITORIAL_PARTS list, kept in lock-step). A body paragraph whose leading segment equals
 * one of these exactly is a strong, author-declared structural signal.
 */
const EDITORIAL_NAMES: { key: string; label: string; names: string[] }[] = [
  { key: 'dedication', label: 'Dedication', names: ['dedication', 'dédicace'] },
  { key: 'epigraph', label: 'Epigraph', names: ['epigraph', 'épigraphe'] },
  { key: 'foreword', label: 'Foreword', names: ['foreword', 'avant-propos'] },
  { key: 'preface', label: 'Preface', names: ['preface', 'préface'] },
  { key: 'prologue', label: 'Prologue', names: ['prologue'] },
  { key: 'introduction', label: 'Introduction', names: ['introduction'] },
  { key: 'acknowledgments', label: 'Acknowledgments', names: ['acknowledgments', 'acknowledgements', 'remerciements'] },
  { key: 'conclusion', label: 'Conclusion', names: ['conclusion'] },
  { key: 'epilogue', label: 'Epilogue', names: ['epilogue', 'épilogue'] },
  { key: 'afterword', label: 'Afterword', names: ['afterword', 'postface'] },
  { key: 'appendix', label: 'Appendix', names: ['appendix', 'appendices', 'annexe', 'annexes'] },
  { key: 'bibliography', label: 'Bibliography', names: ['bibliography', 'references', 'bibliographie', 'références'] },
  { key: 'glossary', label: 'Glossary', names: ['glossary', 'glossaire'] },
  { key: 'index', label: 'Index', names: ['index'] },
  { key: 'notes', label: 'Notes', names: ['notes'] },
  { key: 'colophon', label: 'Colophon', names: ['colophon'] },
  { key: 'about', label: 'About the Author', names: ['about the author', "à propos de l'auteur"] },
];

const EDITORIAL_BY_NAME = new Map<string, { key: string; label: string }>();
for (const cat of EDITORIAL_NAMES) for (const name of cat.names) EDITORIAL_BY_NAME.set(name, { key: cat.key, label: cat.label });

// Numbered-chapter markers, EN + FR (D3, narrow): the word that precedes a number, spelled or digit.
const CHAPTER_WORDS = ['chapter', 'chapitre'];
// Spelled ordinals/cardinals kept deliberately small (1–20-ish) EN + FR — the founder's real forms.
const SPELLED_NUMBERS = new Set([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'un', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt',
]);

/**
 * The title's leading segment (MINI_DR_EDITORIAL_PARTS): everything up to the first subtitle
 * separator, trimmed and lowercased. A bare '-' is NOT a separator (it lives inside "avant-propos").
 */
export function leadingSegment(title: string): string {
  const match = title.match(/^(.*?)(?::|—|–|\s-\s)/);
  return (match ? match[1] : title).trim().toLowerCase();
}

/**
 * Classify a standalone block's text as a structure marker, or undefined if it is ordinary prose.
 * Exact discipline (the safeguard against absorbing a real chapter, MINI_DR_EDITORIAL_PARTS):
 *  - editorial: the leading segment EQUALS a canonical name;
 *  - numbered-chapter: the WHOLE trimmed text is `chapter <n>` / `chapitre <n>` (digit or spelled).
 * A short line that is neither is NOT a marker — the generic "short line = heading" heuristic that
 * the scope measured at ~0.1% precision is deliberately not used.
 */
export function classifyMarker(text: string): StructureMarker | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const editorial = EDITORIAL_BY_NAME.get(leadingSegment(trimmed));
  if (editorial) return { kind: 'editorial', key: editorial.key, label: editorial.label };

  // Numbered chapter: the whole line is "<chapter-word> <number>", nothing else.
  const m = trimmed.toLowerCase().match(/^([a-zàâäéèêëîïôöùûüç]+)\s+([\p{L}\d-]+)$/u);
  if (m && CHAPTER_WORDS.includes(m[1]) && (/^\d{1,3}$/.test(m[2]) || SPELLED_NUMBERS.has(m[2]))) {
    return { kind: 'numbered-chapter', key: 'chapter', label: trimmed };
  }
  return undefined;
}
