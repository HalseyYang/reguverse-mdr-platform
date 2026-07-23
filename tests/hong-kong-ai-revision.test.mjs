import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRevisionKey,
  modelForRevisionStage,
  reviseSections
} from '../server/hong-kong-registration/ai-revision.js';

test('classification uses Flash and substantive revision uses Pro', () => {
  assert.equal(modelForRevisionStage('classification', { flashModel: 'flash', proModel: 'pro' }), 'flash');
  assert.equal(modelForRevisionStage('substantive_revision', { flashModel: 'flash', proModel: 'pro' }), 'pro');
});

test('revision key is stable per source template and version', () => {
  assert.equal(
    createRevisionKey({ sourceFingerprint: 'abc', templateIdentifier: 'MDS-01', version: 'v0.1' }),
    createRevisionKey({ sourceFingerprint: 'abc', templateIdentifier: 'MDS-01', version: 'v0.1' })
  );
  assert.notEqual(
    createRevisionKey({ sourceFingerprint: 'abc', templateIdentifier: 'MDS-01', version: 'v0.1' }),
    createRevisionKey({ sourceFingerprint: 'abc', templateIdentifier: 'MDS-01', version: 'v0.2' })
  );
});

test('retry skips completed sections and preserves per-file checkpoints', async () => {
  const called = [];
  const result = await reviseSections({
    sourceFingerprint: 'abc',
    templateIdentifier: 'MDS-01',
    version: 'v0.1',
    sourceText: 'source',
    sections: ['identity', 'intended_use'],
    completedCheckpoints: { identity: { content: 'done', openItems: [] } },
    invokeModel: async ({ section, model }) => {
      called.push({ section, model });
      return { content: 'revised', openItems: [] };
    },
    models: { flashModel: 'flash', proModel: 'pro' }
  });
  assert.deepEqual(called, [{ section: 'intended_use', model: 'pro' }]);
  assert.equal(result.checkpoints.identity.content, 'done');
  assert.equal(result.checkpoints.intended_use.content, 'revised');
});

test('open items use the approved scene conflict question options structure', async () => {
  const result = await reviseSections({
    sourceFingerprint: 'abc',
    templateIdentifier: 'MDS-01',
    version: 'v0.1',
    sourceText: 'source',
    sections: ['identity'],
    invokeModel: async () => ({
      content: '[TO BE PROVIDED]',
      openItems: [{
        scene: '第 2 页制造商地址为空。',
        conflictAndQuestion: '正式注册地址应填写什么？',
        options: [{ approach: '沿用营业执照地址', advantages: '一致', disadvantages: '需核验' }]
      }]
    }),
    models: { flashModel: 'flash', proModel: 'pro' }
  });
  assert.equal(result.openItems[0].scene, '第 2 页制造商地址为空。');
  assert.equal(result.canCreateFormalVersion, false);
});
