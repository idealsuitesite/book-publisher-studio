# Book Publisher Studio

## Mission

Build professional publishing software for Christian authors in francophone West Africa.
Compete with Atticus by offering better UX and AI-powered workflow.

## Vision

Multi-format publishing platform:
- DOCX import & editing
- PDF export (professional typography)
- EPUB generation
- Amazon KDP integration
- Kobo integration
- AI-assisted editing & structure

## Target Users

- Christian authors (French-speaking)
- Small publishers
- Self-published authors
- Churches & ministries

## Current Version

**v0.1.0-alpha** (Sprint 1)

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Next.js 14 (planned)
- **Database**: PostgreSQL (planned)
- **Document Processing**: Mammoth (DOCX parser), Cheerio (HTML normalizer)
- **Export**: PDFKit, Epub (planned)

## Architecture

- **Pattern**: Hexagonal Architecture + DDD
- **Layers**: Domain → Application → Infrastructure → Presentation
- **Core**: Book AST (Abstract Syntax Tree)

## Key Constraints

1. Book is the Single Source of Truth
2. Domain has ZERO external dependencies
3. All data flows through Book model
4. Import pipeline is sequential (no branching)

## Success Metrics

- [ ] DOCX import working
- [ ] PDF export working
- [ ] EPUB export working
- [ ] AI integration working
- [ ] KDP integration working
- [ ] 1000+ books published

## Timeline

- Sprint 1: Import Pipeline ✅ (in progress)
- Sprint 2: Rendering Pipeline (PDF)
- Sprint 3: Theme Engine
- Sprint 4: PDF Generation
- Sprint 5: EPUB Generation
- Sprint 6: UI/UX Polish
- Sprint 7: AI Integration
- Sprint 8: KDP Integration