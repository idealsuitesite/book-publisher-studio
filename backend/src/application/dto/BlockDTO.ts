import type { InlineDTO } from './InlineDTO';

export interface HeadingDTO {
  type: 'heading';
  id: string;
  level: number;
  text: string;
}

export interface ParagraphDTO {
  type: 'paragraph';
  id: string;
  text: string;
  inlines: InlineDTO[];
}

export interface QuoteDTO {
  type: 'quote';
  id: string;
  text: string;
  inlines: InlineDTO[];
  attribution?: string;
  quoteType?: 'block' | 'pullquote' | 'epigraph';
}

export interface ScriptureDTO {
  type: 'scripture';
  id: string;
  text: string;
  translation?: string;
  reference?: {
    book: string;
    chapter: number;
    verses: string;
  };
}

export interface ImageDTO {
  type: 'image';
  id: string;
  url: string;
  caption?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface TableDTO {
  type: 'table';
  id: string;
  headers: string[];
  rows: (string | null)[][];
  caption?: string;
}

export interface ListDTO {
  type: 'list';
  id: string;
  ordered: boolean;
  items: string[];
}

export interface FootnoteDTO {
  type: 'footnote';
  id: string;
  number: number;
  content: string;
}

export type BlockDTO =
  HeadingDTO | ParagraphDTO | QuoteDTO | ScriptureDTO | ImageDTO | TableDTO | ListDTO | FootnoteDTO;
