## 1. Existing Profile Foundation

- [x] 1.1 Add Kranus Mictera seeded profile data to the local backend seed.
- [x] 1.2 Return linked device profile data from project detail API.
- [x] 1.3 Add profile upsert API for saving edits by project ID.
- [x] 1.4 Synchronize project display metadata from saved profile basics and company fields.

## 2. Profile Editor UI

- [x] 2.1 Add seven-section profile schema with required-field metadata.
- [x] 2.2 Render editable section navigation, field controls, missing-field count, and live summary.
- [x] 2.3 Add save behavior with dirty state and project refresh after save.

## 3. Blank Project Creation

- [x] 3.1 Add an empty profile factory for create mode without reusing Kranus Mictera defaults.
- [x] 3.2 Add frontend state and navigation for starting/canceling create-profile mode.
- [x] 3.3 Reuse the profile wizard for create mode with create-specific action text and validation.
- [x] 3.4 Add backend endpoint to atomically create a project, linked profile, initial clinical evaluation task, and event from profile data.
- [x] 3.5 After creation, refresh project list, select the new project, and load the saved profile.

## 4. Validation and Workflow Context

- [x] 4.1 Add shared required-field calculation used by both save/create actions.
- [x] 4.2 Prevent project creation when required profile fields are missing.
- [x] 4.3 Add lightweight backend validation for create-from-profile required fields.
- [x] 4.4 Expose saved profile context clearly enough for downstream clinical workflow generation.

## 5. Verification

- [x] 5.1 Run frontend production build.
- [x] 5.2 Smoke test API health, Kranus Mictera project detail, profile save, and project creation.
- [x] 5.3 Verify the browser UI shows the profile module and create flow without layout breakage.
- [x] 5.4 Run OpenSpec validation for the change.
