import type {
  Book,
  Chapter,
  Section,
  Content,
  Block,
  Heading,
  Paragraph,
  Quote,
  Scripture,
  Image,
  Table,
  List,
  Footnote,
  BookMetadata,
} from '../models/Book';
import type {
  NormalizedDocument,
  AnyNormalizedNode,
  HeadingNode,
  ParagraphNode,
  ImageNode,
  TableNode,
  QuoteNode,
  ScriptureNode,
  ListNode,
  FootnoteNode,
} from '../models/Normalized';
import { createIdGenerator } from '../../shared/utils/idGenerator';

interface SectionStackEntry {
  level: number;
  section: Section;
}

export class ASTBuilder {
  build(doc: NormalizedDocument): Book {
    const ids = this.createIdGenerators();
    const now = new Date();

    const mainContent: Content[] = [];
    let currentChapter: Chapter | null = null;
    let preamble: Section | null = null;
    let sectionStack: SectionStackEntry[] = [];
    let chapterNumber = 0;
    let footnoteNumber = 0;

    const openChapter = (title: string): Chapter => {
      chapterNumber += 1;
      const chapter: Chapter = {
        type: 'chapter',
        id: ids.chapter(),
        number: chapterNumber,
        title,
        content: [],
        createdAt: now,
        updatedAt: now,
      };
      mainContent.push(chapter);
      sectionStack = [];
      return chapter;
    };

    const openSection = (level: number, title: string): Section => {
      const section: Section = {
        type: 'section',
        id: ids.section(),
        title,
        content: [],
        level,
        createdAt: now,
        updatedAt: now,
      };

      while (sectionStack.length > 0 && sectionStack[sectionStack.length - 1].level >= level) {
        sectionStack.pop();
      }

      if (sectionStack.length > 0) {
        const parent = sectionStack[sectionStack.length - 1].section;
        parent.subsections = parent.subsections ?? [];
        parent.subsections.push(section);
      } else if (currentChapter) {
        currentChapter.sections = currentChapter.sections ?? [];
        currentChapter.sections.push(section);
      } else {
        mainContent.push(section);
      }

      sectionStack.push({ level, section });
      return section;
    };

    const currentTarget = (): Block[] => {
      if (sectionStack.length > 0) return sectionStack[sectionStack.length - 1].section.content;
      if (currentChapter) return currentChapter.content;
      if (!preamble) {
        preamble = {
          type: 'section',
          id: ids.section(),
          title: '',
          content: [],
          level: 0,
          createdAt: now,
          updatedAt: now,
        };
        mainContent.push(preamble);
      }
      return preamble.content;
    };

    for (const node of doc.nodes) {
      if (node.type === 'heading') {
        const headingNode = node as HeadingNode;
        if (headingNode.level <= 1) {
          currentChapter = openChapter(headingNode.text);
        } else {
          openSection(headingNode.level, headingNode.text);
        }
        continue;
      }

      if (node.type === 'footnote') {
        footnoteNumber += 1;
      }

      currentTarget().push(this.convertNode(node, ids, footnoteNumber));
    }

    const metadata = this.buildMetadata(doc);

    return {
      id: ids.book(),
      metadata,
      frontMatter: {},
      mainContent,
      backMatter: {},
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
  }

  private convertNode(
    node: AnyNormalizedNode,
    ids: ReturnType<ASTBuilder['createIdGenerators']>,
    footnoteNumber: number
  ): Block {
    switch (node.type) {
      case 'heading':
        return this.convertHeading(node as HeadingNode, ids);
      case 'paragraph':
        return this.convertParagraph(node as ParagraphNode, ids);
      case 'quote':
        return this.convertQuote(node as QuoteNode, ids);
      case 'scripture':
        return this.convertScripture(node as ScriptureNode, ids);
      case 'image':
        return this.convertImage(node as ImageNode, ids);
      case 'table':
        return this.convertTable(node as TableNode, ids);
      case 'list':
        return this.convertList(node as ListNode, ids);
      case 'footnote':
        return this.convertFootnote(node as FootnoteNode, ids, footnoteNumber);
      default: {
        const _exhaustive: never = node;
        throw new Error(`Unsupported node type: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  private convertHeading(
    node: HeadingNode,
    ids: ReturnType<ASTBuilder['createIdGenerators']>
  ): Heading {
    const level = Math.min(6, Math.max(1, node.level)) as Heading['level'];
    return { type: 'heading', id: ids.heading(), level, text: node.text };
  }

  private convertParagraph(
    node: ParagraphNode,
    ids: ReturnType<ASTBuilder['createIdGenerators']>
  ): Paragraph {
    const text = node.inlines.map((i) => i.text).join('');
    return {
      type: 'paragraph',
      id: ids.paragraph(),
      text,
      inlines: this.convertInlines(node.inlines),
    };
  }

  private convertQuote(node: QuoteNode, ids: ReturnType<ASTBuilder['createIdGenerators']>): Quote {
    const text = node.inlines.map((i) => i.text).join('');
    return {
      type: 'quote',
      id: ids.quote(),
      text,
      inlines: this.convertInlines(node.inlines),
      attribution: node.attribution,
      quoteType: 'block',
    };
  }

  private convertScripture(
    node: ScriptureNode,
    ids: ReturnType<ASTBuilder['createIdGenerators']>
  ): Scripture {
    return {
      type: 'scripture',
      id: ids.scripture(),
      text: node.text,
      translation: node.translation,
      reference: this.parseScriptureReference(node.reference),
    };
  }

  private convertImage(node: ImageNode, ids: ReturnType<ASTBuilder['createIdGenerators']>): Image {
    return {
      type: 'image',
      id: ids.image(),
      url: node.image.url,
      base64: node.image.base64,
      caption: node.image.caption,
      alt: node.image.alt,
      width: node.image.width,
      height: node.image.height,
    };
  }

  private convertTable(node: TableNode, ids: ReturnType<ASTBuilder['createIdGenerators']>): Table {
    const headerRow = node.rows.find((row) => row.isHeader);
    const bodyRows = node.rows.filter((row) => !row.isHeader);
    return {
      type: 'table',
      id: ids.table(),
      headers: headerRow ? headerRow.cells : [],
      rows: bodyRows.map((row) => row.cells),
    };
  }

  private convertList(node: ListNode, ids: ReturnType<ASTBuilder['createIdGenerators']>): List {
    return {
      type: 'list',
      id: ids.list(),
      ordered: node.ordered,
      items: node.items,
    };
  }

  private convertFootnote(
    node: FootnoteNode,
    ids: ReturnType<ASTBuilder['createIdGenerators']>,
    footnoteNumber: number
  ): Footnote {
    return {
      type: 'footnote',
      id: ids.footnote(),
      number: footnoteNumber,
      content: node.content,
    };
  }

  private convertInlines(inlines: { type: string; text: string; url?: string }[]) {
    return inlines
      .filter((inline) => inline.type !== 'text')
      .map((inline) => {
        switch (inline.type) {
          case 'bold':
            return { type: 'bold' as const, text: inline.text };
          case 'italic':
            return { type: 'italic' as const, text: inline.text };
          case 'underline':
            return { type: 'underline' as const, text: inline.text };
          case 'link':
            return { type: 'link' as const, text: inline.text, url: inline.url ?? '' };
          case 'small-caps':
            return { type: 'small-caps' as const, text: inline.text };
          default:
            return { type: 'bold' as const, text: inline.text };
        }
      });
  }

  private parseScriptureReference(reference?: string) {
    if (!reference) return undefined;
    const match = reference.match(/^(.+?)\s+(\d+):(\S+)$/);
    if (!match) return undefined;
    const [, book, chapter, verses] = match;
    return { book, chapter: Number(chapter), verses };
  }

  private buildMetadata(doc: NormalizedDocument): BookMetadata {
    return {
      title: doc.metadata.title ?? doc.metadata.fileName,
      author: doc.metadata.author ?? 'Unknown',
      language: 'fr',
    };
  }

  private createIdGenerators() {
    return {
      book: createIdGenerator('book'),
      chapter: createIdGenerator('chapter'),
      section: createIdGenerator('section'),
      heading: createIdGenerator('heading'),
      paragraph: createIdGenerator('paragraph'),
      quote: createIdGenerator('quote'),
      scripture: createIdGenerator('scripture'),
      image: createIdGenerator('image'),
      table: createIdGenerator('table'),
      list: createIdGenerator('list'),
      footnote: createIdGenerator('footnote'),
    };
  }
}
