## ADDED Requirements

### Requirement: Extract profile candidates from uploaded files
The system SHALL allow users to run profile extraction on an uploaded context file and return structured candidate values for project/device profile fields.

#### Scenario: Extraction returns candidates
- **WHEN** a user runs extraction on a supported uploaded file
- **THEN** the backend returns candidate profile fields with section ID, field key, label, value, confidence, and source snippet
- **AND** the existing project profile is not modified automatically

#### Scenario: Unsupported or unreadable file
- **WHEN** a user runs extraction on an unsupported or unreadable file
- **THEN** the backend returns a clear error or an extraction record with no candidates
- **AND** the existing project profile remains unchanged

### Requirement: Local document text extraction
The system SHALL extract text locally from supported context files before mapping document content to profile fields.

#### Scenario: Plain text extraction
- **WHEN** an uploaded file is plain text, Markdown, JSON, or CSV-like text
- **THEN** the system reads the file contents as text for extraction

#### Scenario: Office and PDF extraction
- **WHEN** an uploaded file is DOCX or PDF and parser support is available
- **THEN** the system extracts readable text locally
- **AND** the system stores a preview of the extracted text with the extraction record

### Requirement: Candidate review before applying
The system SHALL require user review before extracted candidate values are applied to the device profile draft.

#### Scenario: User reviews candidates
- **WHEN** extraction returns candidate values
- **THEN** the frontend displays each suggestion with current value, suggested value, confidence, and source snippet
- **AND** the user can apply selected suggestions to the profile draft

#### Scenario: User ignores candidates
- **WHEN** a user does not apply extracted suggestions
- **THEN** the saved profile remains unchanged

### Requirement: Pre-project profile extraction
The system SHALL allow users to upload a document on the new project/device profile page and extract profile candidates before a project record exists.

#### Scenario: Create page upload extraction
- **WHEN** a user uploads a supported file from the new project/device profile page
- **THEN** the backend returns preview profile candidates without requiring a project ID
- **AND** the frontend displays those candidates in the new project profile draft for review and application

### Requirement: Extraction records
The system SHALL store extraction records linked to project ID and file ID for traceability.

#### Scenario: Extraction record is saved
- **WHEN** extraction completes
- **THEN** the system stores an extraction record containing file ID, project ID, candidate list, text preview, status, and creation timestamp

#### Scenario: Project detail includes latest extractions
- **WHEN** the frontend loads project detail
- **THEN** the response includes extraction records for the selected project
