import { describe, it, expect } from 'vitest';
import { HtmlNormalizer } from './HtmlNormalizer';
import type {
  ParagraphNode,
  ImageNode,
  TableNode,
  ListNode,
  QuoteNode,
} from '../../domain/models/Normalized';

describe('HtmlNormalizer', () => {
  const normalizer = new HtmlNormalizer();

  describe('Heading parsing', () => {
    it('parses h1 to h6 headings', () => {
      const html = `<h1>Level 1</h1><h2>Level 2</h2><h3>Level 3</h3>`;
      const doc = normalizer.normalize(html);

      expect(doc.nodes).toHaveLength(3);
      expect(doc.nodes[0]).toMatchObject({ type: 'heading', level: 1, text: 'Level 1' });
      expect(doc.nodes[1]).toMatchObject({ type: 'heading', level: 2, text: 'Level 2' });
      expect(doc.nodes[2]).toMatchObject({ type: 'heading', level: 3, text: 'Level 3' });
    });

    it('extracts heading text correctly', () => {
      const html = `<h1>Chapter One</h1>`;
      const doc = normalizer.normalize(html);
      expect(doc.nodes[0]).toMatchObject({ type: 'heading', text: 'Chapter One' });
    });
  });

  describe('Paragraph parsing', () => {
    it('parses paragraphs', () => {
      const html = `<p>This is a paragraph.</p>`;
      const doc = normalizer.normalize(html);

      expect(doc.nodes).toHaveLength(1);
      expect(doc.nodes[0].type).toBe('paragraph');
    });

    it('extracts multiple paragraphs', () => {
      const html = `<p>First.</p><p>Second.</p>`;
      const doc = normalizer.normalize(html);

      expect(doc.nodes).toHaveLength(2);
      expect(doc.nodes[0].type).toBe('paragraph');
      expect(doc.nodes[1].type).toBe('paragraph');
    });
  });

  describe('Inline formatting', () => {
    it('detects bold text', () => {
      const html = `<p>This is <strong>bold</strong> text.</p>`;
      const doc = normalizer.normalize(html);
      const para = doc.nodes[0] as ParagraphNode;

      const boldInline = para.inlines.find((i) => i.type === 'bold');
      expect(boldInline).toBeDefined();
      expect(boldInline?.text).toBe('bold');
    });

    it('detects italic text', () => {
      const html = `<p>This is <em>italic</em> text.</p>`;
      const doc = normalizer.normalize(html);
      const para = doc.nodes[0] as ParagraphNode;

      const italicInline = para.inlines.find((i) => i.type === 'italic');
      expect(italicInline).toBeDefined();
    });

    it('detects links', () => {
      const html = `<p>Check <a href="https://example.com">this link</a>.</p>`;
      const doc = normalizer.normalize(html);
      const para = doc.nodes[0] as ParagraphNode;

      const linkInline = para.inlines.find((i) => i.type === 'link');
      expect(linkInline?.url).toBe('https://example.com');
    });

    it('detects strikethrough text (<s>)', () => {
      const html = `<p>This is <s>struck</s> text.</p>`;
      const doc = normalizer.normalize(html);
      const para = doc.nodes[0] as ParagraphNode;

      const strikeInline = para.inlines.find((i) => i.type === 'strikethrough');
      expect(strikeInline?.text).toBe('struck');
    });

    it('detects strikethrough text (<strike> and <del>)', () => {
      const html = `<p><strike>old</strike> and <del>removed</del>.</p>`;
      const doc = normalizer.normalize(html);
      const para = doc.nodes[0] as ParagraphNode;

      expect(para.inlines.filter((i) => i.type === 'strikethrough')).toEqual([
        { type: 'strikethrough', text: 'old' },
        { type: 'strikethrough', text: 'removed' },
      ]);
    });

    // Regression for a real bug (Sprint 4 commit 10, found via a real DOCX round trip):
    // trimming every text node independently silently dropped the word-separating space
    // between adjacent inline elements, jamming e.g. "mixes bold" into "mixesbold".
    it('preserves the whitespace between adjacent inline elements instead of jamming words together', () => {
      const html = `<p>This paragraph mixes <strong>bold</strong>, <em>italic</em>, and <s>struck</s> text.</p>`;
      const doc = normalizer.normalize(html);
      const para = doc.nodes[0] as ParagraphNode;

      const joined = para.inlines.map((i) => i.text).join('');
      expect(joined).toBe('This paragraph mixes bold, italic, and struck text.');
    });

    it('does not push a text node that is truly empty (adjacent tags with no separating text)', () => {
      const html = `<p><strong>bold</strong><em>italic</em></p>`;
      const doc = normalizer.normalize(html);
      const para = doc.nodes[0] as ParagraphNode;

      expect(para.inlines).toEqual([
        { type: 'bold', text: 'bold' },
        { type: 'italic', text: 'italic' },
      ]);
    });
  });

  describe('Image parsing', () => {
    it('parses img tags', () => {
      const html = `<img src="https://example.com/image.png" alt="An image" />`;
      const doc = normalizer.normalize(html);

      expect(doc.nodes[0].type).toBe('image');
      const img = doc.nodes[0] as ImageNode;
      expect(img.image.url).toBe('https://example.com/image.png');
      expect(img.image.alt).toBe('An image');
    });

    it('extracts image caption', () => {
      const html = `<img src="test.png" title="My caption" />`;
      const doc = normalizer.normalize(html);
      const img = doc.nodes[0] as ImageNode;

      expect(img.image.caption).toBe('My caption');
    });
  });

  describe('Table parsing', () => {
    it('parses table rows', () => {
      const html = `
        <table>
          <tr><th>Name</th><th>Age</th></tr>
          <tr><td>Alice</td><td>30</td></tr>
        </table>
      `;
      const doc = normalizer.normalize(html);

      expect(doc.nodes[0].type).toBe('table');
      const table = doc.nodes[0] as TableNode;
      expect(table.rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('List parsing', () => {
    it('parses unordered lists', () => {
      const html = `<ul><li>Item 1</li><li>Item 2</li></ul>`;
      const doc = normalizer.normalize(html);

      expect(doc.nodes[0].type).toBe('list');
      const list = doc.nodes[0] as ListNode;
      expect(list.ordered).toBe(false);
      expect(list.items).toEqual(['Item 1', 'Item 2']);
    });

    it('parses ordered lists', () => {
      const html = `<ol><li>First</li><li>Second</li></ol>`;
      const doc = normalizer.normalize(html);
      const list = doc.nodes[0] as ListNode;

      expect(list.ordered).toBe(true);
    });
  });

  describe('Blockquote parsing', () => {
    it('parses blockquotes', () => {
      const html = `<blockquote>A quote</blockquote>`;
      const doc = normalizer.normalize(html);

      expect(doc.nodes[0].type).toBe('quote');
    });

    it('extracts attribution', () => {
      const html = `<blockquote>A quote<footer>— Author</footer></blockquote>`;
      const doc = normalizer.normalize(html);
      const quote = doc.nodes[0] as QuoteNode;

      expect(quote.attribution).toContain('Author');
    });
  });

  describe('Document metadata', () => {
    it('sets default metadata', () => {
      const html = `<p>Content</p>`;
      const doc = normalizer.normalize(html);

      expect(doc.metadata.fileName).toBe('document.html');
      expect(doc.metadata.uploadedAt).toBeDefined();
    });

    it('accepts custom metadata', () => {
      const html = `<p>Content</p>`;
      const doc = normalizer.normalize(html, {
        title: 'My Book',
        author: 'John Doe',
        fileName: 'book.html',
      });

      expect(doc.metadata.title).toBe('My Book');
      expect(doc.metadata.author).toBe('John Doe');
    });
  });

  describe('Complex documents', () => {
    it('handles a complete chapter', () => {
      const html = `
        <h1>Chapter 1</h1>
        <p>Introduction.</p>
        <h2>Section A</h2>
        <p>Content with <strong>bold</strong> and <em>italic</em>.</p>
        <img src="test.png" alt="Image" />
        <table><tr><th>Col</th></tr><tr><td>A</td></tr></table>
      `;
      const doc = normalizer.normalize(html);

      expect(doc.nodes.length).toBeGreaterThan(5);
      expect(doc.nodes.some((n) => n.type === 'heading')).toBe(true);
      expect(doc.nodes.some((n) => n.type === 'paragraph')).toBe(true);
      expect(doc.nodes.some((n) => n.type === 'image')).toBe(true);
      expect(doc.nodes.some((n) => n.type === 'table')).toBe(true);
    });
  });

  // ADR-0049: the drop is right, the silence was not - a real manuscript lost an empty
  // Heading 1 with no trace (18 h1 in the source, 17 chapters out, IMPORT_FIDELITY.md).
  describe('empty-heading diagnostics (ADR-0049)', () => {
    it('drops an empty heading but says so', () => {
      const doc = normalizer.normalize('<h1>Real</h1><p>Text.</p><h1></h1><h1>Also real</h1>');

      const headings = doc.nodes.filter((n) => n.type === 'heading');
      expect(headings).toHaveLength(2);
      expect(doc.diagnostics).toHaveLength(1);
      expect(doc.diagnostics?.[0].code).toBe('EMPTY_HEADING_DROPPED');
      expect(doc.diagnostics?.[0].message).toContain('Heading 1');
    });

    it('emits no diagnostics channel when nothing was dropped', () => {
      const doc = normalizer.normalize('<h1>Real</h1><p>Text.</p>');

      expect(doc.diagnostics).toBeUndefined();
    });

    it('an empty paragraph is still dropped silently - only headings carry structure', () => {
      const doc = normalizer.normalize('<p>Text.</p><p></p>');

      expect(doc.nodes).toHaveLength(1);
      expect(doc.diagnostics).toBeUndefined();
    });
  });

  // TABLE_DUPLICATION.md (ADR-0050): mammoth wraps table cells / blockquote text /
  // list-item content in inner <p>, and a descendant `.find` used to emit each of them
  // BOTH inside its container AND again as a top-level block. The tree walk now treats
  // those containers as leaves — closing the whole class, not just tables.
  describe('no double emission of container content (TABLE_DUPLICATION.md)', () => {
    it('a table cell wrapped in <p> is not also emitted as a standalone paragraph', () => {
      const doc = normalizer.normalize(
        '<p>Before.</p><table><tr><td><p>Name</p></td><td><p>Role</p></td></tr></table><p>After.</p>'
      );
      const types = doc.nodes.map((n) => n.type);
      expect(types).toEqual(['paragraph', 'table', 'paragraph']);
      expect(doc.nodes.filter((n) => n.type === 'paragraph')).toHaveLength(2);
    });

    it('blockquote text wrapped in <p> yields one quote, not a quote plus a duplicate paragraph', () => {
      const doc = normalizer.normalize('<blockquote><p>A quoted sentence.</p></blockquote>');
      expect(doc.nodes.map((n) => n.type)).toEqual(['quote']);
    });

    it('a multi-paragraph list item does not re-emit its paragraphs as body paragraphs', () => {
      const doc = normalizer.normalize('<ul><li><p>Item para.</p></li></ul>');
      expect(doc.nodes.map((n) => n.type)).toEqual(['list']);
    });
  });

  // FOUNDER_TRAVERSAL finding 2 — a <br> (soft line break) inside any block was flattened to
  // NOTHING, jamming the words on either side (…ProtectionFOREWORD, …discipline.Others). Measured
  // class-wide (BR_BOUNDARY_SCOPE.md): all 7 extraction sites lost the boundary, and real books
  // carry hundreds of <br> in body paragraphs. Fix (single class-level helper, CTO option a): a
  // <br>-run (plus surrounding whitespace) collapses to ONE space — a word/sentence boundary, the
  // right thing for reflowable text. Guarded in BOTH directions: <br> yields a boundary; a double
  // <br> yields ONE space not two; whitespace around a <br> collapses to one; and a normal block
  // WITHOUT <br> is untouched (a file with no <br> renders byte-identically — the corpus parity
  // locks are that guard at the corpus level).
  describe('line-break (<br>) boundary — the fidelity fix, guarded both ways', () => {
    const nodeText = (node: unknown): string => {
      const n = node as { text?: string; inlines?: { text?: string }[]; items?: string[]; rows?: { cells: string[] }[] };
      if (typeof n.text === 'string') return n.text;
      if (n.inlines) return n.inlines.map((i) => i.text ?? '').join('');
      if (n.items) return n.items.join(' | ');
      if (n.rows) return n.rows.map((r) => r.cells.join(',')).join(' | ');
      return '';
    };
    const firstText = (html: string) => nodeText(normalizer.normalize(html).nodes[0]);

    it('heading: <br> becomes a single-space boundary — never "AlphaBravo"', () => {
      expect(firstText('<h1>Alpha<br />Bravo</h1>')).toBe('Alpha Bravo');
    });
    it('heading: a DOUBLE <br> collapses to ONE space, not two (the correctif never introduces a double space)', () => {
      expect(firstText('<h1>Alpha<br /><br />Bravo</h1>')).toBe('Alpha Bravo');
    });
    it('heading: whitespace AROUND the <br> collapses to one space ("word <br> word" → "word word")', () => {
      expect(firstText('<h1>Alpha <br /> Bravo</h1>')).toBe('Alpha Bravo');
    });
    it('paragraph (plain): the body sentence boundary is restored', () => {
      expect(firstText('<p>discipline.<br />Others with consistency.</p>')).toBe('discipline. Others with consistency.');
    });
    it('paragraph (rich runs): the boundary is inserted between runs, not swallowed', () => {
      // "Echo " + <strong>Fox</strong> + <br/> + "Golf" → the <br> boundary sits between Fox and Golf.
      expect(firstText('<p>Echo <strong>Fox</strong><br />Golf</p>')).toBe('Echo Fox Golf');
    });
    it('list item: <br> becomes a boundary', () => {
      expect(firstText('<ul><li>Hotel<br />India</li></ul>')).toBe('Hotel India');
    });
    it('table cell: <br> becomes a boundary', () => {
      expect(firstText('<table><tr><td>Juliet<br />Kilo</td></tr></table>')).toBe('Juliet Kilo');
    });
    it('quote: <br> becomes a boundary', () => {
      expect(firstText('<blockquote><p>Lima<br />Mike</p></blockquote>')).toBe('Lima Mike');
    });

    // NON-REGRESSION: a block with NO <br> must be untouched — the fix only acts where <br> exists.
    it('a normal multi-run paragraph WITHOUT <br> is unchanged (byte-for-byte the same inlines)', () => {
      const doc = normalizer.normalize('<p>Echo <strong>Fox</strong> Golf</p>');
      const p = doc.nodes[0] as ParagraphNode;
      expect(p.inlines).toEqual([
        { type: 'text', text: 'Echo ' },
        { type: 'bold', text: 'Fox' },
        { type: 'text', text: ' Golf' },
      ]);
    });
    it('a normal heading WITHOUT <br> is unchanged', () => {
      expect(firstText('<h1>Chapter One</h1>')).toBe('Chapter One');
    });
  });
});
