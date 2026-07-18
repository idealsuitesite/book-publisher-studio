import type { BlockDTO } from './BlockDTO';

export interface SectionDTO {
  type: 'section';
  id: string;
  title: string;
  content: BlockDTO[];
  subsections?: SectionDTO[];
  level: number;
}
