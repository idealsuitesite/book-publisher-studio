import type { BookMetadata } from './Book';
import type { RenderedOutputs } from './PublishingReport';

export interface PublishingBundleManifest {
  formatsIncluded: ('pdf' | 'epub' | 'docx')[];
  hasCover: boolean;
  assembledAt: Date;
}

// Entirely generic publishing package (Decision 8, ADR-0037) - no field here may ever name or
// assume a platform. manuscript stays a RenderedOutputs (every format Packaging received), not
// one pre-chosen format, because picking which rendered format a given platform actually wants
// is that platform's decision (KDPTarget's job), not Packaging's.
export interface PublishingBundle {
  manuscript: RenderedOutputs;
  cover?: Buffer;
  metadata: BookMetadata;
  assets: Buffer[];
  manifest: PublishingBundleManifest;
}
