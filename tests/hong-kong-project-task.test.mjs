import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';

const port = 18879;
const baseUrl = `http://127.0.0.1:${port}/api`;
const dbPath = join(process.cwd(), 'data', 'db.json');
const backupPath = join(process.cwd(), 'data', '.db.hong-kong-task-test-backup.json');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

function hongKongProfile(productName) {
  return {
    basics: { product_name: productName, generic_name: 'Needle holder', regulation: '香港注册（MDACS）', hong_kong_device_class: 'Class II', hong_kong_classification_basis: 'RULE_6_SURGICALLY_INVASIVE_TRANSIENT' },
    scope: { intended_use: 'Suturing', indications: 'Surgery', target_population: 'Adults', intended_users: 'Surgeons', operating_principle: 'Mechanical' },
    market: { hong_kong_application_type: '新申请', hong_kong_marketing_status: '未在香港上市' },
    company: { manufacturer_full_name: 'Spec Medical Device Manufacturer', manufacturer_address: 'Shenzhen, China', hong_kong_local_responsible_person_name: 'LRP', hong_kong_local_responsible_person_address: 'Hong Kong', hong_kong_local_responsible_person_contact: 'Lee', hong_kong_local_responsible_person_phone: '123', hong_kong_local_responsible_person_email: 'lrp@example.com' },
    pathway: { hong_kong_application_pathway: '新申请', relies_on_other_market_approval: 'No' }, confirmations: { status: 'draft' }
  };
}

test('creating an MDACS profile creates the Hong Kong document revision task instead of Clinical Evaluation', async () => {
  await copyFile(dbPath, backupPath);
  const child = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });

  try {
    await waitForApi();
    const response = await fetch(`${baseUrl}/projects/from-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: hongKongProfile(`Hong Kong Task ${Date.now()}`) })
    });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.deepEqual(result.tasks.map((task) => task.title), ['香港注册文件修订']);
    assert.equal(result.project.market, '香港注册（MDACS）');
    assert.equal(result.project.deviceClass, 'Class II');
    assert.equal(result.project.manufacturer, 'Spec Medical Device Manufacturer');

    const mismatchedProfile = hongKongProfile(`Hong Kong Mismatch ${Date.now()}`);
    mismatchedProfile.basics.hong_kong_device_class = 'Class IV';
    const mismatchResponse = await fetch(`${baseUrl}/projects/from-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: mismatchedProfile })
    });
    assert.equal(mismatchResponse.status, 400);
    const mismatchResult = await mismatchResponse.json();
    assert.ok(mismatchResult.missing.includes('hong_kong_classification_override_reason'));
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});
