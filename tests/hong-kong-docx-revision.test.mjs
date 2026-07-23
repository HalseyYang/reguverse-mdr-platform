import test from 'node:test';
import assert from 'node:assert/strict';
import { createRevisionDocx, nextDraftVersion } from '../server/hong-kong-registration/docx-revision.js';

test('draft version increments while the latest output points to the new version', () => {
  assert.equal(nextDraftVersion([]), 'v0.1');
  assert.equal(nextDraftVersion([{ version: 'v0.1' }, { version: 'v0.2' }]), 'v0.3');
});

test('generated editable DOCX contains DRAFT version, Bioray comments and tracked changes', () => {
  const buffer = createRevisionDocx({
    title: 'MDS-01',
    version: 'v0.1',
    templateMarkdown: '# Application\nManufacturer: [TO BE PROVIDED]',
    sections: [{ heading: 'Application', content: 'Revised content' }],
    openItems: [{
      scene: 'Manufacturer is missing',
      conflictAndQuestion: 'Which legal entity should be used?',
      options: [{ approach: 'Use licence entity', advantages: 'Traceable', disadvantages: 'Needs confirmation' }]
    }]
  });
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
  const packageText = buffer.toString('utf8');
  assert.match(packageText, /DRAFT_v0\.1/);
  assert.match(packageText, /Bioray/);
  assert.match(packageText, /TO BE PROVIDED/);
  assert.match(packageText, /w:ins/);
  assert.match(packageText, /word\/comments\.xml/);
});

test('formal v1.0 is rejected while placeholders or open items remain', () => {
  assert.throws(() => createRevisionDocx({
    title: 'MDS-01', version: 'v1.0', templateMarkdown: '[TO BE PROVIDED]', sections: [], openItems: []
  }), { code: 'formal_version_blocked' });
  assert.throws(() => createRevisionDocx({
    title: 'MDS-01', version: 'v1.0', templateMarkdown: '', sections: [], openItems: [{ scene: 'x' }]
  }), { code: 'formal_version_blocked' });
});
