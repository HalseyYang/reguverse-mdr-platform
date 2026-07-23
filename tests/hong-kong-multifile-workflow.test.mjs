import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import express from 'express';

import {
  HONG_KONG_DOCUMENT_REVISION_PHASES,
  HONG_KONG_DOCUMENT_REVISION_STATUSES,
  addFiles,
  confirmDocumentType,
  markFileFailed,
  retryFile
} from '../server/hong-kong-registration/contracts.js';
import { createHongKongRegistrationStore } from '../server/hong-kong-registration/store.js';
import { createHongKongRegistrationRouter } from '../server/hong-kong-registration/routes.js';
import { purgeProjectTwoPhase } from '../server/project-lifecycle.js';

function zipWithEntries(entryNames) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entryName of entryNames) {
    const name = Buffer.from(entryName);
    const data = Buffer.from('<xml/>');
    let checksum = 0xffffffff;
    for (const byte of data) {
      checksum ^= byte;
      for (let bit = 0; bit < 8; bit += 1) checksum = (checksum >>> 1) ^ (0xedb88320 & -(checksum & 1));
    }
    checksum = (checksum ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    localParts.push(local, name, data);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entryNames.length, 8);
  end.writeUInt16LE(entryNames.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

test('contract exposes the exact six phases and eight statuses', () => {
  assert.deepEqual(HONG_KONG_DOCUMENT_REVISION_PHASES.map(({ label }) => label), [
    '上传文件', '文件识别', '文件类型与模板确认', '香港要求审查与修订', '待确认项', 'DOCX版本与下载'
  ]);
  assert.deepEqual(HONG_KONG_DOCUMENT_REVISION_STATUSES, [
    'awaiting_upload', 'extracting_content', 'awaiting_document_type_confirmation',
    'revising_sections', 'awaiting_user_confirmation', 'ready_for_formal_version',
    'completed', 'processing_failed'
  ]);
});

test('three added files have independent identity, state, and processing mode', () => {
  const task = addFiles({ projectId: 'project-alpha', files: [] }, [
    { originalName: 'ifu.docx' }, { originalName: 'certificate.pdf' }, { originalName: 'label.png' }
  ]);
  assert.equal(new Set(task.files.map(({ fileId }) => fileId)).size, 3);
  assert.deepEqual(task.files.map(({ status }) => status), Array(3).fill('extracting_content'));
  assert.deepEqual(task.files.map(({ processingMode }) => processingMode), Array(3).fill('revise'));

  const failed = markFileFailed(task, task.files[1].fileId, { code: 'damaged_file' });
  assert.deepEqual(failed.files.map(({ status }) => status), ['extracting_content', 'processing_failed', 'extracting_content']);
  const retried = retryFile(failed, task.files[1].fileId);
  assert.deepEqual(retried.files.map(({ status }) => status), Array(3).fill('extracting_content'));
  assert.equal(retried.files[0].fileId, task.files[0].fileId);
  assert.equal(retried.files[2].fileId, task.files[2].fileId);
});

test('document type confirmation selects mode and only then advances state', () => {
  const task = addFiles({ projectId: 'project-alpha', files: [] }, [{ originalName: 'approval.pdf' }]);
  const fileId = task.files[0].fileId;
  const confirmed = confirmDocumentType(task, fileId, {
    recommendedDocumentType: 'approval_certificate', confirmedDocumentType: 'approval_certificate',
    templateIdentifier: null, gn02Item: null
  });
  assert.equal(confirmed.files[0].processingMode, 'review_only');
  assert.equal(confirmed.files[0].status, 'revising_sections');
  assert.equal(confirmed.files[0].confirmedDocumentType, 'approval_certificate');
});

test('store rejects traversal and creates the fixed isolated directory layout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hk-store-'));
  try {
    const store = createHongKongRegistrationStore({ dataRoot: root });
    for (const invalid of ['', '..', '../escape', 'a/b', 'a\\b', 'C:drive']) {
      await assert.rejects(() => store.getTask(invalid), /invalid_project_id/);
    }
    await store.createTask('project-alpha');
    assert.deepEqual((await readdir(join(root, 'hong_kong_registration', 'project-alpha'))).sort(),
      ['drafts', 'extracted', 'finals', 'sources', 'task.json']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('task mutations serialize within a project without losing files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hk-store-concurrency-'));
  try {
    const store = createHongKongRegistrationStore({ dataRoot: root });
    await store.createTask('project-alpha');
    await Promise.all(Array.from({ length: 12 }, (_, index) => store.mutateTask('project-alpha', (task) => addFiles(task, [{ originalName: `${index}.pdf` }]))));
    assert.equal((await store.getTask('project-alpha')).files.length, 12);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed atomic task write preserves the previous task and leaves no temp file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hk-store-atomic-'));
  try {
    let failRename = false;
    const store = createHongKongRegistrationStore({
      dataRoot: root,
      rename: async (from, to) => {
        if (failRename && to.endsWith('task.json')) throw new Error('simulated rename failure');
        const { rename } = await import('node:fs/promises');
        return rename(from, to);
      }
    });
    await store.createTask('project-alpha');
    failRename = true;
    await assert.rejects(() => store.mutateTask('project-alpha', (task) => addFiles(task, [{ originalName: 'bad.pdf' }])), /simulated/);
    const persisted = JSON.parse(await readFile(join(root, 'hong_kong_registration', 'project-alpha', 'task.json'), 'utf8'));
    assert.equal(persisted.files.length, 0);
    assert.equal((await readdir(join(root, 'hong_kong_registration', 'project-alpha'))).some((name) => name.includes('.tmp-')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('batch source upload is all-or-nothing and validates content signatures', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hk-store-upload-'));
  try {
    const store = createHongKongRegistrationStore({ dataRoot: root });
    await store.createTask('project-alpha');
    const pdf = Buffer.from('%PDF-1.7\nvalid');
    await assert.rejects(() => store.addSourceFiles('project-alpha', [
      { originalName: 'valid.pdf', buffer: pdf },
      { originalName: 'invalid.xlsx', buffer: Buffer.from('xlsx') }
    ]), (error) => error.code === 'unsupported_file_type');
    assert.equal((await store.getTask('project-alpha')).files.length, 0);
    assert.deepEqual(await readdir(join(root, 'hong_kong_registration', 'project-alpha', 'sources')), []);
    await assert.rejects(() => store.addSourceFiles('project-alpha', [{ originalName: 'fake.pdf', buffer: Buffer.from('not pdf') }]),
      (error) => error.code === 'content_signature_mismatch');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('DOCX validation reads central-directory entries and rejects renamed XLSX and generic ZIP files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hk-store-docx-'));
  try {
    const store = createHongKongRegistrationStore({ dataRoot: root });
    await store.createTask('project-alpha');
    const docx = zipWithEntries(['[Content_Types].xml', 'word/document.xml']);
    assert.equal((await store.addSourceFiles('project-alpha', [{ originalName: 'valid.docx', buffer: docx }])).files.length, 1);
    const renamedXlsx = zipWithEntries(['[Content_Types].xml', 'xl/workbook.xml']);
    await assert.rejects(() => store.addSourceFiles('project-alpha', [{ originalName: 'renamed.docx', buffer: renamedXlsx }]),
      (error) => error.code === 'content_signature_mismatch');
    const genericZip = zipWithEntries(['[Content_Types].xml', 'payload/data.xml']);
    await assert.rejects(() => store.addSourceFiles('project-alpha', [{ originalName: 'generic.docx', buffer: genericZip }]),
      (error) => error.code === 'content_signature_mismatch');
    const forgedCentralDirectory = Buffer.from(docx);
    forgedCentralDirectory.writeUInt32LE(0, 0);
    await assert.rejects(() => store.addSourceFiles('project-alpha', [{ originalName: 'forged.docx', buffer: forgedCentralDirectory }]),
      (error) => error.code === 'content_signature_mismatch');
    await assert.rejects(() => store.addSourceFiles('project-alpha', [{ originalName: 'truncated.docx', buffer: docx.subarray(0, docx.length - 5) }]),
      (error) => error.code === 'content_signature_mismatch');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('deleting a source never applies its stored name to other controlled directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hk-store-delete-map-'));
  try {
    const store = createHongKongRegistrationStore({ dataRoot: root });
    await store.createTask('project-alpha');
    const task = await store.addSourceFiles('project-alpha', [{ originalName: 'source.pdf', buffer: Buffer.from('%PDF-1.7\nsource') }]);
    const source = task.files[0];
    const projectDirectory = join(root, 'hong_kong_registration', 'project-alpha');
    for (const directory of ['extracted', 'drafts', 'finals']) {
      await writeFile(join(projectDirectory, directory, source.storedName), `belongs to another file in ${directory}`);
    }
    await store.mutateTask('project-alpha', (current) => ({
      ...current,
      files: [...current.files, {
        fileId: 'hk-file-collision-owner', originalName: 'other.pdf', storedName: null,
        extractedStoredNames: [source.storedName], draftsStoredNames: [source.storedName], finalsStoredNames: [source.storedName],
        status: 'completed', processingMode: 'revise'
      }]
    }));
    await store.deleteFile('project-alpha', source.fileId);
    await assert.rejects(() => access(join(projectDirectory, 'sources', source.storedName)), { code: 'ENOENT' });
    for (const directory of ['extracted', 'drafts', 'finals']) {
      await access(join(projectDirectory, directory, source.storedName));
    }
    assert.deepEqual((await store.getTask('project-alpha')).files.map(({ fileId }) => fileId), ['hk-file-collision-owner']);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('project-scoped API rejects non-MDACS and deleted projects and isolates retry/delete', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hk-routes-'));
  const store = createHongKongRegistrationStore({ dataRoot: root });
  const projects = new Map([
    ['hk-active', { id: 'hk-active', market: '香港注册（MDACS）' }],
    ['eu-active', { id: 'eu-active', market: 'EU MDR' }],
    ['hk-deleted', { id: 'hk-deleted', market: '香港注册（MDACS）', deletedAt: new Date().toISOString() }]
  ]);
  await store.createTask('hk-active');
  const app = express();
  app.use(express.json());
  app.use('/api/projects/:projectId/hong-kong-registration', createHongKongRegistrationRouter({
    store,
    requireProjectAccess: async (projectId) => ({ project: projects.get(projectId), hasHongKongTask: projectId !== 'eu-active' })
  }));
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const url = `http://127.0.0.1:${server.address().port}/api/projects`;
  try {
    assert.equal((await fetch(`${url}/eu-active/hong-kong-registration/task`)).status, 409);
    assert.equal((await fetch(`${url}/hk-deleted/hong-kong-registration/task`)).status, 409);

    const form = new FormData();
    form.append('files', new Blob([Buffer.from('%PDF-1.7\none')], { type: 'application/pdf' }), 'one.pdf');
    form.append('files', new Blob([Buffer.from('%PDF-1.7\ntwo')], { type: 'application/pdf' }), 'two.pdf');
    const uploadResponse = await fetch(`${url}/hk-active/hong-kong-registration/files`, { method: 'POST', body: form });
    assert.equal(uploadResponse.status, 201);
    const uploaded = await uploadResponse.json();
    assert.equal(uploaded.files.length, 2);
    const [first, second] = uploaded.files;
    await store.mutateTask('hk-active', (task) => markFileFailed(task, first.fileId, { code: 'damaged_file' }));
    assert.equal((await fetch(`${url}/hk-active/hong-kong-registration/files/${first.fileId}/retry`, { method: 'POST' })).status, 200);
    const confirmed = await fetch(`${url}/hk-active/hong-kong-registration/files/${second.fileId}/confirm-type`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmedDocumentType: 'test_report', recommendedDocumentType: 'test_report' })
    });
    assert.equal(confirmed.status, 200);
    assert.equal((await confirmed.json()).file.processingMode, 'review_only');
    const deleted = await fetch(`${url}/hk-active/hong-kong-registration/files/${first.fileId}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    const deletedResult = await deleted.json();
    assert.equal('storedName' in deletedResult.task.files[0], false);
    const remaining = await store.getTask('hk-active');
    assert.deepEqual(remaining.files.map(({ fileId }) => fileId), [second.fileId]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('two-phase project purge cleans Hong Kong project storage before database removal', async () => {
  let persisted = {
    projects: [{ id: 'hk-active', market: '香港注册（MDACS）', deletedAt: '2026-07-01T00:00:00.000Z' }],
    tasks: [], files: [], steps: [], profileExtractions: [], documents: [], deviceProfiles: [], events: []
  };
  const cleaned = [];
  const result = await purgeProjectTwoPhase(persisted, 'hk-active', {
    now: new Date('2026-07-23T00:00:00.000Z'),
    readDb: async () => structuredClone(persisted),
    writeDb: async (db) => { persisted = structuredClone(db); },
    deleteUploads: async () => {},
    cleanupProjectStorage: async (projectId) => { cleaned.push(projectId); }
  });
  assert.deepEqual(cleaned, ['hk-active']);
  assert.equal(result.db.projects.length, 0);
});
