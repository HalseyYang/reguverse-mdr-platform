import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const port = 18880;
const baseUrl = `http://127.0.0.1:${port}/api`;
const dbPath = join(process.cwd(), 'data', 'db.json');
const backupPath = join(process.cwd(), 'data', '.db.workflow-test-backup.json');

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

function completeProfile(productName) {
  return {
    basics: { product_name: productName, generic_name: 'Digital therapeutic', regulation: 'EU MDR', eu_mdr_device_class: 'Class I', eu_mdr_classification_rule: 'Rule 11' },
    scope: { intended_use: 'Software intervention', indications: 'Adult indication', target_population: 'Adults', intended_users: 'Patients', operating_principle: 'Software' },
    market: { eu_mdr_certification_scenario: 'Initial certification' }, company: { manufacturer_full_name: 'Workflow Test Manufacturer GmbH', manufacturer_address: 'Munich, Germany' },
    pathway: { clinical_evaluation_pathway: 'Clinical trial route' }, evaluation_scope: { clinical_evaluation_scope: 'Full' }, confirmations: { status: 'draft' }
  };
}

test('initializes full clinical evaluation workflow and keeps task creation idempotent', async () => {
  await mkdir(dirname(dbPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const createResponse = await fetch(`${baseUrl}/projects/from-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: completeProfile(`Workflow Test Device ${Date.now()}`) })
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();

    const firstDetail = await fetch(`${baseUrl}/projects/${created.project.id}`).then((response) => response.json());
    assert.equal(firstDetail.tasks.filter((item) => item.title === 'Clinical Evaluation').length, 1);
    assert.equal(firstDetail.steps.length, 10);
    assert.ok(firstDetail.documents.some((item) => item.id.endsWith('-cer')));
    assert.ok(firstDetail.documents.some((item) => item.id.endsWith('-cep')));
    assert.ok(firstDetail.documents.some((item) => item.id.endsWith('-dcr')));

    const taskResponse = await fetch(`${baseUrl}/projects/${created.project.id}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'clinical-evaluation' })
    });
    assert.equal(taskResponse.status, 200);

    const secondDetail = await fetch(`${baseUrl}/projects/${created.project.id}`).then((response) => response.json());
    assert.equal(secondDetail.tasks.filter((item) => item.title === 'Clinical Evaluation').length, 1);
    assert.equal(secondDetail.steps.length, 10);
    assert.equal(secondDetail.documents.filter((item) => ['CER', 'CEP', 'DCR'].some((suffix) => item.name.includes(suffix))).length, 3);
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});
