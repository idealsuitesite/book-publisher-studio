import type { Section } from '../../domain/models/Book';
import type { SectionDTO } from '../dto/SectionDTO';
import { BlockMapper } from './BlockMapper';

export class SectionMapper {
  constructor(private blockMapper: BlockMapper = new BlockMapper()) {}

  map(section: Section): SectionDTO {
    return {
      type: 'section',
      id: section.id,
      title: section.title,
      level: section.level,
      content: section.content.map((block) => this.blockMapper.map(block)),
      subsections: section.subsections?.map((subsection) => this.map(subsection)),
    };
  }
}
