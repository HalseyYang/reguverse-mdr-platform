## ADDED Requirements

### Requirement: Seven-section device profile workflow
The system SHALL present a project/device profile workflow with seven sections: device basics, scope, certification and market, company information, evaluation path, evaluation scope, and confirmation.

#### Scenario: User navigates profile sections
- **WHEN** a user opens the project workspace for a project
- **THEN** the system displays the seven profile sections in order
- **AND** the user can switch between sections without losing unsaved draft values

#### Scenario: Required field visibility
- **WHEN** a profile section contains required fields
- **THEN** the system marks those fields as required
- **AND** the system shows how many required fields are still missing

### Requirement: Kranus Mictera seeded sample
The system SHALL include Kranus Mictera as the default EU MDR sample profile for demonstrating the profile workflow and clinical evaluation context.

#### Scenario: Sample project loads profile
- **WHEN** a user opens the EU MDR CER Kranus Mictera project
- **THEN** the system returns a device profile containing Kranus Mictera product, manufacturer, intended use, indication, evaluation path, and search scope data

### Requirement: Profile persistence
The system SHALL persist profile edits for a project through the local backend and return the saved profile in subsequent project detail responses.

#### Scenario: User saves edited profile
- **WHEN** a user edits any profile field and saves
- **THEN** the backend stores the profile keyed by project ID
- **AND** subsequent project detail requests include the saved profile

#### Scenario: Project metadata sync
- **WHEN** a profile is saved with updated product name, regulation, device class, or manufacturer
- **THEN** the project list metadata reflects those updated values

### Requirement: Profile review state
The system SHALL expose draft/review status and unsaved-change state so users can distinguish editable working data from reviewed project context.

#### Scenario: Draft has unsaved changes
- **WHEN** a user changes a profile field after the last saved version
- **THEN** the system displays an unsaved-change state
- **AND** the user can save the current draft

#### Scenario: Profile status is reviewable
- **WHEN** a profile contains confirmation status data
- **THEN** the system displays the status in the profile module summary

### Requirement: Downstream workflow context
The system SHALL make saved profile fields available as structured context for downstream clinical evaluation workflows.

#### Scenario: Clinical task reads profile context
- **WHEN** a clinical evaluation step needs product scope or evaluation path context
- **THEN** the system can use the saved profile fields instead of hard-coded project assumptions

### Requirement: Blank project creation from profile
The system SHALL allow creating a new project from an empty seven-section profile workflow.

#### Scenario: User creates project from profile
- **WHEN** a user completes the required fields in a blank profile and creates the project
- **THEN** the backend creates a project record, a linked device profile, and an initial clinical evaluation task
- **AND** the frontend opens the new project workspace with the saved profile loaded

#### Scenario: Missing required creation fields
- **WHEN** a user attempts to create a project while required profile fields are missing
- **THEN** the system prevents creation
- **AND** the system identifies the missing required fields
