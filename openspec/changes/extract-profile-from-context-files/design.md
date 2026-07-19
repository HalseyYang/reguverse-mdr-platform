## Context

The prototype already stores uploaded context files and maintains a structured project/device profile. The missing link is extracting useful content from uploaded IFU, labeling, clinical summary, and product-description documents, then presenting that content as reviewable profile-field suggestions.

This change remains local-first. It does not introduce remote AI calls. The first implementation uses deterministic text extraction and rule-based mapping so the workflow is demonstrable and privacy-preserving.

## Goals / Non-Goals

**Goals:**

- Extract text locally from uploaded text-like, DOCX, and PDF files where supported.
- Map extracted text into candidate profile fields for the existing seven-section profile schema.
- Store extraction records for project/file traceability.
- Show candidates in the project workspace with current value, suggested value, confidence, and source snippet.
- Allow users to apply selected candidates to the profile draft, then save through the existing profile API.

**Non-Goals:**

- OCR for scanned PDFs is out of scope for this step.
- LLM semantic extraction is out of scope; this version uses local parsing and rules.
- Automatic overwriting of saved profile fields is out of scope.
- Full evidence citation management is out of scope beyond short source snippets.

## Decisions

1. Add extraction as a separate file action.

   Alternative considered: run extraction automatically on every upload. A separate action gives users control, avoids surprising processing delays, and makes parser failures easier to understand.

2. Store candidates, not applied changes.

   Alternative considered: write extracted values directly to the profile. Candidate review prevents low-confidence or wrong document text from contaminating downstream CER workflows.

3. Use lightweight local parsers and fallback text reading.

   Alternative considered: require AI/RAG extraction immediately. Local parsing makes the prototype usable without model configuration and keeps sensitive client documents local.

4. Keep mapping rules close to the profile schema.

   Alternative considered: create an unrelated extraction schema. Mapping directly to `{ sectionId, fieldKey }` lets the frontend apply suggestions to the existing profile draft with minimal translation.

## Risks / Trade-offs

- Rule-based extraction can miss fields or choose incomplete values. Mitigation: display confidence and source snippets, require user review, and keep current values visible.
- PDF parsing may fail on scanned or image-heavy PDFs. Mitigation: return a clear unsupported/no-text state and later add OCR as a separate capability.
- Adding parser dependencies increases install size. Mitigation: keep dependencies limited to DOCX/PDF parsing and continue supporting plain text without them.
- Suggestions may duplicate already-correct profile values. Mitigation: frontend compares current and suggested values before applying.

## Migration Plan

1. Add `profileExtractions` to local JSON database migration defaults.
2. Add parser helper functions and a rule-based profile candidate mapper.
3. Add `POST /api/projects/:projectId/files/:fileId/extract-profile`.
4. Include extraction records in project detail responses.
5. Add frontend extraction buttons and candidate review/apply UI.
6. Verify with backend tests, frontend build, API smoke tests, and browser interaction checks.

## Open Questions

- Which document types should receive specialized extraction templates first: IFU, clinical study summary, or risk management file?
- Should applied suggestions create an audit trail separate from profile save events?
- When AI extraction is added later, should it run as an optional second pass after local rules?
