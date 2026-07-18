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
}
