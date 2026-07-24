import type { Divider } from '../models/Book';
import type { Theme, SeparatorPresentation } from '../models/Theme';

/**
 * The ONE resolution of a scene-break separator's style (AUTHOR_EXPERIENCE D5, M3-C8), shared by all
 * three renderers so they can never diverge again (before this they hardcoded — and DISAGREED: PDF/DOCX
 * `* * *`, EPUB `<hr>`). Precedence: an explicit per-block `Divider.style` (author override) → the
 * theme's declared separator → `'asterisks'` (the prior PDF/DOCX default, for a theme that declares none).
 */
export function resolveSeparatorStyle(block: Divider, theme: Theme): SeparatorPresentation['style'] {
  // `Divider.style` predates this and names the horizontal rule `'line'`; the theme vocabulary calls it
  // `'rule'` (clearer for a theme value). Map the override; the other two names already agree.
  if (block.style) return block.style === 'line' ? 'rule' : block.style;
  return theme.presentation?.separator?.style ?? 'asterisks';
}
