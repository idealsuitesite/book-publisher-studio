import type { Book } from '../models/Book';
import type { PublishingReport, RenderedOutputs } from '../models/PublishingReport';

// prepare() is Sprint 8's only operation, not necessarily this port's final API (CTO note,
// Commit 1 follow-up) - a future validate()/package()/publish() split would be a planned
// evolution of this interface, not an unplanned breaking change discovered later.
export interface PublishingTarget {
  prepare(book: Book, renderedOutputs: RenderedOutputs): PublishingReport;
}
