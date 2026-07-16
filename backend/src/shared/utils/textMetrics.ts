const AVERAGE_WORDS_PER_MINUTE = 200;
const AVERAGE_WORDS_PER_PAGE = 300;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export function estimateReadingTime(wordCount: number): number {
  if (wordCount === 0) return 0;
  return Math.ceil(wordCount / AVERAGE_WORDS_PER_MINUTE);
}

export function estimatePageCount(wordCount: number): number {
  if (wordCount === 0) return 0;
  return Math.max(1, Math.ceil(wordCount / AVERAGE_WORDS_PER_PAGE));
}
