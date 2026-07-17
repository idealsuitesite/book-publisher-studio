/**
 * Extracts rendered text from an uncompressed PDFKit buffer for test assertions.
 *
 * PDFKit encodes shown text as hex-string operands (`<...>`) inside `Tj`/`TJ` operators, not as
 * literal runs the way DOCX's XML stores paragraph text - so this concatenates every hex-string
 * token in the raw content stream, in order, decoded as Latin-1. Kerning-adjustment numbers
 * inside `TJ` arrays are skipped automatically since they aren't hex tokens. Requires the PDF to
 * have been rendered with `compress: false` (a compressed content stream can't be scanned this
 * way at all).
 */
export function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const hexTokens = raw.match(/<([0-9a-fA-F]+)>/g) ?? [];
  return hexTokens.map((token) => Buffer.from(token.slice(1, -1), 'hex').toString('latin1')).join('');
}

/** Counts rendered pages by counting distinct page objects (`/MediaBox` appears once each). */
export function countPdfPages(buffer: Buffer): number {
  const raw = buffer.toString('latin1');
  return (raw.match(/\/MediaBox/g) ?? []).length;
}
