import type { EditorialSkeletonDTO, EditorialObjectDTO } from 'shared-types';
import { projectEditorialSkeleton, type EditorialObject } from '../../domain/services/editorialSkeleton';
import type { Book } from '../../domain/models/Book';

/**
 * Maps the Domain editorial skeleton (a projected read model over the immutable Book) onto its DTO
 * for `ProjectDTO.skeleton` (AUTHOR_EXPERIENCE_DR §3 D1). The projection is the single source; this
 * is a plain structural copy that lifts the deep-frozen read model onto the wire shape — it never
 * re-derives structure. A crossing boundary (ADR-0033: Domain objects never reach Presentation).
 */
export function mapEditorialSkeleton(book: Book): EditorialSkeletonDTO {
  const skeleton = projectEditorialSkeleton(book);
  return { objects: skeleton.objects.map(mapObject) };
}

function mapObject(object: EditorialObject): EditorialObjectDTO {
  const dto: EditorialObjectDTO = {
    type: object.type,
    title: object.title,
    place: object.place,
    sourceRef:
      object.sourceRef.kind === 'content'
        ? { kind: 'content', id: object.sourceRef.id }
        : { kind: 'front-matter', slot: object.sourceRef.slot },
  };
  if (object.number !== undefined) dto.number = object.number;
  return dto;
}
