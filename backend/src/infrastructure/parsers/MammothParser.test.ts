import { describe, it, expect } from 'vitest';
import { MammothParser } from './MammothParser';
import { buildTestDocxBuffer } from '../../test-utils/buildTestDocx';

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
});
