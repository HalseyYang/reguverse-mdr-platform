import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const port = 18879;
const baseUrl = `http://127.0.0.1:${port}/api`;
const dbPath = join(process.cwd(), 'data', 'db.json');
const backupPath = join(process.cwd(), 'data', '.db.extraction-test-backup.json');
const envPath = join(process.cwd(), '.env');
const envBackupPath = join(process.cwd(), '.env.extraction-test-backup');

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

test('extracts reviewable profile candidates from uploaded context file without changing saved profile', async () => {
  await mkdir(dirname(dbPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), DISABLE_AI_EXTRACTION: '1' },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const aiConfig = await fetch(`${baseUrl}/ai/config`).then((response) => response.json());
    assert.equal(typeof aiConfig.profileExtractionConfigured, 'boolean');
    assert.equal(Object.hasOwn(aiConfig, 'apiKey'), false);

    const before = await fetch(`${baseUrl}/projects/eu-cer`).then((response) => response.json());
    const originalIntendedUse = before.profile.scope.intendedUse;

    const previewForm = new FormData();
    previewForm.append('file', new Blob(['Product Name: Create Mode Device\nIntended Use: Used before project creation.'], { type: 'text/plain' }), 'create-mode-profile.txt');
    const previewResponse = await fetch(`${baseUrl}/profile-extractions/preview`, {
      method: 'POST',
      body: previewForm
    });
    assert.equal(previewResponse.status, 201);
    const preview = await previewResponse.json();
    assert.equal(preview.projectId, null);
    assert.equal(preview.status, 'completed');
    assert.ok(preview.candidates.some((item) => item.sectionId === 'basics' && item.fieldKey === 'productName' && item.value === 'Create Mode Device'));

    const form = new FormData();
    const text = [
      'Product Name: Kranus Mictera Extracted',
      'Manufacturer: Kranus Health GmbH',
      'Intended Use: The app is intended for conservative treatment of female urinary incontinence through a 12-week digital therapeutic programme.',
      'Indications: stress urinary incontinence, urge urinary incontinence, and mixed urinary incontinence.',
      'Target Population: Adult women able to use a smartphone.',
      'Device Class: Class I',
      'Device Type: SaMD / Medical Device Software'
    ].join('\n');
    form.append('file', new Blob([text], { type: 'text/plain' }), 'ifu-profile.txt');
    form.append('type', 'IFU');

    const uploaded = await fetch(`${baseUrl}/projects/eu-cer/files`, {
      method: 'POST',
      body: form
    }).then((response) => response.json());

    const extractionResponse = await fetch(`${baseUrl}/projects/eu-cer/files/${uploaded.id}/extract-profile`, {
      method: 'POST'
    });
    assert.equal(extractionResponse.status, 201);
    const extraction = await extractionResponse.json();

    assert.equal(extraction.projectId, 'eu-cer');
    assert.equal(extraction.fileId, uploaded.id);
    assert.equal(extraction.status, 'completed');
    assert.ok(['rules', 'rules+ai'].includes(extraction.engine));
    assert.ok(extraction.textPreview.includes('Product Name'));
    assert.ok(extraction.candidates.some((item) => item.sectionId === 'basics' && item.fieldKey === 'productName' && item.value === 'Kranus Mictera Extracted'));
    assert.ok(extraction.candidates.some((item) => item.sectionId === 'scope' && item.fieldKey === 'intendedUse'));
    assert.equal(extraction.candidates.some((item) => item.fieldKey === 'deviceType'), false);

    const after = await fetch(`${baseUrl}/projects/eu-cer`).then((response) => response.json());
    assert.equal(after.profile.scope.intendedUse, originalIntendedUse);
    assert.ok(after.profileExtractions.some((item) => item.id === extraction.id));
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});

test('saves DeepSeek AI extraction settings without returning the API key', async () => {
  await mkdir(dirname(dbPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  try {
    await copyFile(envPath, envBackupPath);
  } catch {
    await rm(envBackupPath, { force: true });
  }
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), AI_PROVIDER: '', DEEPSEEK_API_KEY: '', OPENAI_API_KEY: '' },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const response = await fetch(`${baseUrl}/ai/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'test-deepseek-key'
      })
    });
    assert.equal(response.status, 200);
    const config = await response.json();
    assert.equal(config.provider, 'deepseek');
    assert.equal(config.profileExtractionConfigured, true);
    assert.equal(config.profileExtractionModel, 'deepseek-v4-flash');
    assert.equal(config.baseUrl, 'https://api.deepseek.com');
    assert.equal(config.hasApiKey, true);
    assert.equal(Object.hasOwn(config, 'apiKey'), false);
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
    try {
      await copyFile(envBackupPath, envPath);
    } catch {
      await rm(envPath, { force: true });
    }
    await rm(envBackupPath, { force: true });
  }
});

test('extracts profile candidates from natural-language device documentation', async () => {
  await mkdir(dirname(dbPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), DISABLE_AI_EXTRACTION: '1' },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const form = new FormData();
    const text = [
      'Device description',
      'The Non-invasive Cerebral Oximetry System is a non-invasive cerebral oximetry system for monitoring regional cerebral oxygen saturation.',
      '',
      'Legal manufacturer',
      'Acme Neuro Monitoring Ltd.',
      '',
      'MDR classification',
      'Class IIa according to MDR Annex VIII Rule 10.',
      '',
      'Intended purpose',
      'The device is intended to continuously monitor regional cerebral tissue oxygen saturation in adult and pediatric patients at risk of reduced cerebral perfusion.',
      '',
      'Indications for use',
      'Monitoring of cerebral oxygen saturation during surgery, intensive care, and emergency care.',
      '',
      'Patient population',
      'Adult and pediatric patients requiring cerebral oxygenation monitoring.',
      '',
      'Intended operator',
      'Healthcare professionals trained in patient monitoring.',
      '',
      'Environment of use',
      'Hospitals, operating rooms, intensive care units, and emergency departments.',
      '',
      'Principle of operation',
      'Near-infrared spectroscopy sensors estimate regional tissue oxygen saturation from optical absorption signals.'
    ].join('\n');
    form.append('file', new Blob([text], { type: 'text/plain' }), 'cerebral-oximetry-profile.txt');
    form.append('type', 'Product Description');

    const uploaded = await fetch(`${baseUrl}/projects/eu-cer/files`, { method: 'POST', body: form }).then((response) => response.json());
    const response = await fetch(`${baseUrl}/projects/eu-cer/files/${uploaded.id}/extract-profile`, { method: 'POST' });
    assert.equal(response.status, 201);
    const extraction = await response.json();
    const keys = new Set(extraction.candidates.map((item) => `${item.sectionId}.${item.fieldKey}`));

    assert.ok(keys.has('basics.genericName'));
    assert.ok(keys.has('basics.deviceClass'));
    assert.ok(keys.has('basics.classificationRule'));
    assert.ok(keys.has('scope.intendedUse'));
    assert.ok(keys.has('scope.indications'));
    assert.ok(keys.has('scope.targetPopulation'));
    assert.ok(keys.has('scope.intendedUsers'));
    assert.ok(keys.has('scope.useEnvironment'));
    assert.ok(keys.has('scope.operatingPrinciple'));
    assert.ok(keys.has('company.manufacturer'));
    assert.ok(extraction.candidates.find((item) => item.fieldKey === 'deviceClass')?.value.includes('Class IIa'));
    assert.ok(extraction.candidates.find((item) => item.fieldKey === 'intendedUse')?.value.includes('continuously monitor'));
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});
