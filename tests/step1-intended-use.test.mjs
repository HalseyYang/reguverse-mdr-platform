import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const port = 18881;
const baseUrl = `http://127.0.0.1:${port}/api`;
const dbPath = join(process.cwd(), 'data', 'db.json');
const backupPath = join(process.cwd(), 'data', '.db.step1-test-backup.json');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApi() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      await wait(150);
    }
  }
  throw new Error('API did not start for test');
}

test('generates Step 1 intended-use output from device profile and uploaded extraction results', async () => {
  await mkdir(dirname(dbPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    await fetch(`${baseUrl}/projects/eu-cer/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'clinical-evaluation' })
    });

    const form = new FormData();
    const text = [
      'Product Name: Kranus Mictera',
      'Intended Use: Confirmed IFU wording for a 12-week digital therapeutic programme for female urinary incontinence.',
      'Target Population: Adult women able to use a smartphone or tablet.',
      'Device Class: Class I'
    ].join('\n');
    form.append('file', new Blob([text], { type: 'text/plain' }), 'step1-ifu.txt');
    form.append('type', 'IFU');
    const uploaded = await fetch(`${baseUrl}/projects/eu-cer/files`, { method: 'POST', body: form }).then((response) => response.json());
    await fetch(`${baseUrl}/projects/eu-cer/files/${uploaded.id}/extract-profile`, { method: 'POST' });

    const response = await fetch(`${baseUrl}/projects/eu-cer/steps/1/generate`, { method: 'POST' });
    assert.equal(response.status, 200);
    const step = await response.json();

    assert.equal(step.id, '1');
    assert.equal(step.status, 'generated');
    assert.equal(step.output.title, 'Step 1 预期用途确认');
    assert.equal(step.output.generatedFrom.extractionFileName, 'step1-ifu.txt');
    assert.ok(step.output.summary.includes('Kranus Mictera'));
    assert.ok(step.output.structuredFields.some((item) => item.fieldKey === 'intendedUse' && item.value.includes('Kranus Mictera is a 12-week')));
    assert.ok(step.output.extractionCandidates.some((item) => item.fieldKey === 'intendedUse' && item.value.includes('Confirmed IFU wording')));
    assert.ok(step.output.actionItems.some((item) => item.includes('IFU/Labeling')));
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});

test('reviews Step 1 fields and locks output after approval', async () => {
  await mkdir(dirname(dbPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const form = new FormData();
    const text = [
      'Product Name: Kranus Mictera',
      'Intended Use: Confirmed IFU wording for a 12-week digital therapeutic programme for female urinary incontinence.',
      'Target Population: Adult women able to use a smartphone or tablet.',
      'Device Class: Class I'
    ].join('\n');
    form.append('file', new Blob([text], { type: 'text/plain' }), 'step1-review-ifu.txt');
    form.append('type', 'IFU');
    const uploaded = await fetch(`${baseUrl}/projects/eu-cer/files`, { method: 'POST', body: form }).then((response) => response.json());
    await fetch(`${baseUrl}/projects/eu-cer/files/${uploaded.id}/extract-profile`, { method: 'POST' });
    await fetch(`${baseUrl}/projects/eu-cer/steps/1/generate`, { method: 'POST' });

    const reviewResponse = await fetch(`${baseUrl}/projects/eu-cer/steps/1/output/fields/scope/intendedUse`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedSource: 'extraction', confirmationStatus: 'confirmed' })
    });
    assert.equal(reviewResponse.status, 200);
    const reviewed = await reviewResponse.json();
    const intendedUse = reviewed.output.structuredFields.find((item) => item.sectionId === 'scope' && item.fieldKey === 'intendedUse');
    assert.equal(intendedUse.selectedSource, 'extraction');
    assert.equal(intendedUse.confirmationStatus, 'confirmed');
    assert.ok(intendedUse.value.includes('Confirmed IFU wording'));

    const editResponse = await fetch(`${baseUrl}/projects/eu-cer/steps/1/output/fields/scope/targetPopulation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'Adult women using a smartphone or tablet, confirmed by reviewer.', selectedSource: 'manual', confirmationStatus: 'confirmed' })
    });
    assert.equal(editResponse.status, 200);

    const approveResponse = await fetch(`${baseUrl}/projects/eu-cer/steps/1/approve`, { method: 'POST' });
    assert.equal(approveResponse.status, 200);
    const approved = await approveResponse.json();
    assert.equal(approved.output.locked, true);

    const lockedEditResponse = await fetch(`${baseUrl}/projects/eu-cer/steps/1/output/fields/scope/intendedUse`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'Should not be saved after approval.' })
    });
    assert.equal(lockedEditResponse.status, 409);
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});

test('generates Step 2 SOTA review from approved Step 1 output', async () => {
  await mkdir(dirname(dbPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    await fetch(`${baseUrl}/projects/eu-cer/steps/1/generate`, { method: 'POST' });
    await fetch(`${baseUrl}/projects/eu-cer/steps/1/output/fields/scope/intendedUse`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'Reviewed intended use for Kranus Mictera in adult women with urinary incontinence.', selectedSource: 'manual', confirmationStatus: 'confirmed' })
    });
    await fetch(`${baseUrl}/projects/eu-cer/steps/1/output/fields/scope/targetPopulation`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'Adult women with stress, urge, or mixed urinary incontinence.', selectedSource: 'manual', confirmationStatus: 'confirmed' })
    });
    const blockedResponse = await fetch(`${baseUrl}/projects/eu-cer/steps/2/generate`, { method: 'POST' });
    assert.equal(blockedResponse.status, 409);

    const approveResponse = await fetch(`${baseUrl}/projects/eu-cer/steps/1/approve`, { method: 'POST' });
    assert.equal(approveResponse.status, 200);

    const response = await fetch(`${baseUrl}/projects/eu-cer/steps/2/generate`, { method: 'POST' });
    assert.equal(response.status, 200);
    const step = await response.json();

    assert.equal(step.id, '2');
    assert.equal(step.status, 'generated');
    assert.equal(step.output.title, 'Step 2 临床背景与 SOTA 综述');
    assert.equal(step.output.generatedFrom.step1Status, 'approved');
    assert.ok(step.output.inheritedFields.some((item) => item.fieldKey === 'intendedUse' && item.value.includes('Reviewed intended use')));
    assert.ok(step.output.inheritedFields.some((item) => item.fieldKey === 'targetPopulation' && item.value.includes('Adult women')));
    assert.ok(step.output.sotaSections.some((item) => item.id === 'disease-background' && item.inputs.some((input) => input.includes('urinary incontinence'))));
    assert.ok(step.output.searchQuestions.some((item) => item.includes('adult women')));
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});
