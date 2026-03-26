# SunRAG Web MVP

SunRAG MVP web application for tracking requirements and Jira tickets across SunGuide and NG SELS, with local document ingestion and retrieval-augmented learning chat.

## Implemented in this starter

- Five tabs: Requirements, Tickets, Overview, Test Case Generation, Learning
- Global project scope switcher for SunGuide and NG SELS
- Requirements table with create and delete flows
- Tickets table with CSV upload, row mapping, and ticket-key upsert logic
- Overview dashboard with 4 sections:
  - SunGuide Jira health
  - NG SELS Jira health
  - Requirement assessment
  - Cross-project quality trend
- Manual test case template generation linked to requirement or ticket
- Learning tab document ingestion:
  - Excel (.xlsx/.xls) parsing
  - PDF parsing
  - Text chunking and local retrieval for Q&A responses
- Local browser persistence via localStorage for all core entities

## Run locally

1. Install dependencies:
   `npm install`
2. Start development server:
   `npm run dev`
3. Build:
   `npm run build`

## CSV field mapping

The ticket importer accepts common Jira CSV header variants.

Required fields:
- ticket key (e.g. Ticket, Issue Key, Key)
- summary

Optional fields:
- failure build
- fixed build
- status
- associated test cases

## Current limitations

- Learning chat uses keyword retrieval (not external LLM embeddings yet)
- Jira is CSV-only for MVP (no API sync yet)
- No user auth in this local-first implementation

## Next implementation targets

- Add inline edit and bulk update in Requirements and Tickets tables
- Add stronger CSV validation report with rejected-row export
- Add persistent database and server API
- Upgrade Learning tab to embedding-based retrieval and model-backed responses
- Add traceability graph for requirement -> ticket -> test case
