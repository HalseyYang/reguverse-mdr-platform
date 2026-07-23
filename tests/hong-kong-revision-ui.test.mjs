import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countOpenItems, isRevisionReady, latestRevisionFrom, revisionDownloadPath
} from '../src/features/hong-kong-registration/revision-ui.js';

test('revision UI selects the latest revision and counts pending confirmations', () => {
  const latest = { version: 'v0.2', openItems: [{ scene: 'missing address' }] };
  assert.equal(latestRevisionFrom({ revisionHistory: [{ version: 'v0.1' }, latest] }), latest);
  assert.equal(countOpenItems(latest), 1);
});

test('revision action is available only after document type confirmation', () => {
  assert.equal(isRevisionReady({ status: 'revising_sections', confirmedDocumentType: 'IFU' }), true);
  assert.equal(isRevisionReady({ status: 'awaiting_document_type_confirmation', confirmedDocumentType: 'IFU' }), false);
  assert.equal(isRevisionReady({ status: 'revising_sections' }), false);
});

test('revision download path safely encodes identifiers', () => {
  assert.equal(
    revisionDownloadPath('/projects/p/hong-kong-registration', 'file 1', 'v0.1'),
    '/projects/p/hong-kong-registration/files/file%201/revisions/v0.1/download'
  );
});
