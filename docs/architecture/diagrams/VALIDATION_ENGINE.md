# Validation Engine — Design Review (Sprint 5)

**Status:** ✅ APPROVED (2026-07-17) — round 2 complete, all open questions resolved by explicit CTO decision. Ready for implementation once the CTO gives final go-ahead to branch (per the CTO's own framing: this finalization pass happens *before* any implementation, not as part of it).
**Date:** 2026-07-17
**Scope:** Sprint 5, the single engine selected for detailed (Level 2) design per `PLATFORM_ARCHITECTURE_ROADMAP.md`.

---

## 1. Objectives

Per CTO direction (2026-07-17) and `docs/VISION.md`'s original "Validator Engine" entry:

1. Determine **objectively** whether a manuscript is correct and compliant — **diagnostics only, never corrections**. This boundary separates Validation Engine from Editorial AI Engine (Sprint 6/7) and is formalized as ADR-0027 ("Validation Engine is Read-Only") — no rule may mutate the `Book` AST, ever.
2. Activate `QualityMetrics` (`BookMetricsCalculator.calculateQualityMetrics()`, built Sprint 4 commit 9) as real input data, computed once per validation run and shared across every rule via `ValidationContext` (§6), not recomputed per rule.
3. Populate `ValidationWarning`/the new severity model for the first time — see §5 (`ValidationSeverity`).
4. Cover the CTO-confirmed scope: metadata completeness, heading hierarchy, required-style structural consistency, typography issues, image resolution, hyperlink well-formedness, KDP/EPUB **pre-render** readiness.
5. Produce output structured enough for Editorial AI Engine to consume later (Sprint 6/7) — this sprint does not build Editorial AI Engine, but its output shape (`ValidationReport`, `ValidationContext`) is a real constraint on this sprint's design.

---

## 2. Current State — Evidence, Not Assumptions

Unchanged from round 1 (still accurate, re-verified against the code, not re-read from scratch since nothing on `main` changed since round 1):

| Concern | Current state |
|---|---|
| Structural validation | `BookValidator.validate(book): ValidationResult` — 5 checks: `MISSING_TITLE`, `MISSING_AUTHOR`, `EMPTY_BOOK`, `EMPTY_CHAPTER_TITLE`, `DUPLICATE_CHAPTER_NUMBER`. All hard errors; `warnings` is always `[]`. |
| Wiring | Already called from `ImportManuscriptUseCase.execute()`, result folded into `ImportReportDTO.{status, warnings, errors}` (string messages only). |
| `QualityMetrics` | 17 fields, all real and computable via `BookMetricsCalculator.calculateQualityMetrics(paginated: PaginatedBook)` (Sprint 4 commit 9) — zero callers outside its own test file. Needs a `PaginatedBook`, not just a `Book`. |
| Heading hierarchy | `Heading.level: 1-6` exists; nothing checks monotonic increase today. |
| Image resolution | `Image.dpi?: number` already modeled; nothing reads it for validation. |
| Hyperlinks | `Link { type: 'link', text, url, target? }`; `url` never checked for well-formedness. |
| Domain model gaps found this round | No `FootnoteReference` inline element exists in `InlineElement` (`Book.ts`) distinct from a `Footnote` block — one CTO-proposed `MissingRequiredStyleRule` example ("FootnoteReference without Footnote") isn't checkable against the current AST without a model addition. Flagged in §5, not silently implemented against a concept that doesn't exist (same discipline that got "Missing Styles" reconsidered in round 1). |

---

## 3. Round 2 — Locked CTO Decisions

All four round-1 open questions resolved. Recorded here as the authoritative decisions (the CTO's own message this round contained two passes over the same four questions with different answers on point 1 — the second, more detailed pass is treated as authoritative per the CTO's closing verdict, which explicitly builds on that second pass).

**Decision 1 — "Missing Styles" is not removed; it's redefined and renamed `MissingRequiredStyleRule`.** Not "a block has no style" (impossible today, `ThemeEngine` always resolves one) but "a structural pattern that should co-occur with something else doesn't." Confirmed, checkable-today example: a heading level skip (H1 → H3 with no H2) — this **overlaps** with the heading-hierarchy check named in §1 item 4 / round 1's Functional Spec item 3. Resolution: `HeadingRule` owns heading-level-skip detection (one rule, one owner, per ADR-0027's sibling principle of no rule duplicating another's concern); `MissingRequiredStyleRule` is scoped to the *other* structural patterns the CTO named that are **not** heading-level patterns:
   - A chapter containing only `Quote`/`Scripture` blocks and never a `Paragraph` ("Normal"/body text) — checkable today against the existing `Block` union.
   - "TOC without Heading 1" and "FootnoteReference without Footnote" — **named by the CTO, not implemented this sprint.** The first needs `TableOfContents`/`TOCEntry` (already modeled, `Book.ts` `FrontMatter.toc`) cross-checked against `Heading` blocks — feasible, deferred only for scope/time, not a model gap. The second has a real model gap (no `FootnoteReference` inline element exists) — implementing it would mean adding a new `InlineElement` variant, which is Domain-model surgery beyond "add a validation rule" and is out of this sprint's scope. Both are named explicitly in `RuleRegistry`'s design (§6) as reserved-but-not-implemented so a future sprint doesn't have to rediscover them.

**Decision 2 — KDP/EPUB compliance: pre-render only, Sprint 5.** Two explicit categories going forward, matching the CTO's own naming:
   - **`PreRenderValidation`** (Sprint 5, this review) — everything checkable from the `Book` AST alone: ISBN presence, title/author presence, language set, cover image present.
   - **`PostRenderValidation`** (future, explicitly not this sprint, likely belongs to `Publishing Engine` per `PLATFORM_ARCHITECTURE_ROADMAP.md` since that's the engine that owns platform-specific packaging) — rendered-output correctness: real page count, embedded-font validity, EPUB structural validity. Named here so it isn't lost, not designed.

**Decision 3 — Hyperlink checks: syntactic only, no network I/O.** Confirmed scope: valid URL (`https://`/`http://`), valid `mailto:`, valid internal anchor (`#fragment`), reject empty `href`. Domain stays pure (ADR-0002) — no new Infrastructure port this sprint. Real reachability checking (HTTP HEAD/GET) is named as a future `ValidationPlugin` extension point, not built now.

**Decision 4 — Architecture: `ValidationEngine` orchestrates a `RuleRegistry` of independent `Rule`s**, refined beyond round 1's flat "Validator" list into an explicitly extensible registry pattern (the CTO's own words: "encore plus convaincu" than the round-1 proposal). See §6 for the shape. Each rule: one responsibility, its own test suite, zero dependency on any other rule's output — enforced by giving every rule the *same* `ValidationContext` input rather than letting rules call each other.

**New, round-2-only additions:**

**`ValidationContext`** replaces `validate(book, paginated?)` with `validate(context: ValidationContext)`. Rationale (CTO's own, recorded verbatim in intent): stabilizes the public API now so that `ValidationProfile` (KDP vs. Kobo vs. Academic vs. Magazine vs. Bible, each activating a different rule subset), `locale`, and `rendererCapabilities` can be added later as `ValidationContext` fields without another signature break. Same "additive, no signature change" discipline ADR-0022 already used for `StyledBook.blockTypography?`.

**`ValidationSeverity`** — four levels (`ERROR`, `WARNING`, `INFO`, `SUGGESTION`), not the existing two (`ValidationError` vs. `ValidationWarning` with an optional, already-underused `severity?: 'info' | 'warning'` on the latter). See §6 for how this reshapes `ValidationIssue`/`ValidationReport` without breaking the existing `ValidationResult` shape `ImportManuscriptUseCase` already depends on.

**ADR-0027 — Validation Engine is Read-Only.** Written this round (`docs/DECISIONS.md`) — formalizes that no rule may mutate the `Book` AST; corrections belong exclusively to Editorial AI Engine or Professional Layout Engine.

---

## 4. Architecture Impact

```
Book (built) → ASTBuilder → ValidationEngine.validate(context: ValidationContext) → ValidationReport
                                                                                          │
                                                                                          ▼
                                                                    ImportManuscriptUseCase
                                                                    (existing DTO extended additively)
```

**No signature change to anything already built** outside `ImportManuscriptUseCase`'s own constructor — same discipline as every prior Sprint 4 engine (ADR-0022). `ValidationEngine` is a new concrete Domain class (not a port — one correct orchestration for this project's rule set; individual `Rule`s inside it are also concrete, not ports, since none of them wrap a swappable external system this sprint — see Decision 3, no network I/O).

**`BookValidator`'s 5 existing checks become the initial `StructuralRule`(s) inside the registry** — moved, not reimplemented, exactly ADR-0008's own precedent for moving code between Domain services without behavior change.

---

## 5. Functional Specifications (locked)

1. **Structural checks (unchanged behavior)** — `MISSING_TITLE`, `MISSING_AUTHOR`, `EMPTY_BOOK`, `EMPTY_CHAPTER_TITLE`, `DUPLICATE_CHAPTER_NUMBER`. Becomes `StructuralRule`.
2. **Metadata completeness** — `MetadataRule`: missing ISBN, missing language, missing description, missing cover image → `ValidationIssue` at `WARNING` severity (not `ERROR` — a manuscript without an ISBN is still exportable).
3. **Heading hierarchy** — `HeadingRule`: heading level skip (H1 → H3 with no H2) → `WARNING`. Owns this pattern exclusively (see Decision 1 — not duplicated by `MissingRequiredStyleRule`).
4. **`MissingRequiredStyleRule`** — chapter containing only `Quote`/`Scripture` blocks, never a `Paragraph` → `INFO` (a stylistic observation, not necessarily wrong — some chapters are legitimately all-epigraph). TOC-without-H1 and FootnoteReference-without-Footnote are reserved in the registry (named, not implemented — see Decision 1).
5. **Typography issues** — `TypographyRule`: wraps `ValidationContext.metrics` (pre-computed `QualityMetrics`, not recomputed) — `widowsAndOrphans`/`inconsistentSpacing`/`emptyHeadings` counts above a threshold → `WARNING`; large `dropCaps` count relative to paragraph count is informational only → `INFO`.
6. **Image resolution** — `ImageRule`: `Image.dpi` set and below 300 → `WARNING`. No `dpi` set at all → not flagged (absence isn't evidence).
7. **Hyperlink well-formedness** — `HyperlinkRule`: per Decision 3's exact rule set (valid `http(s)://`, valid `mailto:`, valid internal anchor, reject empty `href`) → `ERROR` (a broken link is a real, blocking defect, not just a style nit — this is a deliberate severity choice, different from most other new rules defaulting to `WARNING`/`INFO`).
8. **KDP/EPUB pre-render readiness** — `ComplianceRule`: per Decision 2, `PreRenderValidation` category only — ISBN present (overlaps `MetadataRule` #2 above, but framed as platform-readiness rather than generic completeness; both fire independently, a future UI can de-duplicate by code if needed), title/author non-empty (overlaps `StructuralRule`, same reasoning).
9. **Long-chapter suggestion** — new, `SUGGESTION`-severity example named directly by the CTO ("votre chapitre fait 75 pages, suggestion: le diviser") — `TypographyRule` or a small dedicated rule; exact threshold is implementation detail, not fixed here (same "functional intent now, arithmetic later" pattern as `QualityScore` below).
10. **`QualityScore`** — unchanged from round 1: a 0-100 composite plus per-category subscores (`structure`, `metadata`, `typography`, `accessibility`). Exact formula remains implementation detail for the commit that builds it.

---

## 6. Technical Specifications (locked public interfaces)

```ts
// domain/models/ValidationContext.ts — new
export interface ValidationContext {
  book: Book;
  paginated?: PaginatedBook;         // optional - only rules needing QualityMetrics require it
  metrics?: QualityMetrics;          // pre-computed once by the caller, shared across all rules
  configuration?: ValidationProfileConfig; // reserved, not used by any rule yet
  locale?: string;                   // reserved, not used by any rule yet
  theme?: Theme;                     // reserved, not used by any rule yet
  rendererCapabilities?: RendererCapabilities; // reserved, not used by any rule yet
  validationProfile?: 'kdp' | 'kobo' | 'epub' | 'academic' | 'magazine' | 'bible'; // reserved -
    // no rule reads this yet; exists so ComplianceRule's future per-platform variants don't
    // require another ValidationContext shape change, matching the whole point of this type
}

// domain/models/Book.ts — additive, new
export type ValidationSeverity = 'ERROR' | 'WARNING' | 'INFO' | 'SUGGESTION';

export interface ValidationIssue {
  code: string;
  message: string;
  location: string;
  severity: ValidationSeverity;
  suggestion?: string; // reuses ValidationError's existing optional `suggestion` field's intent
}

export interface ValidationReport {
  isValid: boolean;           // true iff no ERROR-severity issues - same meaning as today's ValidationResult.isValid
  issues: ValidationIssue[];  // primary output - every rule's findings, any severity
  score: QualityScore;
  // errors/warnings below are DERIVED VIEWS for backward compatibility with
  // ImportManuscriptUseCase's existing ValidationResult-shaped consumers - not
  // independently populated, computed from `issues` by severity filter:
  errors: ValidationError[];    // issues.filter(i => i.severity === 'ERROR'), mapped to the old shape
  warnings: ValidationWarning[]; // issues.filter(i => i.severity === 'WARNING'), mapped to the old shape
}

export interface QualityScore {
  overall: number; // 0-100
  categories: {
    structure: number;
    metadata: number;
    typography: number;
    accessibility: number;
  };
}

// domain/services/validation/Rule.ts — new, the contract every rule implements
export interface ValidationRule {
  readonly name: string;
  evaluate(context: ValidationContext): ValidationIssue[]; // pure - ADR-0027, no Book mutation, ever
}

// domain/services/validation/RuleRegistry.ts — new
export class RuleRegistry {
  register(rule: ValidationRule): void;
  getAll(): ValidationRule[];
}

// domain/services/ValidationEngine.ts — new, the orchestrator
export class ValidationEngine {
  constructor(private registry: RuleRegistry) {}
  validate(context: ValidationContext): ValidationReport;
}
```

**`ValidationError`/`ValidationWarning` (existing types, `Book.ts`) are kept unchanged** — `ValidationReport.errors`/`.warnings` are computed *views* over `issues`, not a second independent source of truth. This is what keeps `ImportManuscriptUseCase`'s existing `ImportReportDTO` wiring (`validation.warnings.map(w => w.message)`, `validation.errors.map(e => e.message)`) working without a rewrite — `ValidationReport extends`-compatible with everywhere `ValidationResult` is consumed today, additive per ADR-0022's own precedent for `StyledBook.blockTypography?`.

**Wiring:** `ImportManuscriptUseCase`'s `validator: BookValidator` constructor param becomes `validator: ValidationEngine`. `ImportReportDTO` gains `score`/richer issue data, or a new `ValidationReportDTO` is introduced at the DTO boundary (exact DTO shape is implementation detail for the wiring commit, not fixed here — must not leak `Book`/`ValidationContext` Domain objects to Presentation, `docs/CLAUDE.md` rule 3).

**`ExportManuscriptUseCase` — still not wired this sprint**, unchanged from round 1's decision.

---

## 7. Risks

1. **`RuleRegistry`'s reserved-but-unused `ValidationContext` fields** (`configuration`, `locale`, `theme`, `rendererCapabilities`, `validationProfile`) **are speculative** — built now on the CTO's explicit "stabilize the interface" rationale, but every one of them has zero real consumers this sprint. If none of them end up used by Sprint 6/7 or the eventual per-platform `ComplianceRule` variants, this is unused surface area carried for nothing. Named as a real, accepted risk (the CTO's own tradeoff, made explicitly, not a default reached by omission) rather than hidden.
2. **`MissingRequiredStyleRule`'s two CTO-named examples (TOC-without-H1, FootnoteReference-without-Footnote) are not implemented this sprint** (§3, Decision 1) — a future session picking this back up needs to read this document before assuming the rule is "done," since its name doesn't fully match its Sprint 5 scope.
3. **`ValidationReport.errors`/`.warnings` as derived views doubles the representation of every `ERROR`/`WARNING`-severity issue** (once in `issues`, once mapped into the legacy arrays) — a deliberate, disclosed backward-compatibility cost, not an oversight; revisit once `ImportManuscriptUseCase`'s DTO is redesigned to consume `issues` directly (likely alongside Editorial AI Engine's own wiring, Sprint 6/7).
4. **`QualityScore`'s formula still has no locked definition** (§5 item 10, unchanged from round 1) — same accepted-risk category as ADR-0022's `averageHeadingDepth`/etc.
5. **Editorial AI Engine's real needs still aren't known** (unchanged from round 1) — `ValidationReport`/`ValidationContext`'s shapes are designed against stated intent, not a real consumer.

---

## 8. Commit Plan

Same discipline as Sprint 4: small atomic commits, green build/tests before each next step, on a new feature branch (ADR-0017 — no direct-to-`main` implementation).

1. `domain(validation): ValidationContext, ValidationSeverity, ValidationIssue, ValidationReport, QualityScore types`
2. `domain(validation): ValidationRule contract + RuleRegistry`
3. `domain(validation): ValidationEngine orchestrator; StructuralRule wraps existing BookValidator logic unchanged` — existing `BookValidator.test.ts` cases migrate onto `StructuralRule`, no behavior change
4. `domain(validation): MetadataRule — ISBN/language/description/cover completeness`
5. `domain(validation): HeadingRule — heading level skip detection`
6. `domain(validation): MissingRequiredStyleRule — chapter-without-body-text pattern (TOC/FootnoteReference variants reserved, not implemented)`
7. `domain(validation): TypographyRule wraps QualityMetrics from ValidationContext.metrics + long-chapter SUGGESTION`
8. `domain(validation): ImageRule + HyperlinkRule (syntactic only, no network I/O)`
9. `domain(validation): ComplianceRule — KDP/EPUB pre-render readiness`
10. `domain(validation): QualityScore composite scoring`
11. `application(import): wire ValidationEngine into ImportManuscriptUseCase, DTO updates`
12. E2E real-file verification pass (`docs/REAL_EXPORT_CHECKLIST.md` — Validation Engine changes `ImportManuscriptUseCase`, so the import side applies)
13. `docs`: ADR-0028+ for any further real decisions found during implementation (matching ADR-0026's precedent — real bugs/gaps found via real-file verification get documented, not silently absorbed), final `CURRENT_STATE.md`/`TODO.md`/`VERSIONS.md` pass

**ADR-0027 (read-only) is written before commit 1** (this round, ahead of the branch even existing) since it constrains every rule's implementation from the start, not something to retrofit after the fact.

---

## 9. Acceptance Criteria

- All existing `BookValidator.test.ts` cases still pass, unchanged in behavior, now running through `StructuralRule`
- New tests for every new rule (`MetadataRule`, `HeadingRule`, `MissingRequiredStyleRule`, `TypographyRule`, `ImageRule`, `HyperlinkRule`, `ComplianceRule`), each its own test file per the CTO's "one responsibility, own test suite" requirement
- A real DOCX from `backend/verification/` imported through the running dev server produces a `ValidationReport` with real, non-hardcoded-zero data reflecting that fixture's actual known issues
- No rule mutates its input `Book`/`ValidationContext` — enforced by test (deep-equality check of the input before/after `evaluate()` for every rule), not just by convention, per ADR-0027
- Global coverage stays >80%, Domain coverage stays >90% (ADR-0006 gates, unchanged)
- 0 ESLint errors/warnings maintained

---

## 10. Related

- `docs/architecture/diagrams/PLATFORM_ARCHITECTURE_ROADMAP.md` — Level 1
- `docs/VISION.md` §"Validator Engine", §"Editorial AI Engine"
- ADR-0008 (metrics ownership, code-move-without-behavior-change precedent)
- ADR-0022 (functional-definition-now/arithmetic-later pattern; additive-field-not-signature-break pattern, reused for both `ValidationContext` and `ValidationReport`)
- ADR-0027 (Validation Engine is read-only — new this round)
- `docs/CLAUDE.md` (Clean Architecture rules — Domain zero infra deps, relevant to Decision 3)
