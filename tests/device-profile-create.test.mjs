import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const port = 18878;
const baseUrl = `http://127.0.0.1:${port}/api`;
const dbPath = join(process.cwd(), 'data', 'db.json');
const backupPath = join(process.cwd(), 'data', '.db.test-backup.json');

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

function makeProfile(productName) {
  return {
    basics: { product_name: productName, generic_name: 'Digital therapeutic test device', regulation: 'EU MDR', eu_mdr_device_class: 'Class I', eu_mdr_classification_rule: 'Rule 11' },
    scope: { intended_use: 'Software intervention.', indications: 'Adult indication.', target_population: 'Adults', intended_users: 'Patients', operating_principle: 'Software guidance.' },
    market: { eu_mdr_certification_scenario: 'Initial certification' },
    company: { manufacturer_full_name: 'Spec Test Manufacturer GmbH', manufacturer_address: 'Munich, Germany' },
    pathway: { clinical_evaluation_pathway: 'Clinical trial route' },
    evaluation_scope: { clinical_evaluation_scope: 'Full evaluation' },
    confirmations: { status: 'draft' }
  };
}

test('creates a project, profile, and clinical evaluation task from a completed profile', async () => {
  await mkdir(dirname(dbPath), { recursive: true });
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const productName = `Spec Test Device ${Date.now()}`;
    const response = await fetch(`${baseUrl}/projects/from-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: makeProfile(productName) })
    });

    assert.equal(response.status, 201);
    const result = await response.json();
    assert.equal(result.project.product, productName);
    assert.equal(result.profile.basics.product_name, productName);
    assert.equal(result.profile.company.manufacturer_full_name, 'Spec Test Manufacturer GmbH');
    assert.ok(result.tasks.some((item) => item.title === 'Clinical Evaluation'));

    for (const regulation of ['NMPA', 'FDA', '香港注册（MDACS）']) {
      const legacyResponse = await fetch(`${baseUrl}/projects/from-profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { basics: { productName: 'Legacy', genericName: 'Device', regulation }, company: { manufacturer: 'Legacy Manufacturer' } } })
      });
      assert.equal(legacyResponse.status, 400, `${regulation} camelCase creation must be rejected`);
      assert.equal((await legacyResponse.json()).code, 'market_profile_validation_failed');
    }
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});
