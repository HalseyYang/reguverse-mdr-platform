import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test } from 'node:test';

const port = 18882;
const baseUrl = `http://127.0.0.1:${port}/api`;

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

test('classifies high-frequency endoscopic surgical instrument as Rule 9 Class IIb', async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const response = await fetch(`${baseUrl}/classifiers/eu-mdr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: '一次性使用手控腔内窥镜高频手术器械',
        intendedUse: 'Used in endoscopic surgery with a high-frequency generator for tissue cutting and coagulation.',
        isMedicalDevice: true,
        isIvd: false,
        invasiveRoute: 'surgically-invasive',
        duration: 'transient',
        isReusableSurgicalInstrument: false,
        isActive: true,
        activeFunction: 'therapy',
        administersEnergy: true,
        energyType: 'high-frequency electrical energy',
        hazardousEnergy: true,
        contactsHeartCentralCirculationOrCns: false,
        specialRisks: {}
      })
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.finalClass, 'Class IIb');
    assert.equal(result.controllingRule, 'Rule 9');
    assert.ok(result.candidateRules.some((item) => item.rule === 'Rule 6' && item.deviceClass === 'Class IIa'));
    assert.ok(result.candidateRules.some((item) => item.rule === 'Rule 9' && item.deviceClass === 'Class IIb'));
    assert.ok(result.rationale.includes('high-frequency'));
  } finally {
    child.kill();
  }
});

test('classifies transient endoscopic suturing instrument as Rule 6 Class IIa', async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const response = await fetch(`${baseUrl}/classifiers/eu-mdr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: '一次性使用多关节内窥镜缝合器',
        intendedUse: 'Used during endoscopic surgery to support a suturing needle for tissue suturing.',
        isMedicalDevice: true,
        isIvd: false,
        invasiveRoute: 'surgically-invasive',
        duration: 'transient',
        isReusableSurgicalInstrument: false,
        isActive: false,
        contactsHeartCentralCirculationOrCns: false,
        specialRisks: {}
      })
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.finalClass, 'Class IIa');
    assert.equal(result.controllingRule, 'Rule 6');
    assert.ok(result.candidateRules.some((item) => item.rule === 'Rule 6'));
    assert.equal(result.informationGaps.length, 0);
  } finally {
    child.kill();
  }
});

test('uses the highest applicable MDR rule when a special rule escalates risk', async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const response = await fetch(`${baseUrl}/classifiers/eu-mdr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: 'Drug-coated transient surgical device',
        intendedUse: 'Transient surgically invasive device incorporating a medicinal substance with ancillary action.',
        isMedicalDevice: true,
        isIvd: false,
        invasiveRoute: 'surgically-invasive',
        duration: 'transient',
        isReusableSurgicalInstrument: false,
        isActive: false,
        contactsHeartCentralCirculationOrCns: false,
        specialRisks: { medicinalSubstance: true }
      })
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.finalClass, 'Class III');
    assert.equal(result.controllingRule, 'Rule 14');
    assert.ok(result.candidateRules.some((item) => item.rule === 'Rule 6' && item.deviceClass === 'Class IIa'));
    assert.ok(result.candidateRules.some((item) => item.rule === 'Rule 14' && item.deviceClass === 'Class III'));
  } finally {
    child.kill();
  }
});

test('classifies high-risk standalone medical device software under Rule 11', async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForApi();
    const response = await fetch(`${baseUrl}/classifiers/eu-mdr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productName: 'Stroke triage decision software',
        intendedUse: 'Standalone software providing information used for urgent treatment decisions where incorrect output may lead to death or irreversible deterioration.',
        isMedicalDevice: true,
        isIvd: false,
        invasiveRoute: 'none',
        duration: 'transient',
        isActive: true,
        isSoftware: true,
        softwareRisk: 'death-or-irreversible',
        specialRisks: {}
      })
    });

    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.finalClass, 'Class III');
    assert.equal(result.controllingRule, 'Rule 11');
    assert.ok(result.candidateRules.some((item) => item.rule === 'Rule 11' && item.deviceClass === 'Class III'));
  } finally {
    child.kill();
  }
});
