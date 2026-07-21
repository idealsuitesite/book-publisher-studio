import type { Chapter } from '../../domain/models/Book';
import type { ChapterDTO } from '../dto/ChapterDTO';
import { BlockMapper } from './BlockMapper';
import { SectionMapper } from './SectionMapper';

export class ChapterMapper {
  constructor(
    private blockMapper: BlockMapper = new BlockMapper(),
    private sectionMapper: SectionMapper = new SectionMapper()
  ) {}

  map(chapter: Chapter): ChapterDTO {
    return {
      type: 'chapter',
      id: chapter.id,
      number: chapter.number,
      title: chapter.title,
      subtitle: chapter.subtitle,
      content: chapter.content.map((block) => this.blockMapper.map(block)),
      sections: chapter.sections?.map((section) => this.sectionMapper.map(section)),
      role: chapter.role,
      partOpener: chapter.partOpener,
    };
  }
}
