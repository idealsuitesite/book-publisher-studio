import { XmlAttributeComponent, XmlComponent, Paragraph } from 'docx';

/**
 * Word's NATIVE drop-cap frame, emitted in the exact attribute-free shape Word itself writes
 * (MINI_DR_DROP_CAPS §6 commit 1, spike Finding A). Ground truth, read from a file Word saved
 * after `DropCap.Enable()`:
 *
 *   <w:framePr w:dropCap="drop" w:lines="N" w:wrap="around" w:vAnchor="text" w:hAnchor="text"/>
 *
 * The library's public frame types cannot produce this: both variants extend
 * `IBaseFrameOptions`, which REQUIRES width/height (+ position/alignment) — attributes native
 * drop caps OMIT, so forced zeros land in the XML. This custom component is the clean path the
 * CTO chose over the spike's post-generation patch ("pas de contournement de bibliothèque, pas
 * de patch fragile").
 */
class DropCapFrameAttributes extends XmlAttributeComponent<{
  readonly dropCap: string;
  readonly lines: number;
  readonly wrap: string;
  readonly vAnchor: string;
  readonly hAnchor: string;
}> {
  protected readonly xmlKeys = {
    dropCap: 'w:dropCap',
    lines: 'w:lines',
    wrap: 'w:wrap',
    vAnchor: 'w:vAnchor',
    hAnchor: 'w:hAnchor',
  };
}

class NativeDropCapFrame extends XmlComponent {
  constructor(lines: number) {
    super('w:framePr');
    this.root.push(new DropCapFrameAttributes({ dropCap: 'drop', lines, wrap: 'around', vAnchor: 'text', hAnchor: 'text' }));
  }
}

/**
 * Attaches the native frame to a paragraph's properties. `Paragraph.properties` is TypeScript-
 * private but its `push(item: XmlComponent)` is the library's own public escape hatch on
 * `ParagraphProperties`; the cast is guarded by `docxDropCapFrame.test.ts`, which asserts the
 * EMITTED XML — a docx upgrade that moves this seam fails loudly there, never silently.
 */
export function withNativeDropCapFrame(paragraph: Paragraph, lines: number): Paragraph {
  (paragraph as unknown as { properties: { push(item: XmlComponent): void } }).properties.push(
    new NativeDropCapFrame(lines)
  );
  return paragraph;
}
