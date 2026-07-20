# Table Duplication & Stuck Footer — Investigation (diagnostic only, no fix)

**Status:** 🔍 **FINDINGS — awaiting CTO classification verdict. No code changed.** Ordered by the CTO (2026-07-21) after seeing, on a real manuscript, a table's content rendered TWICE (once as a table, once as flat paragraphs) and a footer page counter that repeats instead of progressing. Phase 3 of the Book Presentation System is PAUSED until this closes. Same discipline as `IMPORT_FIDELITY.md`/`RENDER_DRIFT.md`: reproduce live, locate, classify — fix only after validation. Per the RENDER_DRIFT lesson, the shared-vs-independent-cause question was **measured, not assumed**.

**Date:** 2026-07-21
**Instruments (committed, rerunnable):** the live pipeline on `verification/tables.docx` (a real DOCX with two real tables) and `spikes/footer-trace-spike.ts` (captures the exact footer string drawn on each physical page).

---

## 0. The headline: two INDEPENDENT root causes, in two different layers

They are **not** one bug and **not** shared — proven, not guessed:

- **Défaut A (content duplication)** lives in the **import layer** (`HtmlNormalizer`), has existed since the normalizer was written, and affects every DOCX with a table in every export format.
- **Défaut B (stuck footer)** lives in the **render layer** (`PDFRenderer`), was **introduced by the RENDER_DRIFT fix (ADR-0051)** three chantiers ago, is PDF-only, and is unrelated to tables.

They **interact but do not share a cause**: Défaut A inflates a table document with many extra tiny blocks, which changes pagination and can trigger more of Défaut B's unplanned breaks — so a table manuscript shows both at once (which is why the CTO saw them together), but fixing either leaves the other untouched.

## 1. Défaut A — table content duplicated (import layer)

**Reproduced.** `verification/tables.docx` has 2 short paragraphs and 2 tables. The pipeline produces **2 tables and 20 paragraphs** in the Book AST — the 18 extra paragraphs are the table CELLS, emitted a second time as standalone body paragraphs, in reading order right after each table.

**Located, exactly.** `HtmlNormalizer.ts:24`:
```ts
root.find('h1, h2, h3, h4, h5, h6, p, img, table, ul, ol, blockquote')
```
Mammoth emits table cells as `<td><p>Name</p></td>` (verified: the real HTML for `tables.docx` is `<table><tr><td><p>Name</p></td>…`). cheerio's `.find()` is a **descendant** selector: it matches the `<table>` AND every `<p>` nested inside its `<td>`s. Each cell paragraph is therefore visited twice — once while building the `table` node's rows, once as a top-level `paragraph` node. The `<table>` renders correctly; the cell paragraphs render again beneath it.

**Classification: an import/normalizer algorithm defect.** Not the parser (mammoth's `<td><p>` is valid, standard output), not the renderer (it faithfully draws every block the AST hands it — including the duplicates), not the theme. The normalizer flattens the DOM with a descendant selector that cannot tell "a paragraph of the document" from "a paragraph inside a table cell".

**This is a direct ADR-0050 violation** (the document duplicates text silently) — the gravest class this project guards against, which is why it takes Phase 3's place.

**Why it stayed invisible** (lineage pattern, flagged for the CTO — I do not increment the counter myself): `verify-real-export` renders `tables.docx` and asserts a 200 + a non-trivial body + no exception — never "the output contains each cell once". 567 green tests, and a table has been rendering its own content twice the whole time.

## 2. Défaut B — footer page number repeats (render layer)

**Reproduced.** On `faith-alone-styled.docx` the drawn footers run `Page 1, Page 1, Page 2, Page 3, …` — physical pages 3 and 4 both say "Page 1 of 90". The counter is not globally stuck; it **repeats on specific pages** while the denominator (90) is correct. This is exactly the CTO's screenshot: the viewer's own panel said "page 4", the drawn footer said "Page 1".

**Located, exactly.** `PDFRenderer.ts:191`, inside the ADR-0051 reconciliation wrapper:
```ts
if (!planned) {
  reconciliation.unplannedPageBreaks += 1;
  console.warn(`…unplanned page break…`);
  pageOwners.push(pageOwners[pageOwners.length - 1] ?? 'blank');   // ← copies the previous owner
}
```
When PDFKit inserts an unplanned page (real flow overran the plan), the reconciliation gives the new physical page a **copy of the previous page's domain `Page`** — and the footer numerator reads `owner?.number` (`PDFRenderer.ts` footer draw). So the inserted page draws the **same number** as the page it followed.

**The correlation is exact, 1:1.** Faith-alone has exactly **2** unplanned page breaks (the value the parity test locks) and exactly **2** non-increasing footer steps — the duplicated footers are "Page 1 of 90" and "Page 20 of 90", matching the two break sites (`front matter`/intro, and `paragraph-135` around page 20). Every unplanned break produces one duplicated page number; nothing else does.

**Classification: a render-layer defect, introduced by the RENDER_DRIFT fix (ADR-0051).** The reconciliation copied the previous owner to keep running-head *attribution* correct — the spilled text belongs to the same chapter, so its chapter title should carry over, which is right. But owner identity carries the page NUMBER too, and a physically distinct page must have a distinct number. **One field is doing two jobs**: "which chapter's running head" (should carry over) and "what page number" (must increment). ADR-0051 fixed the first and silently broke the second.

**Why the parity test missed it:** `PDFRenderer.parity.test.ts` asserts the *count* of `unplannedPageBreaks` (2) and the total page count — never that the drawn footer numbers form a strictly increasing sequence. The reconciliation was measured for how many pages it inserts, not for what those pages display.

## 3. Fix directions (sketched for the verdict — NOT implemented)

**Défaut A** — the normalizer must walk the DOM as a tree, not a flat descendant list: process only top-level block elements and, for a `<table>`, consume its cells into rows WITHOUT also visiting them as body paragraphs. Concretely, either exclude `table :is(p, …)` from the selector, or replace the flat `.find(selector)` with a children-walk that recurses into containers but treats `<table>` as a leaf it parses internally. A real-fixture assertion belongs in the harness: "every table cell's text appears exactly once in the output."

**Défaut B** — separate the two jobs the owner currently conflates. The inserted page should keep the previous owner's *running-head title* but take the *next page number* in physical sequence (or `previous.number` is kept for the head while the footer numerator counts physical progression + `startPageNumber` offset). The drift-parity test grows one assertion: the drawn footer numbers are strictly increasing across the book.

Both are small and independent; neither is authorized yet. Order does not matter between them, but **Défaut A is the ADR-0050 violation and should lead** unless the CTO sequences otherwise.

## 4. Lineage note (CTO decision, not mine)

Both defects fit the real-fixture lineage pattern — invisible to a fully green suite, exposed only by looking at real output: **A** because `verify-real-export` checks "valid output", never "each cell once"; **B** because the parity test counts breaks, never checks the resulting numbers. Whether they become entries #10 and #11 is the CTO's call — I flag, I do not count.

## Related

ADR-0050 (Fidelity Is the Product — Défaut A violates it directly), ADR-0051 / RENDER_DRIFT.md (Défaut B is a regression its reconciliation introduced — the owner-copy at PDFRenderer.ts:191), IMPORT_FIDELITY.md (Défaut A is an import-fidelity defect of the same family, different mechanism), REAL_FIXTURE_POLICY.md (both are candidates for the lineage; the harness gaps §1/§2 name are its next escalations).
