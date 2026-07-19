# Clinical Evaluation Workflow

The platform is intended to support a structured EU MDR clinical evaluation workflow.

## Project And Device Profile

The first module creates a shared device profile. This profile provides the baseline context for all later CER steps.

Important fields include:

- Product name
- Common name or device type
- Regulatory region
- MDR classification
- Classification rule
- Manufacturer
- Intended purpose
- Indications
- Target population
- Intended users
- Use environment
- Operating principle
- Device description
- Components and accessories
- Market and certification status

Uploaded context files should be used to produce editable extraction candidates. The user should be able to accept extracted values, keep existing values, or manually edit the field.

## Step 1: Intended Purpose Confirmation

Step 1 should not be a blank text generator. It should read:

- Device profile fields
- Latest uploaded file extraction results
- User-edited and confirmed values

The output should be structured into:

- Intended purpose
- Indications
- Target population
- Intended users
- Use environment
- Operating principle
- Source summary
- Open questions

After review, Step 1 can be approved and locked.

## Step 2: SOTA And Clinical Background

Step 2 should depend on approved Step 1 output. It should inherit:

- Intended purpose
- Indications
- Target population
- Intended users
- Use environment
- Operating principle

The generated output should include:

- Disease or condition background
- Current treatment or diagnostic alternatives
- Technology baseline
- Clinical claims needing evidence
- Literature search question seeds
- Evidence gaps

## Workflow Rule

Downstream steps should consume only approved upstream outputs. Draft outputs can be edited, but approved outputs should be locked to preserve traceability.
