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
}
