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
    basics: {
      productName,
      genericName: 'Digital therapeutic test device',
      regulation: 'EU MDR',
      deviceType: 'SaMD',
      deviceClass: 'Class I',
      classificationRule: 'MDR Annex VIII software rule assessment required'
    },
    scope: {
      intendedUse: 'A software-only test device for validating profile creation.',
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
      manufacturer: 'Spec Test Manufacturer GmbH',
      manufacturerAddress: 'Munich, Germany',
      srn: 'To be confirmed',
      euAuthorizedRepresentative: 'Not required if manufacturer is established in EU/EEA',
      teamSize: 'Test team'
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
    assert.equal(result.profile.basics.productName, productName);
    assert.equal(result.profile.company.manufacturer, 'Spec Test Manufacturer GmbH');
    assert.ok(result.tasks.some((item) => item.title === 'Clinical Evaluation'));
  } finally {
    child.kill();
    await wait(100);
    await copyFile(backupPath, dbPath);
    await rm(backupPath, { force: true });
  }
});
