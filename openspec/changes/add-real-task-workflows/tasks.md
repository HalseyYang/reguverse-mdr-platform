## 1. Backend Workflow Engine

- [x] 1.1 Add Clinical Evaluation step and document template helpers.
- [x] 1.2 Add idempotent workflow initialization for a project.
- [x] 1.3 Update profile-based project creation to initialize the full workflow.
- [x] 1.4 Add `POST /api/projects/:projectId/tasks` for task template creation.

## 2. Frontend Task UX

- [x] 2.1 Replace Add Task notification with a task template picker.
- [x] 2.2 Call the backend task creation API from the picker.
- [x] 2.3 Display backend project tasks in the project workspace.
- [x] 2.4 Refresh workflow and documents after task creation.

## 3. Verification

- [x] 3.1 Add integration test for task creation and workflow initialization.
- [x] 3.2 Run `npm test`.
- [x] 3.3 Run frontend production build.
- [x] 3.4 Run OpenSpec validation.
- [x] 3.5 Browser-smoke Add Task flow.
