function stepIndex(steps, stepId) {
  return steps.findIndex((step) => step.id === stepId);
}

export function createEmptyProfileFromSections(sections) {
  return sections.reduce((profile, section) => ({
    ...profile,
    [section.id]: section.fields.reduce((values, [key]) => ({
      ...values,
      [key]: key === 'status' ? 'draft' : ''
    }), {})
  }), { projectId: null });
}

export function regulatoryRegionForWizardLayout(selectedRegulatoryRegion) {
  return selectedRegulatoryRegion || 'EU MDR';
}

export function shouldCheckIncompatibleRegulatoryFields(currentRegulatoryRegion, nextRegulatoryRegion) {
  return Boolean(currentRegulatoryRegion && nextRegulatoryRegion);
}

export function previousStep(steps, activeStep) {
  const index = stepIndex(steps, activeStep);
  return index > 0 ? steps[index - 1].id : null;
}

export function isFinalStep(steps, activeStep) {
  const index = stepIndex(steps, activeStep);
  return index >= 0 && index === steps.length - 1;
}

export function navigationStepIdForDataSection(steps, dataSectionId) {
  return steps.find((step) => (step.dataSectionId || step.id) === dataSectionId)?.id || null;
}

export function nextStep({ steps, activeStep, missingByStep, visited }) {
  const index = stepIndex(steps, activeStep);
  if (index < 0) return { action: 'invalid', step: activeStep };
  const missing = missingByStep[activeStep] || [];
  if (missing.length) return { action: 'missing', step: activeStep, missing };
  const next = steps[index + 1]?.id;
  return {
    action: 'save-and-next',
    nextStep: next,
    visited: [...new Set([...visited, next].filter(Boolean))]
  };
}

export function stepValidationMessage(missing = []) {
  if (!missing.length) return '';
  const fieldNames = missing.map((item) => item.label || item.key).filter(Boolean);
  return fieldNames.length ? `请填写：${fieldNames.join('、')}` : `当前步骤还有 ${missing.length} 项必填字段缺失`;
}

export function canVisitStep({ steps, targetStep, visited, missingByStep }) {
  const targetIndex = stepIndex(steps, targetStep);
  if (targetIndex < 0) return { allowed: false, reason: 'unknown-step' };
  if (visited.includes(targetStep)) return { allowed: true };
  for (const step of steps.slice(0, targetIndex)) {
    const missing = missingByStep[step.id] || [];
    if (missing.length) return { allowed: false, blockedStep: step.id, missing };
  }
  return { allowed: true };
}

export function readStoredProfileDraft(storage, key, fallback) {
  try {
    const stored = storage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be unavailable entirely; the in-memory fallback remains usable.
    }
    return fallback;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // Storage may be unavailable entirely; the in-memory fallback remains usable.
    }
    return fallback;
  }
}

export function initializeNewProjectProfile(storage, key, emptyProfile) {
  try {
    storage.removeItem(key);
  } catch {
    // A blocked storage API must not prevent a new project from starting empty.
  }
  return emptyProfile;
}

export function writeStoredProfileDraft(storage, key, profile) {
  try {
    storage.setItem(key, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function savePlanForStepAction({ mode, action }) {
  return {
    local: true,
    server: mode === 'edit',
    create: mode === 'create' && action === 'final',
    saveMode: action === 'final' ? 'final' : 'draft'
  };
}
