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
    basics: {
      productName,
      genericName: 'Single-use laparoscopic needle holder',
      regulation: '香港注册（MDACS）',
      deviceClass: 'Class II',
      classificationRule: 'RULE_6_SURGICALLY_INVASIVE_TRANSIENT',
      classificationMismatchReason: ''
    },
    scope: { intendedUse: 'For laparoscopic tissue suturing.', indications: 'Laparoscopic surgery.', targetPopulation: 'Surgical patients.', intendedUsers: 'Healthcare professionals.', useEnvironment: 'Operating room.', operatingPrinciple: 'Mechanical grasping and needle manipulation.' },
    market: { ceScenario: 'Initial certification / marketed elsewhere', marketedStatus: 'Marketed outside Hong Kong.', marketHistory: 'To be confirmed.', clinicalStudySummary: 'Not applicable to this project creation test.' },
    company: { manufacturer: 'Spec Medical Device Manufacturer', manufacturerAddress: 'Shenzhen, China', srn: 'Not applicable', euAuthorizedRepresentative: 'Not applicable', teamSize: 'Test team' },
    pathway: { evaluationPathway: 'Mixed route', equivalenceNeeded: 'Conditional', clinicalEvaluationType: 'Initial clinical evaluation', step10EquivalenceActive: 'Conditional' },
    scopeSettings: { databases: 'Not applicable', searchWindow: 'Not applicable', screeningMethod: 'Not applicable', appraisalMethod: 'Not applicable', exportFormats: 'DOCX' },
    confirmations: { required: 'Confirm Hong Kong classification and source document type.', status: 'draft' }
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

    const mismatchedProfile = hongKongProfile(`Hong Kong Mismatch ${Date.now()}`);
    mismatchedProfile.basics.deviceClass = 'Class IV';
    const mismatchResponse = await fetch(`${baseUrl}/projects/from-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: mismatchedProfile })
    });
    assert.equal(mismatchResponse.status, 400);
    const mismatchResult = await mismatchResponse.json();
    assert.equal(mismatchResult.error, 'Classification override reason is required');
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});
