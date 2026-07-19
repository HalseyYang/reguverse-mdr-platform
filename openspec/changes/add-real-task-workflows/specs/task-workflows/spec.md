## ADDED Requirements

### Requirement: Task template creation
The system SHALL allow users to create project tasks from supported task templates.

#### Scenario: User creates a clinical evaluation task
- **WHEN** a user chooses the Clinical Evaluation task template for a project
- **THEN** the backend creates or returns the project task
- **AND** initializes the associated workflow steps and document outputs

#### Scenario: Duplicate task creation
- **WHEN** a user chooses a task template that already exists for the project
- **THEN** the backend returns the existing task instead of creating duplicate workflow steps

### Requirement: Clinical evaluation workflow initialization
The system SHALL initialize Clinical Evaluation with ten standard workflow steps and CER/CEP/DCR document outputs.

#### Scenario: Workflow is initialized
- **WHEN** a Clinical Evaluation task is created for a project
- **THEN** the project detail response includes ten clinical evaluation steps
- **AND** the project detail response includes CER, CEP, and DCR document records

### Requirement: New project workflow defaults
The system SHALL create a usable Clinical Evaluation workflow when a project is created from a completed device profile.

#### Scenario: Project created from profile
- **WHEN** a user creates a project from a device profile
- **THEN** the new project includes a Clinical Evaluation task, ten workflow steps, and CER/CEP/DCR documents

### Requirement: Frontend task picker
The system SHALL expose real task template creation from the project workspace.

#### Scenario: User adds task from UI
- **WHEN** a user clicks Add Task and chooses a template
- **THEN** the frontend calls the backend task creation API
- **AND** refreshes project detail to show the created task, workflow, and documents
