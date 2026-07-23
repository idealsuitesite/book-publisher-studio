import { load } from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import { isTag, isText, type AnyNode, type Element } from 'domhandler';
import type {
  NormalizedDocument,
  AnyNormalizedNode,
  DocumentMetadata,
  InlineNode,
  NormalizationDiagnostic,
} from '../../domain/models/Normalized';
import { createIdGenerator } from '../../shared/utils/idGenerator';
import type { DocumentNormalizer } from '../../domain/ports/DocumentNormalizer';

/**
 * Collapse every soft line break to a single boundary space — the ONE class-level fix for the
 * `<br>`-boundary defect (FOUNDER_TRAVERSAL finding 2, BR_BOUNDARY_SCOPE.md). A `<br>` carries no
 * text, so every extraction site (`.text()` on headings/cells/list-items/quotes, and the inline
 * walker, which skipped it as an empty tag) flattened it to nothing and jammed the words on either
 * side (`…ProtectionFOREWORD`, `…discipline.Others`). Measured class-wide: all 7 sites lost it, and
 * real books carry hundreds of `<br>` in body paragraphs.
 *
 * Applied ONCE to the raw HTML before parsing, so no `<br>` survives into the tree and EVERY site
 * — present or future — is covered by construction (fix the class, not the specimen). A RUN of
 * `<br>` plus any surrounding whitespace collapses to exactly ONE space: `<br><br>` → one space
 * (never two, the trap), and `word <br> word` → `word word` (the surrounding whitespace is absorbed
 * into the single boundary). A block with NO `<br>` is returned unchanged — so a manuscript without
 * soft breaks normalises byte-for-byte as before (the corpus parity locks are that guard).
 *
 * Deliberately a boundary SPACE, not a preserved line break (CTO option a): in reflowable text a
 * soft break between sentences is a word boundary, not a hard break; the layout engine re-wraps.
 * Preserving intentional line breaks is a richer question that belongs to typography/AUTHOR_EXPERIENCE,
 * not to this fidelity correctif.
 */
export function collapseLineBreaks(html: string): string {
  return html.replace(/(?:\s*<br\s*\/?>\s*)+/gi, ' ');
}

export class HtmlNormalizer implements DocumentNormalizer {
  normalize(html: string, metadata: Partial<DocumentMetadata> = {}): NormalizedDocument {
    const $ = load(collapseLineBreaks(html));
    const ids = this.createIdGenerators();
    const nodes: AnyNormalizedNode[] = [];
    const diagnostics: NormalizationDiagnostic[] = [];

    const root = $('body').length ? $('body') : $(':root');

    root
      .find('h1, h2, h3, h4, h5, h6, p, img, table, ul, ol, blockquote')
      .each((_: number, elem: Element) => {
        const $elem = $(elem);
        const tag = elem.name?.toLowerCase();

        // The DOM is a TREE, not a flat list (TABLE_DUPLICATION.md, ADR-0050). `.find()` is a
        // DESCENDANT match, and mammoth wraps the content of tables/lists/blockquotes in inner
        // <p> (e.g. `<td><p>Name</p></td>`, `<blockquote><p>…</p></blockquote>`). Those
        // containers each parse their own children internally below, so any element sitting
        // INSIDE one of them must not also be emitted as a top-level block — that is exactly
        // how a table's cells, a blockquote's text, and a multi-paragraph list item's
        // paragraphs were each rendered twice. The container is a leaf to this top-level walk.
        if ($elem.parents('table, ul, ol, blockquote').length > 0) return;

        const text = $elem.text().trim();

        if (!text && tag !== 'img' && tag !== 'table') {
          // Dropping empty elements is right (an empty paragraph is noise) — dropping an
          // empty HEADING silently is not: a Heading 1 marks a chapter boundary, and a real
          // manuscript lost one this way with no trace (ADR-0049, IMPORT_FIDELITY.md §1).
          // The drop stands; the silence does not.
          const emptyHeading = tag?.match(/^h([1-6])$/);
          if (emptyHeading) {
            diagnostics.push({
              code: 'EMPTY_HEADING_DROPPED',
              message: `An empty Heading ${emptyHeading[1]} in the source document was dropped - if it marked a chapter or section break, that break is not represented`,
            });
          }
          return;
        }

        const headingMatch = tag?.match(/^h([1-6])$/);
        if (headingMatch) {
          const level = parseInt(headingMatch[1], 10);
          nodes.push({
            id: ids.node(),
            type: 'heading',
            level,
            text,
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'p') {
          const inlines = this.extractInlines($, $elem);
          nodes.push({
            id: ids.node(),
            type: 'paragraph',
            inlines: inlines.length ? inlines : [{ type: 'text', text }],
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'img') {
          // Mammoth inlines DOCX images as data URLs by default. Until Phase 2
          // (BOOK_PRESENTATION.md §2.5) that base64 sat unparsed inside `url`, so
          // `Block.base64` — which all three renderers already consume — was never
          // populated and every embedded image fell to the text placeholder.
          const src = $elem.attr('src') ?? '';
          const dataUrl = /^data:image\/[a-z+.-]+;base64,(.+)$/is.exec(src);
          nodes.push({
            id: ids.node(),
            type: 'image',
            image: {
              // A parsed data URL leaves `url` empty on purpose: duplicating megabytes of
              // base64 into a field every log/debug dump prints would be pure waste.
              url: dataUrl ? '' : src,
              base64: dataUrl?.[1],
              alt: $elem.attr('alt'),
              caption: $elem.attr('title'),
            },
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'table') {
          const rows: { cells: string[]; isHeader: boolean }[] = [];
          $elem.find('tr').each((_: number, row: Element) => {
            const cells: string[] = [];
            $(row)
              .find('td, th')
              .each((_: number, cell: Element) => {
                cells.push($(cell).text().trim());
              });
            rows.push({ cells, isHeader: $(row).find('th').length > 0 });
          });
          nodes.push({
            id: ids.node(),
            type: 'table',
            rows,
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'ul' || tag === 'ol') {
          const items: string[] = [];
          $elem.find('li').each((_: number, li: Element) => {
            items.push($(li).text().trim());
          });
          nodes.push({
            id: ids.node(),
            type: 'list',
            ordered: tag === 'ol',
            items,
            source: { originalIndex: nodes.length },
          });
        } else if (tag === 'blockquote') {
          const inlines = this.extractInlines($, $elem);
          nodes.push({
            id: ids.node(),
            type: 'quote',
            inlines: inlines.length ? inlines : [{ type: 'text', text }],
            attribution: $elem.find('footer, cite').text().trim() || undefined,
            source: { originalIndex: nodes.length },
          });
        }
      });

    return {
      metadata: {
        fileName: metadata.fileName ?? 'document.html',
        uploadedAt: metadata.uploadedAt ?? new Date(),
        title: metadata.title,
        author: metadata.author,
      },
      nodes,
      ...(diagnostics.length > 0 ? { diagnostics } : {}),
    };
  }

  private extractInlines($: CheerioAPI, $elem: Cheerio<Element>): InlineNode[] {
    const inlines: InlineNode[] = [];

    $elem.contents().each((_: number, node: AnyNode) => {
      if (isText(node)) {
        // Collapse internal whitespace runs (stray tabs/newlines from the source markup)
        // to a single space, but never trim the ends. A text node sitting between two
        // tags (e.g. the " " between "</strong>" and "<em>") IS the word separator -
        // trimming it away silently jams adjacent words together (e.g. "mixesbold") on
        // any real multi-run paragraph. Only a genuinely empty node (zero characters
        // after collapsing) is dropped - this is the fix, not a stricter emptiness check.
        const text = (node.data ?? '').replace(/\s+/g, ' ');
        if (text) inlines.push({ type: 'text', text });
      } else if (isTag(node)) {
        const $node = $(node);
        const tag = node.name?.toLowerCase();
        const text = $node.text().trim();
        if (!text) return;

        if (tag === 'strong' || tag === 'b') inlines.push({ type: 'bold', text });
        else if (tag === 'em' || tag === 'i') inlines.push({ type: 'italic', text });
        else if (tag === 'u') inlines.push({ type: 'underline', text });
        else if (tag === 's' || tag === 'strike' || tag === 'del') inlines.push({ type: 'strikethrough', text });
        else if (tag === 'a') inlines.push({ type: 'link', text, url: $node.attr('href') ?? '' });
        else inlines.push({ type: 'text', text });
      }
    });

    return inlines;
  }

  private createIdGenerators() {
    return { node: createIdGenerator('norm-node') };
  }
}
