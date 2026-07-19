## Why

The ReguVerse-style prototype needs a reliable project and device profile module before clinical evaluation workflows can produce credible MDR outputs. This module turns scattered project facts into structured, reviewable data that downstream steps can reuse for intended purpose, clinical scope, evaluation path, search strategy, and document generation.

## What Changes

- Add a standalone web module for creating, reviewing, editing, and saving a project/device profile.
- Model the profile as a seven-section workflow: device basics, scope, certification and market, company information, evaluation path, evaluation scope, and confirmation.
- Use Kranus Mictera as the initial sample profile with realistic EU MDR clinical evaluation context.
- Persist profile data through local backend APIs and return the profile with project detail data.
- Surface missing required fields, dirty state, review status, and a concise live summary.
- Ensure downstream clinical evaluation steps can consume the saved profile as structured source context.

## Capabilities

### New Capabilities

- `device-profile`: Covers the project/device profile workflow, profile data model, validation, persistence, review status, and downstream availability for clinical evaluation tasks.

### Modified Capabilities

- None.

## Impact

- Frontend: project workspace page, profile wizard UI, live summary, save/review states, and project selection behavior.
- Backend: project detail API, profile upsert API, local JSON database migration/seed data, and project metadata synchronization.
- Data: adds structured device profile records keyed by project ID, starting with Kranus Mictera.
- Workflow: clinical evaluation steps can use profile fields instead of relying on hard-coded or manually repeated context.
