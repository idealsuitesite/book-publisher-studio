import type { Book } from '../models/Book';
import type { RenderedOutputs } from '../models/PublishingReport';
import type { PublishingBundle, PublishingBundleManifest } from '../models/PublishingBundle';

// Pure, no file I/O (Decision 6's "Domain (pure)" branch) - everything this sprint needs stays
// in-memory Buffers, consistent with Decision 5's no-real-submission boundary. Platform-agnostic
// by construction (Decision 8, ADR-0037): nothing here names or assumes KDP or any other target.
export class Packaging {
  assemble(book: Book, renderedOutputs: RenderedOutputs): PublishingBundle {
    const cover = book.metadata.coverImage?.base64
      ? Buffer.from(book.metadata.coverImage.base64, 'base64')
      : undefined;

    const manifest: PublishingBundleManifest = {
      formatsIncluded: this.listFormats(renderedOutputs),
      hasCover: cover !== undefined,
      assembledAt: new Date(),
    };

    return {
      manuscript: renderedOutputs,
      cover,
      metadata: book.metadata,
      assets: [],
      manifest,
    };
  }

  private listFormats(renderedOutputs: RenderedOutputs): ('pdf' | 'epub' | 'docx')[] {
    const formats: ('pdf' | 'epub' | 'docx')[] = [];
    if (renderedOutputs.pdf) formats.push('pdf');
    if (renderedOutputs.epub) formats.push('epub');
    if (renderedOutputs.docx) formats.push('docx');
    return formats;
  }
}
