# Product Roadmap

## Phase 1: Project And Device Profile

- Complete the seven-section device profile wizard
- Add upload context file entry inside the new project page
- Improve extraction accuracy using AI and deterministic rules
- Allow users to edit extracted values before applying
- Add draft save and explicit project creation

## Phase 2: Workflow Chaining

- Step 1 reads device profile and uploaded extraction results
- Step 1 produces structured intended purpose confirmation
- Step 1 output can be edited, approved, and locked
- Step 2 reads approved Step 1 output
- Step 2 generates SOTA and clinical background structure

## Phase 3: CE MDR Classifier

- Implement rule-based MDR Annex VIII screening
- Capture candidate rules and excluded rules
- Select highest applicable class
- Add examples for Rule 6, Rule 9, Rule 11, and Rule 14
- Show information gaps when required fields are missing

## Phase 4: Evidence And Literature

- Add literature search strategy builder
- Add PICO / search question generation
- Add evidence table extraction
- Add competitor and equivalent device modules
- Add source traceability

## Phase 5: CER Drafting

- Generate CER section drafts from approved workflow outputs
- Add reviewer comments and approval state
- Export structured report content
- Preserve traceability from source document to generated claim

## Phase 6: Production Readiness

- Add authentication and project permissions
- Replace local JSON storage with a database
- Add audit trail
- Add version control for approved outputs
- Add secure file storage
- Add deployment pipeline
