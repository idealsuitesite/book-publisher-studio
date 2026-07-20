import type { Image } from '../models/Book';

/**
 * The ONE formula for an embedded image's rendered size — shared by the pagination model
 * (`estimateBlockHeight`) and the renderers, so what is priced IS what is drawn. This is
 * BOOK_PRESENTATION.md R2 (the height contract, ADR-0051's corollary) applied to Phase 2:
 * an image whose height the model guessed while the renderer scaled it differently would
 * be render drift by another name.
 *
 * Semantics: fit-to-text-width, never upscale — intrinsic size preserved when it already
 * fits the column, proportionally scaled down when wider. Callers that lack real
 * dimensions keep their historical fallback; this function refuses to invent them.
 */
export function renderedImageSize(
  image: Pick<Image, 'width' | 'height'>,
  usableWidth: number
): { width: number; height: number } | undefined {
  if (!image.width || !image.height || image.width <= 0 || image.height <= 0) return undefined;
  const scale = Math.min(1, usableWidth / image.width);
  return { width: image.width * scale, height: image.height * scale };
}
