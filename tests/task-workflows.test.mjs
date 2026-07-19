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
    basics: {
      productName,
      genericName: 'Digital therapeutic test device',
      regulation: 'EU MDR',
      deviceType: 'SaMD',
      deviceClass: 'Class I',
      classificationRule: 'MDR Annex VIII software rule assessment required'
    },
    scope: {
      intendedUse: 'A software-only test device for task workflow initialization.',
      indications: 'Adult users in a test indication.',
      targetPopulation: 'Adult test users.',
      intendedUsers: 'Patients and healthcare professionals.',
      useEnvironment: 'Home setting.',
      operatingPrinciple: 'Software-guided intervention and tracking.'
    },
    market: {
      ceScenario: 'Initial certification / clinical trial evidence route',
      marketedStatus: 'Test product, not marketed.',
      marketHistory: 'No market history in test.',
      clinicalStudySummary: 'Test clinical summary.'
    },
    company: {
      manufacturer: 'Workflow Test Manufacturer GmbH',
      manufacturerAddress: 'Munich, Germany'
    },
    pathway: {
      evaluationPathway: 'Clinical trial route',
      equivalenceNeeded: 'No',
      clinicalEvaluationType: 'Initial clinical evaluation',
      step10EquivalenceActive: 'No'
    },
    scopeSettings: {
      databases: 'PubMed, Embase',
      searchWindow: 'Default 5 years',
      screeningMethod: 'Title/abstract screening followed by full-text appraisal',
      appraisalMethod: 'Relevance, quality, applicability, and evidence grading',
      exportFormats: 'PubMed NBIB; Embase RIS'
    },
    confirmations: {
      required: 'Confirm final IFU wording before formal use.',
      status: 'draft'
    }
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
