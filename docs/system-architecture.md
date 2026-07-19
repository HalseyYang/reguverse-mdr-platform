# System Architecture

ReguVerse MDR Platform is designed as a browser-based regulatory workflow application.

## Current Prototype

- Frontend: React / Vite
- Backend: Express API
- Local frontend: `http://127.0.0.1:5173/`
- Local API: `http://127.0.0.1:8787/api/health`

## Main Modules

- Project workspace
- Device profile wizard
- Context file upload and extraction
- CER workflow task engine
- AI configuration center
- AI tools, including CE MDR medical device classifier

## Data Flow

```text
Uploaded files
  -> text extraction
  -> structured field candidates
  -> human review
  -> device profile update
  -> Step 1 intended purpose confirmation
  -> approved and locked Step 1 output
  -> Step 2 SOTA / clinical background generation
```

## Backend Responsibilities

- Store projects, device profiles, files, extraction results, and task outputs
- Parse uploaded files such as text, markdown, JSON, CSV, DOCX, and PDF
- Call configured AI provider when available
- Provide deterministic fallback extraction when AI is unavailable
- Generate structured workflow outputs
- Enforce approval and locking logic

## Frontend Responsibilities

- Provide a workflow-first project UI
- Let users upload context files inside the project and device profile page
- Show extracted field candidates and allow editing before applying
- Let users save drafts, approve outputs, and continue to downstream steps
- Provide an AI Tools page for classification and drafting utilities

## Security Notes

- API keys must remain in `.env`
- Uploaded customer documents should not be committed
- AI extraction should show sources and allow human confirmation
- Approved regulatory outputs should be locked before reuse by downstream steps
