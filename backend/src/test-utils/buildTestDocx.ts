import JSZip from 'jszip';

export interface TestDocxBlock {
  type: 'heading' | 'paragraph';
  text: string;
  /** Heading level 1-6 (default 1 for a heading; ignored for a paragraph). */
  level?: number;
}

export interface TestDocxOptions {
  heading?: string;
  paragraphs?: string[];
  /**
   * An ORDERED block sequence — for fixtures the `heading + paragraphs` shape can't express, e.g.
   * an over-structured manuscript (an empty `Heading 1` marker immediately followed by a real
   * `Heading 1` title, STRUCTURE_CLEANUP). When provided, it REPLACES `heading`/`paragraphs`.
   */
  blocks?: TestDocxBlock[];
}

/**
 * Builds a minimal, valid .docx buffer for tests, without depending on
 * checked-in sample files. Covers only what mammoth needs: [Content_Types].xml,
 * _rels/.rels, and word/document.xml with a heading + paragraph runs (or an ordered `blocks` list).
 */
export async function buildTestDocxBuffer(options: TestDocxOptions = {}): Promise<Buffer> {
  const { heading, paragraphs = [], blocks } = options;
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );

  zip.folder('_rels')!.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const blockXml = (b: TestDocxBlock): string =>
    b.type === 'heading'
      ? `<w:p><w:pPr><w:pStyle w:val="Heading${b.level ?? 1}"/></w:pPr><w:r><w:t>${escapeXml(b.text)}</w:t></w:r></w:p>`
      : `<w:p><w:r><w:t>${escapeXml(b.text)}</w:t></w:r></w:p>`;

  const bodyXml = blocks
    ? blocks.map(blockXml).join('\n')
    : [
        heading ? `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(heading)}</w:t></w:r></w:p>` : '',
        paragraphs.map((text) => `<w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`).join('\n'),
      ].join('\n');

  zip.folder('word')!.file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
  </w:body>
</w:document>`
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
