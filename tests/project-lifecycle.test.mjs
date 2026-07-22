import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listActive,
  listActiveProjects,
  listDeleted,
  listDeletedProjects,
  prepareDeletedProjects,
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
