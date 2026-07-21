import type { BlockDTO } from './BlockDTO';
import type { SectionDTO } from './SectionDTO';

export interface ChapterDTO {
  type: 'chapter';
  id: string;
  number: number;
  title: string;
  subtitle?: string;
  content: BlockDTO[];
  sections?: SectionDTO[];
  /** Editorial placement (MINI_DR_EDITORIAL_PLACEMENT): 'front'/'back' exports before/after the chapters. */
  role?: 'front' | 'back';
  /** A "Part I / Part II" divider (PART_LEVEL_STRUCTURE): titled, blockless, groups the chapters
   * that follow it by position; consumes no chapter number and never counts as a chapter. */
  partOpener?: true;
}
