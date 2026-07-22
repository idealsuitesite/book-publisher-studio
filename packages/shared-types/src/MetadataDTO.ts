export interface MetadataDTO {
  title: string;
  subtitle?: string;
  // Optional (FOUNDER_TRAVERSAL defect 2): absent when the author supplied none — never a
  // placeholder. UI surfaces show nothing rather than inventing "Unknown".
  author?: string;
  publisher?: string;
  isbn?: string;
  language: string;
  description?: string;
  keywords?: string[];
  copyright?: string;
  publicationDate?: string;
}
