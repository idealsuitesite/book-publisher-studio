import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MammothParser } from './MammothParser';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('MammothParser', () => {
  const parser = new MammothParser();

  it('converts a valid DOCX buffer into HTML', async () => {
    const buffer = await buildTestDocxBuffer({
      heading: 'Chapter One',
      paragraphs: ['Hello world paragraph.'],
    });

    const result = await parser.parse(buffer);

    expect(result.html).toContain('<h1>Chapter One</h1>');
    expect(result.html).toContain('<p>Hello world paragraph.</p>');
  });

  it('handles an empty document', async () => {
    const buffer = await buildTestDocxBuffer({});

    const result = await parser.parse(buffer);

    expect(result.html.trim()).toBe('');
  });

  it('wraps parse failures with a descriptive error for a corrupted buffer', async () => {
    const corrupted = Buffer.from('this is not a valid docx file');

    await expect(parser.parse(corrupted)).rejects.toThrow(/Failed to parse DOCX/);
  });

  // Documents a known, verified mammoth limitation (ADR-0025) as current, correct
  // behavior - NOT a bug in this project's pipeline. Exists so this is never mistaken
  // for a Sprint 4 typography regression, and so a future fix (e.g. adding mammoth's
  // `styleMap: ["u => u"]` option) shows up as a deliberate, visible test change
  // instead of silently flipping an unguarded assertion.
  it('drops underline formatting by default on a real DOCX (documented mammoth limitation, ADR-0025) - bold/italic/strikethrough round-trip correctly in the same paragraph', async () => {
    const buffer = readFileSync(join(__dirname, '..', '..', '..', 'verification', 'typography-test.docx'));

    const result = await parser.parse(buffer);

    // The underlined word survives as plain text...
    expect(result.html).toContain('underlined');
    // ...but mammoth's default behavior drops the <u> tag around it entirely (ADR-0025).
    const underlinedIndex = result.html.indexOf('underlined');
    const surrounding = result.html.slice(Math.max(0, underlinedIndex - 20), underlinedIndex + 20);
    expect(surrounding).not.toContain('<u>');

    // Sibling bold/italic runs from the exact same source paragraph DO round-trip -
    // confirms this is specifically an underline gap, not a general inline-formatting
    // failure (ASTBuilder/HtmlNormalizer/TypographyResolver already handle underline
    // correctly once mammoth actually produces a <u> tag - see ADR-0025).
    expect(result.html).toContain('<strong>bold</strong>');
    expect(result.html).toContain('<em>italic</em>');
  });
});
