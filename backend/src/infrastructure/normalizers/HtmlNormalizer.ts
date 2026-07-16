import { load } from 'cheerio';
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
      .each((_: number, elem: any) => {
        const $elem = $(elem);
        const tag = elem.name?.toLowerCase();
        const text = $elem.text().trim();

        if (!text && tag !== 'img' && tag !== 'table') return;

        if (tag?.match(/^h[1-6]$/)) {
          const level = parseInt(tag[1], 10);
          nodes.push({
            id: ids.node(),
            type: 'heading',
            level,
            text,
            source: { originalIndex: nodes.length },
          } as any);
        } else if (tag === 'p') {
          const inlines = this.extractInlines($, $elem);
          nodes.push({
            id: ids.node(),
            type: 'paragraph',
            inlines: inlines.length ? inlines : [{ type: 'text', text }],
            source: { originalIndex: nodes.length },
          } as any);
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
          } as any);
        } else if (tag === 'table') {
          const rows: any[] = [];
          $elem.find('tr').each((_: number, row: any) => {
            const cells: string[] = [];
            $(row)
              .find('td, th')
              .each((_: number, cell: any) => {
                cells.push($(cell).text().trim());
              });
            rows.push({ cells, isHeader: $(row).find('th').length > 0 });
          });
          nodes.push({
            id: ids.node(),
            type: 'table',
            rows,
            source: { originalIndex: nodes.length },
          } as any);
        } else if (tag === 'ul' || tag === 'ol') {
          const items: string[] = [];
          $elem.find('li').each((_: number, li: any) => {
            items.push($(li).text().trim());
          });
          nodes.push({
            id: ids.node(),
            type: 'list',
            ordered: tag === 'ol',
            items,
            source: { originalIndex: nodes.length },
          } as any);
        } else if (tag === 'blockquote') {
          const inlines = this.extractInlines($, $elem);
          nodes.push({
            id: ids.node(),
            type: 'quote',
            inlines: inlines.length ? inlines : [{ type: 'text', text }],
            attribution: $elem.find('footer, cite').text().trim() || undefined,
            source: { originalIndex: nodes.length },
          } as any);
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

  private extractInlines($: any, $elem: any): InlineNode[] {
    const inlines: InlineNode[] = [];

    $elem.contents().each((_: number, node: any) => {
      if (node.type === 'text') {
        const text = node.data?.trim();
        if (text) inlines.push({ type: 'text', text });
      } else if (node.type === 'tag') {
        const $node = $(node);
        const tag = node.name?.toLowerCase();
        const text = $node.text().trim();
        if (!text) return;

        if (tag === 'strong' || tag === 'b') inlines.push({ type: 'bold', text });
        else if (tag === 'em' || tag === 'i') inlines.push({ type: 'italic', text });
        else if (tag === 'u') inlines.push({ type: 'underline', text });
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
