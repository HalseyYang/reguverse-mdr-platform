## Context

Current project tasks are partly seeded and partly simulated in the UI. The backend can return tasks and steps, but new projects created from a profile only get a minimal task record and do not receive the full clinical evaluation workflow or document package.

## Goals / Non-Goals

**Goals:**

- Add a reusable task template layer for local MVP workflows.
- Make Clinical Evaluation task creation idempotent.
- Initialize ten clinical evaluation steps and CER/CEP/DCR documents for a project.
- Replace the frontend Add Task simulation with a real picker and API call.

**Non-Goals:**

- Full configurable workflow builder is out of scope.
- Multi-user assignment, due dates, and approvals are out of scope.
- Actual DOCX generation is out of scope for this change.

## Decisions

- Keep task templates in code for now. This avoids introducing a database schema before the workflow shapes stabilize.
- Make Clinical Evaluation creation idempotent. Users can click Add Task safely without duplicating steps.
- Use existing JSON arrays (`tasks`, `steps`, `documents`) to persist initialized workflow records.

## Risks / Trade-offs

- Code-defined templates are less flexible than admin-configured templates. Mitigation: acceptable for MVP; migrate templates to DB later.
- Existing projects may have partial workflow records. Mitigation: initialization helpers fill missing steps/documents without duplicating existing records.

## Migration Plan

1. Add workflow helper functions in the backend.
2. Update project-from-profile creation to call the helper.
3. Add task creation endpoint.
4. Add frontend task picker and task list display.
5. Verify with integration tests, build, and browser smoke testing.
