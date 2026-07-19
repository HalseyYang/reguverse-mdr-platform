## Why

The prototype needs real task/workflow creation so a project can move beyond a static demo page. Clinical evaluation should initialize repeatable steps and document outputs from a task template instead of relying on hard-coded UI-only data.

## What Changes

- Add backend task templates and a `POST /api/projects/:projectId/tasks` endpoint.
- Initialize a full Clinical Evaluation workflow with 10 steps and CER/CEP/DCR documents.
- Ensure newly created projects from device profiles receive a usable clinical evaluation workflow.
- Replace the simulated Add Task button with a real task template picker in the project workspace.
- Display project tasks and initialized workflow state from backend data.

## Capabilities

### New Capabilities

- `task-workflows`: Covers task template creation, clinical evaluation workflow initialization, task list persistence, and document package creation.

### Modified Capabilities

- None.

## Impact

- Backend: task template helper functions, workflow initialization, task creation API, project creation defaults.
- Frontend: real Add Task interaction, task list panel, refresh after task creation.
- Data: new projects and task creation calls receive steps/documents rather than only placeholder task records.
