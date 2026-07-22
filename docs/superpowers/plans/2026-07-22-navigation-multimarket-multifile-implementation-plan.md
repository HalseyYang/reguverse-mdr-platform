# Navigation, Multi-market Profiles and Multi-file MDACS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the embedded project list with navigable project management, provide market-specific project profiles for EU MDR, NMPA, FDA and Hong Kong MDACS, and support independent multi-file Hong Kong document revision records.

**Architecture:** Move profile definitions and validation into market configuration modules, while keeping `src/main.jsx` as the composition layer. Add focused project lifecycle and Hong Kong task services behind Express routes. Deliver three independently previewable checkpoints: navigation/lifecycle, dynamic profiles, then multi-file task shell and storage.

**Tech Stack:** React, Vite, Express, Node.js test runner, JSON atomic storage, multer, mammoth, pdf-parse, browser OCR, DOCX/OOXML.

---

## Planned file map

```text
src/features/project-management/
  project-navigation.jsx          # expandable navigation and project pages
  project-management.css          # project list, recycle bin and dialogs
src/features/device-profile/
  market-profile-configurations.js # four market step and field contracts
  profile-navigation.js            # step movement and validation helpers
src/features/hong-kong-registration/
  HongKongRegistrationTask.jsx     # multi-file task workspace
  hong-kong-registration.css       # file cards and overall progress
server/project-lifecycle.js        # soft delete, restore and purge
server/market-profile-validation.js # server-side market validation
server/hong-kong-registration/
  contracts.js                     # stages, states and file processing modes
  store.js                         # project-isolated atomic persistence
  routes.js                        # project-scoped upload/task endpoints
tests/project-lifecycle.test.mjs
tests/market-profile-configurations.test.mjs
tests/profile-navigation.test.mjs
tests/hong-kong-multifile-workflow.test.mjs
```

## Task 1: Project navigation and 30-day recycle bin

**Files:**
- Create: `src/features/project-management/project-navigation.jsx`
- Create: `src/features/project-management/project-management.css`
- Create: `server/project-lifecycle.js`
- Modify: `src/main.jsx`
- Modify: `server.js`
- Test: `tests/project-lifecycle.test.mjs`

- [ ] **Step 1: Write the failing lifecycle test**

```js
test('soft delete hides a project and restore recovers all records', async () => {
  const deleted = softDeleteProject(fixtureDb(), 'project-hk', new Date('2026-07-22T00:00:00Z'));
  assert.equal(deleted.projects.find((item) => item.id === 'project-hk').deletedAt, '2026-07-22T00:00:00.000Z');
  assert.deepEqual(listActiveProjects(deleted).map((item) => item.id), []);
  assert.deepEqual(listDeletedProjects(deleted).map((item) => item.id), ['project-hk']);
  assert.equal(restoreProject(deleted, 'project-hk').projects[0].deletedAt, null);
});
```

- [ ] **Step 2: Run `node --test tests/project-lifecycle.test.mjs` and verify it fails because the lifecycle module is missing.**

- [ ] **Step 3: Implement explicit lifecycle functions**

```js
export function softDeleteProject(db, projectId, now = new Date()) {
  return updateProjectDeletion(db, projectId, now.toISOString());
}
export function restoreProject(db, projectId) {
  return updateProjectDeletion(db, projectId, null);
}
export function purgeExpiredProjects(db, now = new Date()) {
  const expiredIds = db.projects.filter((project) => project.deletedAt && Date.parse(project.deletedAt) + 30 * 86400000 <= now.getTime()).map((project) => project.id);
  return removeProjectGraph(db, expiredIds);
}
```

- [ ] **Step 4: Add `DELETE /api/projects/:projectId`, `POST /api/projects/:projectId/restore`, `DELETE /api/projects/:projectId/permanent`, and `GET /api/projects/deleted`; return project name and related file count before confirmation.**

- [ ] **Step 5: Replace the white project sidebar with an expandable “项目与任务” navigation containing “项目管理” and “新建项目”; add search/filter, recycle-bin view, restore and permanent-delete dialogs; put “删除项目” last in the project-detail action group.**

- [ ] **Step 6: Run `node --test tests/project-lifecycle.test.mjs`, full `pnpm test`, and `pnpm run build`; expect all to pass, then commit `feat: add project management and recycle bin`.**

## Task 2: Four market profile contracts

**Files:**
- Create: `src/features/device-profile/market-profile-configurations.js`
- Create: `server/market-profile-validation.js`
- Modify: `src/features/hong-kong-registration/regulatory-options.js`
- Modify: `src/main.jsx`
- Modify: `server.js`
- Test: `tests/market-profile-configurations.test.mjs`

- [ ] **Step 1: Write the failing contract test**

```js
test('every supported market has an independent step contract', () => {
  assert.deepEqual(SUPPORTED_REGULATORY_REGIONS, ['EU MDR', 'NMPA', 'FDA', '香港注册（MDACS）']);
  assert.equal(profileFor('香港注册（MDACS）').steps.length, 6);
  assert.equal(profileFor('EU MDR').steps.length, 7);
  assert.equal(profileFor('NMPA').steps.length, 7);
  assert.equal(profileFor('FDA').steps.length, 7);
  assert.equal(SUPPORTED_REGULATORY_REGIONS.includes('UK MDR'), false);
});
```

- [ ] **Step 2: Run `node --test tests/market-profile-configurations.test.mjs`; expect module-not-found failure.**

- [ ] **Step 3: Implement `profileFor(regulatoryRegion, profile)` returning `{ steps, requiredFields, taskTemplateIdentifier }`; define EU economic operators, NMPA domestic/imported branches, FDA product-code/path fields, and the confirmed six-step Hong Kong contract.**

```js
export const SUPPORTED_REGULATORY_REGIONS = ['EU MDR', 'NMPA', 'FDA', '香港注册（MDACS）'];
export function profileFor(region, profile = {}) {
  const configuration = MARKET_PROFILE_CONFIGURATIONS[region];
  if (!configuration) throw new Error('Unsupported regulatory region');
  return configuration.resolve(profile);
}
```

- [ ] **Step 4: Add server validation that accepts only fields required by the selected market; reject stale cross-market fields and return `{ code: 'market_profile_validation_failed', missing, incompatible }`.**

- [ ] **Step 5: On region change, calculate incompatible populated fields and show their labels before clearing them; never silently discard values.**

- [ ] **Step 6: Preserve EU project creation, route NMPA/FDA to their configured task templates, and route Hong Kong only to `hong-kong-document-revision`.**

- [ ] **Step 7: Run focused tests, full tests and build; commit `feat: add market-specific project profiles`.**

## Task 3: Saved wizard navigation

**Files:**
- Create: `src/features/device-profile/profile-navigation.js`
- Modify: `src/main.jsx`
- Test: `tests/profile-navigation.test.mjs`

- [ ] **Step 1: Write the failing navigation test**

```js
test('next saves and advances only when the current step is valid', () => {
  assert.deepEqual(nextStep({ steps: ['basics', 'scope'], activeStep: 'basics', missingByStep: { basics: [] } }), { save: true, nextStep: 'scope' });
  assert.deepEqual(nextStep({ steps: ['basics', 'scope'], activeStep: 'basics', missingByStep: { basics: ['productName'] } }), { save: false, nextStep: 'basics', missing: ['productName'] });
});
```

- [ ] **Step 2: Run the test and verify the module-not-found failure.**

- [ ] **Step 3: Implement `previousStep`, `nextStep`, `isFinalStep` and visited-step guards; keep these helpers UI-independent.**

- [ ] **Step 4: Add fixed footer actions “上一步 / 保存草稿 / 下一步”; make next save before advancing, show saved timestamp, and replace next with “创建项目” on the final step.**

- [ ] **Step 5: Run focused tests, full tests and build; browser-test EU and Hong Kong step counts; commit `feat: add saved profile step navigation`.**

## Task 4: Multi-file Hong Kong task contracts and storage

**Files:**
- Create: `server/hong-kong-registration/contracts.js`
- Create: `server/hong-kong-registration/store.js`
- Create: `server/hong-kong-registration/routes.js`
- Modify: `server.js`
- Test: `tests/hong-kong-multifile-workflow.test.mjs`

- [ ] **Step 1: Write the failing multi-file test**

```js
test('three files progress independently inside one task', async () => {
  const task = createTaskRecord('project-hk');
  const withFiles = addFiles(task, [modifiableDocx(), secondTemplatePdf(), thirdPartyCertificate()]);
  assert.equal(withFiles.files.length, 3);
  assert.equal(withFiles.files[2].processingMode, 'review_only');
  const failed = markFileFailed(withFiles, withFiles.files[0].id, 'damaged_file');
  assert.equal(failed.files[1].status, 'awaiting_type_confirmation');
});
```

- [ ] **Step 2: Run the test and verify failure because contracts/storage do not exist.**

- [ ] **Step 3: Define the six stages, eight file statuses, processing modes `revise`, `review_only`, `translation_draft`, and stable per-file identifiers.**

- [ ] **Step 4: Persist under `data/hong_kong_registration/<projectId>/` with `task.json`, `sources/`, `extracted/`, `drafts/`, `finals/`; write JSON through a same-directory temporary file and atomic rename.**

- [ ] **Step 5: Mount project-scoped list/upload/retry/delete/type-confirmation routes; accept multiple files but enforce a 25 MiB per-file limit and return distinct Chinese-facing error codes for unsupported, encrypted, damaged, mismatch and oversized files.**

- [ ] **Step 6: Run focused tests, full tests and build; commit `feat: add multi-file MDACS task storage`.**

## Task 5: Multi-file task UI and extraction checkpoint

**Files:**
- Create: `src/features/hong-kong-registration/HongKongRegistrationTask.jsx`
- Create: `src/features/hong-kong-registration/hong-kong-registration.css`
- Create: `server/hong-kong-registration/extraction.js`
- Create: `server/hong-kong-registration/templates.js`
- Modify: `src/main.jsx`
- Modify: `server/hong-kong-registration/routes.js`
- Test: `tests/hong-kong-extraction.test.mjs`

- [ ] **Step 1: Test extractor selection for DOCX, text/scanned PDF, PNG/JPG and rejection of XLSX; test template matches and third-party review-only classification.**
- [ ] **Step 2: Run the focused test and verify failure.**
- [ ] **Step 3: Implement content-signature checks, DOCX extraction, text-PDF extraction and browser-OCR page contracts; persist per-page progress without logging document text or customer filenames.**
- [ ] **Step 4: Register MDS-01, MDS-02, risk report, CER and essential-principles templates; unknown modifiable types return `new_template_requires_user_approval`.**
- [ ] **Step 5: Render overall progress plus one card per file with type, GN-02 item, template, status, OCR/revision progress, open-item count, latest version, retry, delete and download actions.**
- [ ] **Step 6: Run focused/full tests and build; browser-test three synthetic files and capture the checkpoint; commit `feat: add multi-file MDACS workspace`.**

## Task 6: Revision/DOCX integration and final regression

**Files:**
- Create: `server/hong-kong-registration/ai-revision.js`
- Create: `server/hong-kong-registration/docx-revision.js`
- Modify: `server/hong-kong-registration/routes.js`
- Modify: `src/features/hong-kong-registration/HongKongRegistrationTask.jsx`
- Create: `tests/hong-kong-ai-revision.test.mjs`
- Create: `tests/hong-kong-docx-revision.test.mjs`
- Modify: `tests/hong-kong-multifile-workflow.test.mjs`

- [ ] **Step 1: Extend model-routing tests so each file owns its section checkpoints; classification uses Flash and substantive revision uses Pro.**
- [ ] **Step 2: Extend OOXML tests to assert separate DOCX outputs, Bioray tracked changes/comments, `DRAFT_v0.1`, placeholders and retained history.**
- [ ] **Step 3: Implement idempotent per-file revision keys from source fingerprint, template and version; a retry skips completed sections and never restarts other files.**
- [ ] **Step 4: Enforce one open item at a time using “场景 → 冲突与问题 → 方案”; only zero open items and zero placeholders permit formal `v1.0`.**
- [ ] **Step 5: Run all tests, build, browser acceptance for four markets, multi-file upload/retry/output, deletion/restore, and EU regression.**
- [ ] **Step 6: Commit `feat: complete market-aware MDACS revision workflow`.**

## Checkpoints

1. Navigation and recycle bin are previewable after Task 1.
2. Four market profiles and saved next-step flow are previewable after Task 3.
3. Multi-file upload, recognition and independent status are previewable after Task 5.
4. Separate Bioray DOCX outputs and full regression are verified after Task 6.
