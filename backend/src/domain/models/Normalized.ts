// Domain Layer: src/domain/models/Normalized.ts
//
// Input contract for ASTBuilder: what the Infrastructure/Application
// Normalizer must produce from raw DOCX/HTML before passing to the Domain.

export type NodeType =
  'heading' | 'paragraph' | 'image' | 'table' | 'quote' | 'scripture' | 'list' | 'footnote';

export interface SourceMetadata {
  originalIndex: number;
  sourceStyle?: string;
}

export interface NormalizedNode {
  id: string;
  type: NodeType;
  source: SourceMetadata;
}

export interface HeadingNode extends NormalizedNode {
  type: 'heading';
  level: number;
  text: string;
}

export interface ParagraphNode extends NormalizedNode {
  type: 'paragraph';
  inlines: InlineNode[];
}

export interface ImageNode extends NormalizedNode {
  type: 'image';
  image: RawImage;
}

export interface TableNode extends NormalizedNode {
  type: 'table';
  rows: RawTableRow[];
}

export interface QuoteNode extends NormalizedNode {
  type: 'quote';
  inlines: InlineNode[];
  attribution?: string;
}

export interface ScriptureNode extends NormalizedNode {
  type: 'scripture';
  text: string;
  translation?: string;
  reference?: string;
}

export interface ListNode extends NormalizedNode {
  type: 'list';
  ordered: boolean;
  items: string[];
}

export interface FootnoteNode extends NormalizedNode {
  type: 'footnote';
  content: string;
}

export type AnyNormalizedNode =
  | HeadingNode
  | ParagraphNode
  | ImageNode
  | TableNode
  | QuoteNode
  | ScriptureNode
  | ListNode
  | FootnoteNode;

export interface InlineNode {
  type: 'text' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'link' | 'small-caps';
  text: string;
  url?: string;
}

export interface RawImage {
  url: string;
  base64?: string;
  alt?: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface RawTableRow {
  cells: string[];
  isHeader?: boolean;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  fileName: string;
  uploadedAt: Date;
}

/**
 * A normalization decision the source's author would want to know about (ADR-0049): the
 * normalizer legitimately drops or reshapes content, but doing so SILENTLY is how a real
 * manuscript lost a heading with no trace (IMPORT_FIDELITY.md §1 — an empty Heading 1,
 * absorbed, 18 → 17 chapters). Import-time evidence only: the dropped content does not exist
 * in the Book AST, so re-validation on read cannot rediscover it.
 */
export interface NormalizationDiagnostic {
  code: 'EMPTY_HEADING_DROPPED';
  message: string;
}

export interface NormalizedDocument {
  metadata: DocumentMetadata;
  nodes: AnyNormalizedNode[];
  diagnostics?: NormalizationDiagnostic[];
}
