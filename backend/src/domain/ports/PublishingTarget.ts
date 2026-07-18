import type { Book } from '../models/Book';
import type { PublishingReport, RenderedOutputs } from '../models/PublishingReport';

export interface PublishingTarget {
  prepare(book: Book, renderedOutputs: RenderedOutputs): PublishingReport;
}
