import test from 'node:test';
import assert from 'node:assert/strict';

import {
  previousStep,
  nextStep,
  isFinalStep,
  navigationStepIdForDataSection,
  canVisitStep,
  savePlanForStepAction
} from '../src/features/device-profile/profile-navigation.js';

const steps = [
  { id: 'basics', dataSectionId: 'basics' },
  { id: 'scope', dataSectionId: 'scope' },
  { id: 'confirmation', dataSectionId: 'confirmations' }
];

test('previousStep disables the first step and returns the preceding step otherwise', () => {
  assert.equal(previousStep(steps, 'basics'), null);
  assert.equal(previousStep(steps, 'confirmation'), 'scope');
});

test('isFinalStep recognizes the market-specific last step', () => {
  assert.equal(isFinalStep(steps, 'scope'), false);
  assert.equal(isFinalStep(steps, 'confirmation'), true);
});

test('navigationStepIdForDataSection maps confirmations to confirmation and falls back safely', () => {
  assert.equal(navigationStepIdForDataSection(steps, 'confirmations'), 'confirmation');
  assert.equal(navigationStepIdForDataSection(steps, 'missing'), 'basics');
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

test('step save plans never create a project while advancing', () => {
  assert.deepEqual(savePlanForStepAction({ mode: 'create', action: 'draft' }), { local: true, server: false, create: false, saveMode: 'draft' });
  assert.deepEqual(savePlanForStepAction({ mode: 'create', action: 'next' }), { local: true, server: false, create: false, saveMode: 'draft' });
  assert.deepEqual(savePlanForStepAction({ mode: 'edit', action: 'draft' }), { local: true, server: true, create: false, saveMode: 'draft' });
  assert.deepEqual(savePlanForStepAction({ mode: 'edit', action: 'next' }), { local: true, server: true, create: false, saveMode: 'draft' });
  assert.deepEqual(savePlanForStepAction({ mode: 'edit', action: 'final' }), { local: true, server: true, create: false, saveMode: 'final' });
  assert.deepEqual(savePlanForStepAction({ mode: 'create', action: 'final' }), { local: true, server: false, create: true, saveMode: 'final' });
});
