import type { Book } from './Book';
import type { PublishingBundle } from './PublishingBundle';

export interface PostRenderValidationContext {
  book: Book;
  bundle: PublishingBundle;
}
