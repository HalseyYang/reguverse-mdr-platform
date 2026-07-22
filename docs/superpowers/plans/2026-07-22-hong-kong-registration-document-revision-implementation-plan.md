# Hong Kong Registration Document Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a project-scoped Hong Kong MDACS document revision task to ReguVerse that accepts one source file and produces versioned Bioray-template DOCX drafts with tracked changes and comments.

**Architecture:** Keep React/Vite and Express, but isolate Hong Kong behavior in focused frontend and backend modules. Deliver in checkpoints: regulatory linkage, task workspace and extraction, chunked AI revision and DOCX generation, then Windows startup and end-to-end verification.

**Tech Stack:** React, Vite, Express, Node.js, multer, mammoth, pdf-parse, Tesseract.js, OOXML, DeepSeek V4 Flash/Pro, Node test runner, PowerShell and Windows Task Scheduler.

---

## Planned file structure

```text
src/features/hong-kong-registration/
  regulatory-options.js
  HongKongRegistrationTask.jsx
  hong-kong-registration.css
server/hong-kong-registration/
  contracts.js
  store.js
  extraction.js
  templates.js
  ai-revision.js
  docx-revision.js
  routes.js
scripts/windows/
  Start-ReguVerse.ps1
  Install-ReguVerseStartup.ps1
tests/hong-kong-*.test.mjs
```

`src/main.jsx` and `server.js` only mount these modules; new business logic stays outside the existing large files.

## Task 1: MDACS field linkage and automatic project task

**Files:**
- Create: `src/features/hong-kong-registration/regulatory-options.js`
- Modify: `src/main.jsx`
- Modify: `server.js`
- Test: `tests/hong-kong-regulatory-options.test.mjs`
- Test: `tests/hong-kong-project-task.test.mjs`

- [ ] **Step 1: Write the failing field-linkage test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { regulatoryRegionOptions, fieldConfigurationForRegulatoryRegion, recommendHongKongDeviceClass } from '../src/features/hong-kong-registration/regulatory-options.js';

test('Hong Kong changes classification fields', () => {
  assert.ok(regulatoryRegionOptions.includes('香港注册（MDACS）'));
  const config = fieldConfigurationForRegulatoryRegion('香港注册（MDACS）');
  assert.equal(config.classificationRuleLabel, '香港分类依据');
  assert.deepEqual(config.deviceClasses, ['Class II', 'Class III', 'Class IV']);
  assert.equal(recommendHongKongDeviceClass('RULE_2_NON_INVASIVE'), 'Class II');
});
```

- [ ] **Step 2: Run it and verify failure**

Run: `node --test tests/hong-kong-regulatory-options.test.mjs`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the regulatory contract**

```js
export const HONG_KONG_REGULATORY_REGION = '香港注册（MDACS）';
export const HONG_KONG_DEVICE_CLASSES = ['Class II', 'Class III', 'Class IV'];
export const hongKongClassificationBasisOptions = [
  { value: 'RULE_2_NON_INVASIVE', label: 'Rule 2 - Non-invasive medical devices', recommendedClass: 'Class II' },
  { value: 'RULE_5_INVASIVE', label: 'Rule 5 - Invasive medical devices', recommendedClass: 'Class II' },
  { value: 'RULE_6_SURGICALLY_INVASIVE_TRANSIENT', label: 'Rule 6 - Surgically invasive devices for transient use', recommendedClass: 'Class II' },
  { value: 'RULE_7_SURGICALLY_INVASIVE_SHORT_TERM', label: 'Rule 7 - Surgically invasive devices for short-term use', recommendedClass: 'Class III' },
  { value: 'RULE_8_IMPLANTABLE_LONG_TERM', label: 'Rule 8 - Implantable and long-term surgically invasive devices', recommendedClass: 'Class IV' },
  { value: 'RULE_9_ACTIVE_THERAPEUTIC', label: 'Rule 9 - Active therapeutic medical devices', recommendedClass: 'Class II' },
  { value: 'RULE_10_ACTIVE_DIAGNOSTIC', label: 'Rule 10 - Active diagnostic medical devices', recommendedClass: 'Class II' },
  { value: 'RULE_12_OTHER_ACTIVE', label: 'Rule 12 - Other active medical devices', recommendedClass: 'Class II' }
];
```

The form uses region-specific labels/options. Selecting a basis recommends a class but keeps the class editable; a mismatch shows a warning and requires a reason before save.

- [ ] **Step 4: Write the failing task-creation test**

```js
test('MDACS project creation creates the Hong Kong revision task', async () => {
  const result = await createProjectFromProfileForTest(mdacsProfile());
  assert.deepEqual(result.tasks.map((task) => task.title), ['香港注册文件修订']);
});
```

- [ ] **Step 5: Implement conditional task creation**

Add template identifier `hong-kong-document-revision`. `/api/projects/from-profile` initializes that task when `profile.basics.regulation === '香港注册（MDACS）'`; the existing Clinical Evaluation path remains unchanged for EU MDR.

- [ ] **Step 6: Verify and commit**

Run: `node --test tests/hong-kong-regulatory-options.test.mjs tests/hong-kong-project-task.test.mjs`  
Expected: PASS.

```powershell
git add src/features/hong-kong-registration/regulatory-options.js src/main.jsx server.js tests/hong-kong-regulatory-options.test.mjs tests/hong-kong-project-task.test.mjs
git commit -m "feat: add MDACS project linkage"
```

## Task 2: Six-stage workspace, upload, extraction and template confirmation

**Files:**
- Create: `src/features/hong-kong-registration/HongKongRegistrationTask.jsx`
- Create: `src/features/hong-kong-registration/hong-kong-registration.css`
- Create: `server/hong-kong-registration/contracts.js`
- Create: `server/hong-kong-registration/store.js`
- Create: `server/hong-kong-registration/extraction.js`
- Create: `server/hong-kong-registration/templates.js`
- Create: `server/hong-kong-registration/routes.js`
- Modify: `src/main.jsx`
- Modify: `server.js`
- Modify: `package.json`
- Test: `tests/hong-kong-extraction.test.mjs`
- Test: `tests/hong-kong-workflow.test.mjs`

- [ ] **Step 1: Write failing workflow and extractor tests**

```js
test('the task exposes the approved stages', () => {
  assert.deepEqual(HONG_KONG_REVISION_STAGES.map((stage) => stage.label), [
    '上传文件', '提取内容', '确认文件类型与 Bioray 模板',
    '香港要求审查与修订', '待确认项', 'DOCX 版本与下载'
  ]);
});

test('supported files select an extractor and XLSX does not', () => {
  for (const name of ['report.docx', 'report.pdf', 'scan.png', 'scan.jpg']) assert.ok(selectExtractor(name));
  assert.equal(selectExtractor('checklist.xlsx'), null);
});

test('third-party evidence is review only', () => {
  assert.equal(classifyProcessingMode({ documentType: 'ISO 13485 certificate' }), 'review_only');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/hong-kong-extraction.test.mjs tests/hong-kong-workflow.test.mjs`  
Expected: FAIL because the feature modules do not exist.

- [ ] **Step 3: Implement contracts and atomic storage**

Define statuses `awaiting_upload`, `extracting_content`, `awaiting_document_type_confirmation`, `revising_sections`, `awaiting_user_confirmation`, `ready_for_formal_version`, `completed`, `processing_failed`. Persist under `data/hong_kong_registration/<projectId>/` with separate source, extracted content, drafts, finals and task records. Write JSON via temporary file plus rename.

- [ ] **Step 4: Implement bounded upload and extraction**

Use a consistent 25 MiB `multer` limit and JSON error `{ code: 'file_too_large', maximumByteLength }`. DOCX uses mammoth and OOXML structure reads; text PDF uses `pdf-parse`; scanned PDF/images use Tesseract.js with persisted page progress. Return distinct codes for unsupported, encrypted, damaged and signature-mismatched files.

- [ ] **Step 5: Implement template registry and confirmation**

Register stable identifiers for MDS-01, MDS-02, risk management report, clinical evaluation report and essential principles checklist using the approved source directory. Unknown modifiable types return `new_template_requires_user_approval`; evidence returns `review_only`. Classification returns `recommendedDocumentType`, `gn02ItemCode`, `templateIdentifier`, `reasoningSummary`; only a user-confirmation POST advances the task.

- [ ] **Step 6: Enforce project and file boundaries**

Every route resolves files from a stored project record rather than a caller-supplied path, rejects directory traversal, and records actor role/action fields. Until authentication is enabled, the local actor is explicitly stored as `project_owner`; the contracts retain `project_owner`, `regulatory_review_approver`, `document_contributor`, and `read_only_viewer` for later enforcement. Logs exclude document text, secrets and customer filenames.

- [ ] **Step 7: Implement and mount the task UI**

Render one file, six stages, current stage, suggested type, GN-02 item, template, progress, version, open-item count, latest download and history. Mount project-scoped API routes under `/api/projects/:projectId/hong-kong-registration`.

- [ ] **Step 8: Verify and commit**

Run: `npm test` then `npm run build`  
Expected: existing and new tests pass; build exits 0.

```powershell
git add src/features/hong-kong-registration server/hong-kong-registration src/main.jsx server.js package.json package-lock.json tests/hong-kong-extraction.test.mjs tests/hong-kong-workflow.test.mjs
git commit -m "feat: add Hong Kong revision workspace"
```

## Task 3: Chunked AI revision, tracked DOCX and version history

**Files:**
- Create: `server/hong-kong-registration/ai-revision.js`
- Create: `server/hong-kong-registration/docx-revision.js`
- Modify: `server/hong-kong-registration/routes.js`
- Modify: `server/hong-kong-registration/store.js`
- Modify: `src/features/hong-kong-registration/HongKongRegistrationTask.jsx`
- Modify: `.env.example`
- Test: `tests/hong-kong-ai-revision.test.mjs`
- Test: `tests/hong-kong-docx-revision.test.mjs`

- [ ] **Step 1: Write failing model and source-safety tests**

```js
test('classification uses Flash and revision uses Pro', async () => {
  const calls = [];
  await classifyDocumentType(input, fakeFetch(calls));
  await reviseSection(sectionInput, fakeFetch(calls));
  assert.equal(calls[0].model, 'deepseek-v4-flash');
  assert.equal(calls[1].model, 'deepseek-v4-pro');
});

test('unsupported facts become placeholders', () => {
  const checked = validateRevisionSources(revisionWithInventedFact(), sourceIndex());
  assert.match(checked.revisedText, /\[TO BE PROVIDED:/);
});
```

- [ ] **Step 2: Write failing OOXML tests**

```js
test('draft has Bioray tracked changes and comments', async () => {
  const xml = await inspectDocxPackage(await generateRevisionDocx(fixtureRevision()));
  assert.match(xml.documentXml, /<w:ins[^>]+w:author="Bioray"/);
  assert.match(xml.documentXml, /<w:del[^>]+w:author="Bioray"/);
  assert.match(xml.commentsXml, /w:author="Bioray"/);
  assert.match(xml.visibleText, /DRAFT_v0\.1/);
});
```

- [ ] **Step 3: Run and verify failure**

Run: `node --test tests/hong-kong-ai-revision.test.mjs tests/hong-kong-docx-revision.test.mjs`  
Expected: FAIL because AI and DOCX modules do not exist.

- [ ] **Step 4: Implement model routing and resumable sections**

Read `AI_PROFILE_MODEL=deepseek-v4-flash` and `AI_REVISION_MODEL=deepseek-v4-pro`. Flash classifies; Pro revises one section per structured request. Persist completed section identifiers, current section, attempt token and heartbeat. A retry keeps completed sections and is idempotent for the same source fingerprint and template.

- [ ] **Step 5: Implement source validation and open items**

Every added fact must reference current source text or confirmed profile data. Unsupported additions become `[TO BE PROVIDED: ...]` and create one open item. The UI renders exactly one open item using `场景 → 冲突与问题 → 方案`.

- [ ] **Step 6: Implement OOXML and versions**

Generate real `<w:ins>` and `<w:del>` with author `Bioray`; add `comments.xml`, relationships and content types. Regulation comments contain only the regulation document name. Drafts start `DRAFT_v0.1`, increment only after substantive confirmation, and retain history. Generate `v1.0` only when open-item count and unresolved placeholders are zero; a later formal change starts `DRAFT_v1.1`.

- [ ] **Step 7: Verify and commit**

Run: `node --test tests/hong-kong-ai-revision.test.mjs tests/hong-kong-docx-revision.test.mjs` then `npm test`  
Expected: package assertions and full suite pass without real network calls.

```powershell
git add server/hong-kong-registration src/features/hong-kong-registration/HongKongRegistrationTask.jsx .env.example tests/hong-kong-ai-revision.test.mjs tests/hong-kong-docx-revision.test.mjs
git commit -m "feat: generate reviewable MDACS DOCX versions"
```

## Task 4: Windows local persistence and end-to-end acceptance

**Files:**
- Create: `scripts/windows/Start-ReguVerse.ps1`
- Create: `scripts/windows/Install-ReguVerseStartup.ps1`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `tests/hong-kong-workflow.test.mjs`

- [ ] **Step 1: Implement the port-aware launcher**

Resolve the repository directory, test ports 5173 and 8787, start only missing services in hidden windows, wait for API health and the Vite page, then open `http://localhost:5173/`. Logs contain timestamps and service state only.

- [ ] **Step 2: Implement per-user installation**

Register one Task Scheduler task triggered at user logon and create one desktop `打开 ReguVerse.lnk`. Re-running the installer updates the same task and shortcut.

- [ ] **Step 3: Add the end-to-end test**

```js
test('a synthetic risk report reaches formal DOCX', async () => {
  const project = await createMdacsProject();
  const task = await uploadSyntheticRiskReport(project.id);
  await confirmRecommendedType(task.id, 'risk_management_report');
  const draft = await completeRevisionWithFakeAi(task.id);
  assert.equal(draft.version, 'DRAFT_v0.1');
  await resolveEveryOpenItem(task.id);
  const formal = await generateFormalVersion(task.id);
  assert.equal(formal.version, 'v1.0');
  assert.equal(formal.unresolvedPlaceholderCount, 0);
});
```

- [ ] **Step 4: Run final verification**

Run: `npm test`  
Expected: all existing and new tests pass.

Run: `npm run build`  
Expected: build exits 0.

Run the launcher twice.  
Expected: one listener per port, frontend 200, API health 200, browser opens `http://localhost:5173/`.

- [ ] **Step 5: Commit**

```powershell
git add scripts/windows package.json README.md tests/hong-kong-workflow.test.mjs
git commit -m "feat: complete local MDACS revision workflow"
```

## Checkpoints

1. Task 1: preview MDACS field linkage and automatic project task.
2. Task 2: preview the project task shell and confirm one synthetic source file/template.
3. Task 3: download `DRAFT_v0.1.docx` and inspect Bioray changes/comments.
4. Task 4: verify Windows login startup and desktop opening.

The existing untracked `pnpm-lock.yaml` remains untouched unless the user separately chooses the authoritative lockfile.
