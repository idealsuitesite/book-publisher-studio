import type { NormalizedDocument, DocumentMetadata } from '../models/Normalized';

export interface DocumentNormalizer {
  normalize(html: string, metadata?: Partial<DocumentMetadata>): NormalizedDocument;
}
