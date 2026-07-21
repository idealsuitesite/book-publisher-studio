import type { BlockDTO } from './BlockDTO';

export interface SectionDTO {
  type: 'section';
  id: string;
  title: string;
  content: BlockDTO[];
  subsections?: SectionDTO[];
  level: number;
  /** Editorial placement (MINI_DR_EDITORIAL_PLACEMENT): 'front'/'back' exports before/after the chapters. */
  role?: 'front' | 'back';
}
