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
});
