## 1. Backend Extraction Model

- [x] 1.1 Add `profileExtractions` database migration default.
- [x] 1.2 Add local text extraction helper for plain text, Markdown, JSON, DOCX, and PDF files.
- [x] 1.3 Add rule-based mapper from extracted text to profile candidate fields.
- [x] 1.4 Add extraction records with project ID, file ID, status, candidates, text preview, and timestamps.

## 2. Extraction APIs

- [x] 2.1 Add `POST /api/projects/:projectId/files/:fileId/extract-profile`.
- [x] 2.2 Include project extraction records in `GET /api/projects/:projectId`.
- [x] 2.3 Return clear errors for missing projects, missing files, missing stored files, and unsupported/no-text files.

## 3. Frontend Review Flow

- [x] 3.1 Add extraction action buttons to uploaded/context file rows.
- [x] 3.2 Add a review panel showing candidate field, current value, suggested value, confidence, and source snippet.
- [x] 3.3 Allow users to apply selected candidates to the profile draft without auto-saving.
- [x] 3.4 Keep final persistence through the existing Save Profile action.

## 4. Verification

- [x] 4.1 Add backend integration tests for upload, extract, candidate output, and unchanged saved profile.
- [x] 4.2 Run `npm test`.
- [x] 4.3 Run frontend production build.
- [x] 4.4 Smoke test extraction API against the running local service.
- [x] 4.5 Verify the rendered UI flow in the browser.
- [x] 4.6 Run OpenSpec validation for the change.
