## Why

Uploading context files is only useful for the device profile workflow if the system can read those files and turn document content into structured profile field suggestions. This change adds the missing bridge between uploaded project documents and the project/device profile module.

## What Changes

- Add local text extraction for uploaded context documents, initially covering plain text, Markdown, JSON, DOCX, and PDF where parser support is available.
- Add a backend extraction endpoint that analyzes an uploaded file and returns candidate profile field values instead of overwriting the profile automatically.
- Store extraction records with source file ID, extracted text preview, candidate fields, confidence, and source snippets.
- Add frontend controls to run profile extraction from uploaded files.
- Add a review UI where users compare extracted suggestions against current profile values and apply selected suggestions.
- Keep the current upload API and profile save API intact.

## Capabilities

### New Capabilities

- `profile-extraction`: Covers uploaded-file text extraction, profile field candidate generation, reviewable suggestions, and applying selected suggestions into the project/device profile draft.

### Modified Capabilities

- None.

## Impact

- Backend: adds document parser helpers, extraction storage in local JSON data, and APIs for extracting and retrieving candidate profile fields.
- Frontend: adds extraction actions in the context file area and a candidate review panel inside the project workspace.
- Data: adds extraction records keyed by project ID and file ID.
- Dependencies: adds lightweight local document parsing packages for DOCX/PDF support.
