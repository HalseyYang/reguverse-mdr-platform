## Context

The current prototype is a standalone React/Vite web app with a local Express API and JSON-backed persistence. The project workspace already contains a Kranus Mictera sample project, clinical evaluation workflow content, and a first-pass profile editor. The next step is to make the project/device profile a stable system capability rather than a static UI block.

The profile is the upstream context for EU MDR clinical evaluation work. It must be structured enough to drive intended-use confirmation, SOTA scope, literature search strategy, evidence route selection, and document assembly.

## Goals / Non-Goals

**Goals:**

- Define a seven-section device profile model that can support both sample editing and blank project creation.
- Persist profile data independently from project list metadata while synchronizing key display fields.
- Keep the UI usable as a real web module: section navigation, validation feedback, save/create actions, and live summary.
- Seed Kranus Mictera as the first complete example so the module remains demonstrable without external setup.
- Provide a clear path for downstream clinical evaluation steps to consume profile fields.

**Non-Goals:**

- Full authentication, multi-user permissioning, and audit signatures are out of scope for this change.
- External regulatory database integration is out of scope; sample data remains local.
- Complete CER generation logic is out of scope, except for exposing profile context that CER workflows can later consume.
- Formal medical or regulatory validation of Kranus Mictera facts is out of scope for the prototype.

## Decisions

1. Keep profile data as a project-linked JSON record.

   Alternative considered: flatten all profile fields into the project record. Keeping `deviceProfiles` separate preserves a concise project list while allowing profile sections to grow without overloading project metadata.

2. Use a shared section schema for edit and create modes.

   Alternative considered: build separate create and edit forms. A shared schema reduces drift and ensures required-field rules, labels, input types, and summary behavior stay consistent across both modes.

3. Add a project-from-profile backend path for blank creation.

   Alternative considered: call `POST /api/projects` and then `PUT /api/projects/:id/profile` from the frontend. A single endpoint is cleaner for creation because it can atomically create the project, linked profile, initial clinical task, and event.

4. Treat profile confirmation as workflow status, not a hard approval gate.

   Alternative considered: block all downstream clinical steps until confirmation is complete. For the prototype, downstream steps can still display while clearly showing draft/review status; this keeps exploration fluid while preserving traceability.

5. Keep validation lightweight on the backend.

   Alternative considered: introduce a schema validation library immediately. For this local MVP, server-side checks for required profile sections and key fields are enough. A formal schema validator can be added when API contracts stabilize.

## Risks / Trade-offs

- Incomplete regulatory data can look authoritative in the prototype. Mitigation: label confirmation requirements clearly and keep Kranus Mictera as sample/demo context.
- Shared form schema may become large as more product types are added. Mitigation: keep section definitions centralized and split into modules when growth makes the file hard to maintain.
- JSON-file persistence is not concurrency-safe. Mitigation: acceptable for local prototype; migrate to a database before multi-user use.
- Creating projects from profile introduces more state transitions in the frontend. Mitigation: keep create mode separate from selected project editing and reload project data after creation.

## Migration Plan

1. Preserve existing `deviceProfiles` records in `data/db.json`.
2. Add migration defaults in `readDb()` for missing arrays and the Kranus Mictera profile.
3. Add a create-from-profile endpoint without removing the existing generic `POST /api/projects`.
4. Update frontend create flow to use the shared profile schema.
5. Verify with build, API health, project detail fetch, profile save, and project creation smoke tests.

Rollback is simple for the prototype: remove the create-from-profile endpoint and hide the create-mode UI while keeping existing edit-mode profile data intact.

## Open Questions

- Which profile fields should become locked after formal review in a later version?
- Should evidence route selection automatically activate or hide downstream workflow steps, or only annotate them?
- Should required-field rules vary by regulation region, device class, or evaluation path in the next module?
