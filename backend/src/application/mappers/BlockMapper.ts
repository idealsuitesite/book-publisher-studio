import type { Block, InlineElement } from '../../domain/models/Book';
import type { BlockDTO } from '../dto/BlockDTO';
import type { InlineDTO } from '../dto/InlineDTO';

export class BlockMapper {
  map(block: Block): BlockDTO {
    switch (block.type) {
      case 'heading':
        return { type: 'heading', id: block.id, level: block.level, text: block.text };
      case 'paragraph':
        return {
          type: 'paragraph',
          id: block.id,
          text: block.text,
          inlines: this.mapInlines(block.inlines),
          // Additive callout crossing (MINI_DR_CALLOUTS): absent stays absent — the DTO mirrors
          // the model's exact-identity round-trip rather than materialising `undefined`.
          ...(block.callout === true ? { callout: true as const } : {}),
        };
      case 'quote':
        return {
          type: 'quote',
          id: block.id,
          text: block.text,
          inlines: this.mapInlines(block.inlines),
          attribution: block.attribution,
          quoteType: block.quoteType,
        };
      case 'scripture':
        return {
          type: 'scripture',
          id: block.id,
          text: block.text,
          translation: block.translation,
          reference: block.reference,
        };
      case 'image':
        return {
          type: 'image',
          id: block.id,
          url: block.url,
          caption: block.caption,
          alt: block.alt,
          width: block.width,
          height: block.height,
        };
      case 'table':
        return {
          type: 'table',
          id: block.id,
          headers: block.headers,
          rows: block.rows,
          caption: block.caption,
        };
      case 'list':
        return { type: 'list', id: block.id, ordered: block.ordered, items: block.items };
      case 'footnote':
        return { type: 'footnote', id: block.id, number: block.number, content: block.content };
      case 'page-break':
      case 'divider':
        throw new Error(`Block type not yet supported by BlockMapper: ${block.type}`);
      default: {
        const _exhaustive: never = block;
        throw new Error(`Unsupported block type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  private mapInlines(inlines?: InlineElement[]): InlineDTO[] {
    if (!inlines) return [];
    return inlines.map((inline) => ({
      type: inline.type,
      text: inline.text,
      url: inline.type === 'link' ? inline.url : undefined,
    }));
  }
}
