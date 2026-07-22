import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

import {
  listActive,
  listActiveProjects,
  listDeleted,
  listDeletedProjects,
  finalizeProjectUpload,
  prepareDeletedProjects,
  purgeProjectSafely,
  purgeProjectTwoPhase,
  purgeExpiredProjects,
  restore,
  restoreProject,
  softDeleteProject
} from '../server/project-lifecycle.js';

const NOW = '2026-07-22T02:00:00.000Z';

function fixture() {
  return {
    projects: [
      { id: 'alpha', title: 'Alpha dossier' },
      { id: 'beta', title: 'Beta dossier' }
    ],
    tasks: [{ id: 'ta', projectId: 'alpha' }, { id: 'tb', projectId: 'beta' }],
    steps: [{ id: 'sa', projectId: 'alpha' }, { id: 'sb', projectId: 'beta' }],
    files: [
      { id: 'fa', projectId: 'alpha', storedName: 'server-generated-a' },
      { id: 'fb', projectId: 'beta', storedName: 'server-generated-b' }
    ],
    profileExtractions: [{ id: 'ea', projectId: 'alpha' }, { id: 'eb', projectId: 'beta' }],
    documents: [{ id: 'da', projectId: 'alpha' }, { id: 'db', projectId: 'beta' }],
    deviceProfiles: [{ projectId: 'alpha' }, { projectId: 'beta' }],
    events: [
      { id: 'va', meta: { projectId: 'alpha' } },
      { id: 'vb', meta: { projectId: 'beta' } },
      { id: 'global', meta: {} }
    ]
  };
}

test('softDeleteProject sets an ISO deletedAt without mutating its input', () => {
  const db = fixture();
  const result = softDeleteProject(db, 'alpha', NOW);

  assert.equal(result.project.deletedAt, NOW);
  assert.equal(result.project.purgeAt, '2026-08-21T02:00:00.000Z');
  assert.equal(result.fileCount, 1);
  assert.equal(db.projects[0].deletedAt, undefined);
});

test('active and deleted project lists separate soft-deleted projects', () => {
  const deleted = softDeleteProject(fixture(), 'alpha', NOW).db;

  assert.deepEqual(listActiveProjects(deleted).map(({ id }) => id), ['beta']);
  assert.deepEqual(listDeletedProjects(deleted).map(({ id }) => id), ['alpha']);
});

test('restoreProject clears deletedAt and purgeAt', () => {
  const deleted = softDeleteProject(fixture(), 'alpha', NOW).db;
  const restored = restoreProject(deleted, 'alpha');

  assert.equal(restored.project.deletedAt, undefined);
  assert.equal(restored.project.purgeAt, undefined);
  assert.equal(deleted.projects[0].deletedAt, NOW);
});

test('purgeExpiredProjects removes an expired project graph and preserves other projects', () => {
  const deleted = softDeleteProject(fixture(), 'alpha', '2026-06-01T00:00:00.000Z').db;
  const result = purgeExpiredProjects(deleted, '2026-07-02T00:00:00.000Z');

  assert.deepEqual(result.purgedProjectIds, ['alpha']);
  for (const key of ['projects', 'tasks', 'steps', 'files', 'profileExtractions', 'documents', 'deviceProfiles']) {
    assert.equal(result.db[key].some((item) => item.id === 'alpha' || item.projectId === 'alpha'), false, key);
    assert.equal(result.db[key].some((item) => item.id === 'beta' || item.projectId === 'beta'), true, key);
  }
  assert.deepEqual(result.db.events.map(({ id }) => id), ['vb', 'global']);
  assert.deepEqual(result.uploadReferences, ['server-generated-a']);
});

test('project lifecycle operations return clear errors for missing projects', () => {
  assert.throws(() => softDeleteProject(fixture(), 'missing', NOW), /Project not found: missing/);
  assert.throws(() => restoreProject(fixture(), 'missing'), /Project not found: missing/);
});

test('specification aliases listActive, listDeleted, and restore execute lifecycle behavior', () => {
  const deleted = softDeleteProject(fixture(), 'alpha', NOW).db;

  assert.deepEqual(listActive(deleted).map(({ id }) => id), ['beta']);
  assert.deepEqual(listDeleted(deleted).map(({ id }) => id), ['alpha']);
  assert.equal(restore(deleted, 'alpha').project.deletedAt, undefined);
});

test('deleted-project handling purges expired projects before returning the recycle bin', () => {
  const deleted = softDeleteProject(fixture(), 'alpha', '2026-06-01T00:00:00.000Z').db;
  const result = prepareDeletedProjects(deleted, '2026-07-02T00:00:00.000Z');

  assert.deepEqual(result.projects, []);
  assert.equal(result.db.projects.some(({ id }) => id === 'alpha'), false);
  assert.deepEqual(result.purgedProjectIds, ['alpha']);
  assert.deepEqual(result.uploadReferences, ['server-generated-a']);
});

test('delete, restore, and permanent deletion enforce lifecycle state transitions', () => {
  const active = fixture();
  const first = softDeleteProject(active, 'alpha', NOW);

  assert.throws(() => softDeleteProject(first.db, 'alpha', '2026-07-23T02:00:00.000Z'), /Project already deleted: alpha/);
  assert.equal(first.project.purgeAt, '2026-08-21T02:00:00.000Z');
  assert.throws(() => restore(active, 'alpha'), /Project is not deleted: alpha/);
});

test('safe permanent deletion keeps project and storedName when physical deletion fails', async () => {
  const deleted = softDeleteProject(fixture(), 'alpha', NOW).db;
  const failure = new Error('upload locked');

  await assert.rejects(() => purgeProjectSafely(deleted, 'alpha', async () => { throw failure; }), /upload locked/);
  assert.equal(deleted.projects.some(({ id }) => id === 'alpha'), true);
  assert.equal(deleted.files.find(({ projectId }) => projectId === 'alpha').storedName, 'server-generated-a');
});

test('API rejects stale access and invalid lifecycle transitions after soft deletion', async () => {
  const port = 19878;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const dbPath = join(process.cwd(), 'data', 'db.json');
  const backupPath = join(process.cwd(), 'data', '.db.lifecycle-backup.json');
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try { if ((await fetch(`${baseUrl}/health`)).ok) break; } catch { /* retry */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal((await fetch(`${baseUrl}/projects/nmpa-reg`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(`${baseUrl}/projects/nmpa-reg`, { method: 'DELETE' })).status, 409);
    assert.equal((await fetch(`${baseUrl}/projects/nmpa-reg`)).status, 409);
    assert.equal((await fetch(`${baseUrl}/projects/nmpa-reg/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 409);
    assert.equal((await fetch(`${baseUrl}/projects/eu-cer/restore`, { method: 'POST' })).status, 409);
  } finally {
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});

test('two-phase purge does not delete files when the pending DB write fails', async () => {
  const deleted = softDeleteProject(fixture(), 'alpha', NOW).db;
  let deleteCalls = 0;
  await assert.rejects(() => purgeProjectTwoPhase(deleted, 'alpha', {
    now: NOW,
    writeDb: async () => { throw new Error('db unavailable'); },
    deleteUploads: async () => { deleteCalls += 1; }
  }), /db unavailable/);
  assert.equal(deleteCalls, 0);
});

test('two-phase purge keeps a pending project and references when file deletion fails', async () => {
  const deleted = softDeleteProject(fixture(), 'alpha', NOW).db;
  const writes = [];
  await assert.rejects(() => purgeProjectTwoPhase(deleted, 'alpha', {
    now: NOW,
    writeDb: async (db) => { writes.push(structuredClone(db)); },
    deleteUploads: async () => { throw new Error('file locked'); }
  }), /file locked/);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].projects.find(({ id }) => id === 'alpha').purgePendingAt, NOW);
  assert.deepEqual(writes[0].projects.find(({ id }) => id === 'alpha').pendingStoredNames, ['server-generated-a']);
  assert.equal(writes[0].files.find(({ projectId }) => projectId === 'alpha').storedName, 'server-generated-a');
  assert.throws(() => restore(writes[0], 'alpha'), /Project purge is pending: alpha/);
});

test('two-phase purge converges on retry after the final DB write fails', async () => {
  const deleted = softDeleteProject(fixture(), 'alpha', NOW).db;
  let persisted = deleted;
  let writes = 0;
  await assert.rejects(() => purgeProjectTwoPhase(deleted, 'alpha', {
    now: NOW,
    writeDb: async (db) => { writes += 1; if (writes === 2) throw new Error('final write failed'); persisted = structuredClone(db); },
    deleteUploads: async () => {}
  }), /final write failed/);
  assert.ok(persisted.projects.find(({ id }) => id === 'alpha').purgePendingAt);
  const retried = await purgeProjectTwoPhase(persisted, 'alpha', { now: NOW, writeDb: async (db) => { persisted = structuredClone(db); }, deleteUploads: async () => {} });
  assert.equal(retried.db.projects.some(({ id }) => id === 'alpha'), false);
  assert.equal(persisted.projects.some(({ id }) => id === 'alpha'), false);
});

test('upload finalization rechecks active state and cleans a concurrent upload without reviving project', async () => {
  const deleted = softDeleteProject(fixture(), 'alpha', NOW).db;
  const removed = [];
  let writes = 0;
  await assert.rejects(() => finalizeProjectUpload({
    projectId: 'alpha',
    file: { id: 'new', projectId: 'alpha', storedName: 'new-upload' },
    readDb: async () => structuredClone(deleted),
    writeDb: async () => { writes += 1; },
    deleteUploads: async (names) => { removed.push(...names); }
  }), /Project is deleted: alpha/);
  assert.deepEqual(removed, ['new-upload']);
  assert.equal(writes, 0);
  assert.equal(deleted.projects.find(({ id }) => id === 'alpha').deletedAt, NOW);
});
