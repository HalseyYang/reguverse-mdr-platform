# ReguVerse MDR Platform

ReguVerse MDR Platform is a web-based prototype for building an AI-assisted EU MDR clinical evaluation and regulatory workflow system. The product direction is a standalone browser platform, not a Microsoft Word taskpane plugin.

The current goal is to turn scattered regulatory knowledge, device profile inputs, uploaded context files, and clinical evaluation workflow steps into a structured, reviewable platform for EU MDR clinical evaluation work.

## Product Scope

The current prototype focuses on six core capabilities:

- Project and device profile workspace
- Context file upload and structured field extraction
- Step 1 intended purpose confirmation from device profile and uploaded extraction results
- Step 2 SOTA and clinical background generation from approved Step 1 output
- AI configuration panel for DeepSeek-compatible extraction and drafting
- AI Tools page with a CE MDR medical device classifier

## Core Principle

Each workflow step should read approved upstream outputs, uploaded evidence, and structured device profile fields. The system should then generate editable structured content, allow human review, and lock approved outputs before passing them into the next step.

The platform should work like a regulatory workbench rather than a static form library.

## Repository Map

```text
README.md

docs/
  system-architecture.md
  clinical-evaluation-workflow.md
  ce-mdr-classification-logic.md
  ai-extraction-and-deepseek.md
  product-roadmap.md
```

## Local Prototype Snapshot

The local prototype has been developed as a React/Vite frontend with an Express API backend.

Typical local service addresses:

```text
Frontend: http://127.0.0.1:5173/
API:      http://127.0.0.1:8787/api/health
```

The backend is intended to expose workflow APIs, upload and extraction APIs, AI configuration APIs, and classifier APIs.

Sensitive values such as API keys must stay in local `.env` files and must not be committed.

## Intended Users

- Medical device regulatory affairs teams
- Clinical evaluation report writers
- EU MDR consultants
- Quality, clinical, and product teams preparing CER documentation

## Important Disclaimer

This platform is intended to support regulatory analysis and drafting. It does not replace qualified regulatory judgment, notified body feedback, legal interpretation, clinical evaluation by competent professionals, or final manufacturer responsibility under Regulation (EU) 2017/745.
