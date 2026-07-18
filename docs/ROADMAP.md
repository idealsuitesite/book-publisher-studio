# Roadmap - Book Publisher Studio

> **⚠️ SUPERSEDED — HISTORICAL RECORD ONLY (annotated 2026-07-18, ADR-0040 Correction 3).**
>
> This document stopped being maintained around Sprint 1 and is roughly **eight sprints out of date** — it still describes "Sprint 1: Import Pipeline ✅ IN PROGRESS" below, while the project has released nine sprints through `v0.9.0-alpha`. It is **annotated rather than rewritten or deleted**, following ADR-0010's precedent, so it stays readable as the record of how the project was originally planned.
>
> **For anything current, use these instead — all three are actively maintained:**
> - `docs/VERSIONS.md` — the authoritative version→milestone mapping, including the full reordered roadmap (ADR-0039)
> - `docs/TODO.md` — current task state: blocked, in progress, completed
> - `docs/architecture/diagrams/*.md` — the per-sprint Level 2 Design Reviews, where sprint scope is actually decided
>
> Nothing below this line should be read as a statement about the present.

## Sprint 1: Import Pipeline ✅ IN PROGRESS

**Current Phase:** Phase 2 (Application Layer) Complete → Phase 3 (Presentation) Starting

**Completed:**
- ✅ Domain Layer (Book AST, validation, metrics)
- ✅ Application Layer (DTOs, mappers, ImportManuscriptUseCase)

**In Progress:**
- 🔄 Presentation Layer (ManuscriptController, HTTP endpoint)

**Next:**
- E2E testing
- Git commit & documentation update

**Target:** July 16, 2026 (CURRENT)

---

## Sprint 2: Rendering Pipeline (PDF Export)

**Timeline:** Late July 2026

**Goals:**
- PDF rendering engine
- Professional typography
- Theme application
- Page layout

**Components:**
- PDFRenderer (infrastructure)
- ExportBookUseCase (application)
- ThemeEngine (domain)

---

## Sprint 3: Theme Engine

**Timeline:** August 2026

**Goals:**
- Built-in themes (Classic, Modern, Academic)
- Custom theme builder
- Font management
- Color schemes

**Components:**
- ThemeService (domain)
- ThemeRepository (infrastructure)

---

## Sprint 4: EPUB Generation

**Timeline:** August-September 2026

**Goals:**
- EPUB3 compliance
- Table of contents
- Metadata embedding
- Image handling

**Components:**
- EPUBRenderer (infrastructure)

---

## Sprint 5: Premium UI/UX

**Timeline:** September 2026

**Goals:**
- Next.js frontend (desktop)
- Drag-and-drop editor
- Real-time preview
- Responsive design

**Components:**
- Next.js application
- React components
- REST API integration

---

## Sprint 6: AI Integration (Planned)

**Timeline:** October 2026

**Goals:**
- AI-powered editing suggestions
- Grammar checking
- Structure recommendations
- Content generation assistance

**Integration:** OpenAI API / Claude API

---

## Sprint 7: KDP Integration (Planned)

**Timeline:** November 2026

**Goals:**
- Amazon KDP API integration
- One-click publishing
- Royalty tracking
- Sales dashboard

---

## Sprint 8: Kobo Integration (Planned)

**Timeline:** December 2026

**Goals:**
- Kobo Writing Life API
- Multi-platform publishing
- Unified dashboard

---

## Long-term Vision (2027+)

- [ ] Google Books integration
- [ ] Cloud storage (AWS S3)
- [ ] Collaborative editing
- [ ] Version control
- [ ] Advanced analytics
- [ ] Mobile apps (iOS/Android)