import { load } from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import { isTag, isText, type AnyNode, type Element } from 'domhandler';
import type {
  NormalizedDocument,
  AnyNormalizedNode,
  DocumentMetadata,
  InlineNode,
} from '../../domain/models/Normalized';
import { createIdGenerator } from '../../shared/utils/idGenerator';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';

export class HtmlNormalizer implements DocumentNormalizer {
  normalize(html: string, metadata: Partial<DocumentMetadata> = {}): NormalizedDocument {
    const $ = load(html);
    const ids = this.createIdGenerators();
    const nodes: AnyNormalizedNode[] = [];

    const root = $('body').length ? $('body') : $(':root');

    root
      .find('h1, h2, h3, h4, h5, h6, p, img, table, ul, ol, blockquote')
      .each((_: number, elem: Element) => {
        const $elem = $(elem);
        const tag = elem.name?.toLowerCase();
        const text = $elem.text().trim();

        if (!text && tag !== 'img' && tag !== 'table') return;

        const headingMatch = tag?.match(/^h([1-6])$/);
        if (headingMatch) {
          const level = parseInt(headingMatch[1], 10);
          nodes.push({
            id: ids.node(),
            type: 'heading',
            level,
            text,
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'p') {
          const inlines = this.extractInlines($, $elem);
          nodes.push({
            id: ids.node(),
            type: 'paragraph',
            inlines: inlines.length ? inlines : [{ type: 'text', text }],
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'img') {
          nodes.push({
            id: ids.node(),
            type: 'image',
            image: {
              url: $elem.attr('src') ?? '',
              alt: $elem.attr('alt'),
              caption: $elem.attr('title'),
            },
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'table') {
          const rows: { cells: string[]; isHeader: boolean }[] = [];
          $elem.find('tr').each((_: number, row: Element) => {
            const cells: string[] = [];
            $(row)
              .find('td, th')
              .each((_: number, cell: Element) => {
                cells.push($(cell).text().trim());
              });
            rows.push({ cells, isHeader: $(row).find('th').length > 0 });
          });
          nodes.push({
            id: ids.node(),
            type: 'table',
            rows,
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'ul' || tag === 'ol') {
          const items: string[] = [];
          $elem.find('li').each((_: number, li: Element) => {
            items.push($(li).text().trim());
          });
          nodes.push({
            id: ids.node(),
            type: 'list',
            ordered: tag === 'ol',
            items,
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'blockquote') {
          const inlines = this.extractInlines($, $elem);
          nodes.push({
            id: ids.node(),
            type: 'quote',
            inlines: inlines.length ? inlines : [{ type: 'text', text }],
            attribution: $elem.find('footer, cite').text().trim() || undefined,
            source: { originalIndex: nodes.length },
          });
        }
      });

    return {
      metadata: {
        fileName: metadata.fileName ?? 'document.html',
        uploadedAt: metadata.uploadedAt ?? new Date(),
        title: metadata.title,
        author: metadata.author,
      },
      nodes,
    };
  }

  private extractInlines($: CheerioAPI, $elem: Cheerio<Element>): InlineNode[] {
    const inlines: InlineNode[] = [];

    $elem.contents().each((_: number, node: AnyNode) => {
      if (isText(node)) {
        // Collapse internal whitespace runs (stray tabs/newlines from the source markup)
        // to a single space, but never trim the ends. A text node sitting between two
        // tags (e.g. the " " between "</strong>" and "<em>") IS the word separator -
        // trimming it away silently jams adjacent words together (e.g. "mixesbold") on
        // any real multi-run paragraph. Only a genuinely empty node (zero characters
        // after collapsing) is dropped - this is the fix, not a stricter emptiness check.
        const text = (node.data ?? '').replace(/\s+/g, ' ');
        if (text) inlines.push({ type: 'text', text });
      } else if (isTag(node)) {
        const $node = $(node);
        const tag = node.name?.toLowerCase();
        const text = $node.text().trim();
        if (!text) return;

        if (tag === 'strong' || tag === 'b') inlines.push({ type: 'bold', text });
        else if (tag === 'em' || tag === 'i') inlines.push({ type: 'italic', text });
        else if (tag === 'u') inlines.push({ type: 'underline', text });
        else if (tag === 's' || tag === 'strike' || tag === 'del') inlines.push({ type: 'strikethrough', text });
        else if (tag === 'a') inlines.push({ type: 'link', text, url: $node.attr('href') ?? '' });
        else inlines.push({ type: 'text', text });
      }
    });

    return inlines;
  }

  private createIdGenerators() {
    return { node: createIdGenerator('norm-node') };
  }
}
