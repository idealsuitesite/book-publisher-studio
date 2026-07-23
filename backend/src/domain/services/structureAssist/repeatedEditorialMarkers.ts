/**
 * The shared repetition recognition (SUBCHAPTER_PROMOTION_DR §6, D3 — ONE source of truth).
 *
 * A book has exactly one Conclusion, one Introduction; so a canonical editorial name that appears
 * MORE THAN ONCE (N>1) is a recurring SECTION title — deductive sub-structure, never N book parts
 * (FOUNDER_TRAVERSAL_3, measured n=3: book-3 "Conclusion" ×26). This is the single computation behind
 * two faces of one recognition:
 *   - STRUCTURE_ASSIST's A2 guard SUPPRESSES the wrong offer (a repeated name is not a chapter);
 *   - SUBCHAPTER_PROMOTION (B5) MAKES the right one (propose it as a section of its chapter).
 * Both call THIS function — two thresholds that could drift would be a latent defect (CTO D3). The
 * threshold is exactly N>1: not a tuned cutoff, but "a thing there can be only one of, appearing twice".
 */
export function repeatedEditorialKeys(editorialKeys: readonly string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const key of editorialKeys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([key]) => key));
}
