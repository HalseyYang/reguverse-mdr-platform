import test from 'node:test';
import assert from 'node:assert/strict';

import {
  previousStep,
  nextStep,
  isFinalStep,
  navigationStepIdForDataSection,
  canVisitStep,
  savePlanForStepAction,
  readStoredProfileDraft,
  writeStoredProfileDraft
} from '../src/features/device-profile/profile-navigation.js';

const steps = [
  { id: 'basics', dataSectionId: 'basics' },
  { id: 'scope', dataSectionId: 'scope' },
  { id: 'confirmation', dataSectionId: 'confirmations' }
];

test('previousStep disables the first step and returns the preceding step otherwise', () => {
  assert.equal(previousStep(steps, 'basics'), null);
  assert.equal(previousStep(steps, 'confirmation'), 'scope');
  assert.equal(previousStep([], 'basics'), null);
  assert.equal(previousStep(steps, 'unknown'), null);
});

test('isFinalStep recognizes the market-specific last step', () => {
  assert.equal(isFinalStep(steps, 'scope'), false);
  assert.equal(isFinalStep(steps, 'confirmation'), true);
  assert.equal(isFinalStep([], 'confirmation'), false);
  assert.equal(isFinalStep(steps, 'unknown'), false);
});

test('navigationStepIdForDataSection maps confirmations to confirmation and falls back safely', () => {
  assert.equal(navigationStepIdForDataSection(steps, 'confirmations'), 'confirmation');
  assert.equal(navigationStepIdForDataSection(steps, 'missing'), null);
  assert.equal(navigationStepIdForDataSection([], 'basics'), null);
});

test('nextStep saves and advances exactly one step when the current step is complete', () => {
  assert.deepEqual(nextStep({ steps, activeStep: 'basics', missingByStep: {}, visited: ['basics'] }), {
    action: 'save-and-next',
    nextStep: 'scope',
    visited: ['basics', 'scope']
  });
});

test('nextStep stays put and reports only current-step missing fields', () => {
  const missingByStep = {
    basics: [{ key: 'product_name', label: '产品名称' }],
    scope: [{ key: 'intended_use', label: '预期用途' }]
  };
  assert.deepEqual(nextStep({ steps, activeStep: 'basics', missingByStep, visited: ['basics'] }), {
    action: 'missing',
    step: 'basics',
    missing: missingByStep.basics
  });
});

test('nextStep safely rejects empty steps and an unknown active step', () => {
  assert.deepEqual(nextStep({ steps: [], activeStep: 'basics', missingByStep: {}, visited: [] }), { action: 'invalid', step: 'basics' });
  assert.deepEqual(nextStep({ steps, activeStep: 'unknown', missingByStep: {}, visited: [] }), { action: 'invalid', step: 'unknown' });
});

test('canVisitStep allows visited history but rejects an unvisited future step with incomplete prerequisites', () => {
  assert.deepEqual(canVisitStep({ steps, targetStep: 'basics', visited: ['basics', 'scope'], missingByStep: { basics: [{}] } }), { allowed: true });
  assert.deepEqual(canVisitStep({ steps, targetStep: 'confirmation', visited: ['basics'], missingByStep: { basics: [{}] } }), {
    allowed: false,
    blockedStep: 'basics',
    missing: [{}]
  });
});

test('canVisitStep permits the immediate future only after all preceding steps are complete', () => {
  assert.deepEqual(canVisitStep({ steps, targetStep: 'scope', visited: ['basics'], missingByStep: {} }), { allowed: true });
});

test('canVisitStep safely rejects empty steps and unknown targets', () => {
  assert.deepEqual(canVisitStep({ steps: [], targetStep: 'basics', visited: [], missingByStep: {} }), { allowed: false, reason: 'unknown-step' });
  assert.deepEqual(canVisitStep({ steps, targetStep: 'unknown', visited: [], missingByStep: {} }), { allowed: false, reason: 'unknown-step' });
});

test('stored draft helpers survive invalid JSON and storage failures', () => {
  const fallback = { basics: { regulation: 'EU MDR' } };
  const invalidStorage = { getItem: () => '{bad json', removeItem() { this.removed = true; } };
  assert.equal(readStoredProfileDraft(invalidStorage, 'draft', fallback), fallback);
  assert.equal(invalidStorage.removed, true);
  assert.equal(readStoredProfileDraft({ getItem() { throw new Error('blocked'); }, removeItem() {} }, 'draft', fallback), fallback);
  assert.equal(writeStoredProfileDraft({ setItem() { throw new Error('quota'); } }, 'draft', fallback), false);
  const saved = {};
  assert.equal(writeStoredProfileDraft({ setItem: (key, value) => { saved[key] = value; } }, 'draft', fallback), true);
  assert.deepEqual(JSON.parse(saved.draft), fallback);
});

test('stored draft reader rejects valid JSON values that are not profile objects', () => {
  const fallback = { basics: { regulation: 'EU MDR' } };
  for (const stored of ['null', '[]', '"draft"', '42']) {
    const storage = { getItem: () => stored, removeItem() { this.removed = true; } };
    assert.equal(readStoredProfileDraft(storage, 'draft', fallback), fallback);
    assert.equal(storage.removed, true);
  }
});

test('step save plans never create a project while advancing', () => {
  assert.deepEqual(savePlanForStepAction({ mode: 'create', action: 'draft' }), { local: true, server: false, create: false, saveMode: 'draft' });
  assert.deepEqual(savePlanForStepAction({ mode: 'create', action: 'next' }), { local: true, server: false, create: false, saveMode: 'draft' });
  assert.deepEqual(savePlanForStepAction({ mode: 'edit', action: 'draft' }), { local: true, server: true, create: false, saveMode: 'draft' });
  assert.deepEqual(savePlanForStepAction({ mode: 'edit', action: 'next' }), { local: true, server: true, create: false, saveMode: 'draft' });
  assert.deepEqual(savePlanForStepAction({ mode: 'edit', action: 'final' }), { local: true, server: true, create: false, saveMode: 'final' });
  assert.deepEqual(savePlanForStepAction({ mode: 'create', action: 'final' }), { local: true, server: false, create: true, saveMode: 'final' });
});
