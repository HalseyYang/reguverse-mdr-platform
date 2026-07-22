function stepIndex(steps, stepId) {
  return steps.findIndex((step) => step.id === stepId);
}

export function previousStep(steps, activeStep) {
  const index = stepIndex(steps, activeStep);
  return index > 0 ? steps[index - 1].id : null;
}

export function isFinalStep(steps, activeStep) {
  return stepIndex(steps, activeStep) === steps.length - 1;
}

export function navigationStepIdForDataSection(steps, dataSectionId) {
  return steps.find((step) => (step.dataSectionId || step.id) === dataSectionId)?.id || steps[0]?.id || null;
}

export function nextStep({ steps, activeStep, missingByStep, visited }) {
  const missing = missingByStep[activeStep] || [];
  if (missing.length) return { action: 'missing', step: activeStep, missing };
  const index = stepIndex(steps, activeStep);
  const next = steps[index + 1]?.id;
  return {
    action: 'save-and-next',
    nextStep: next,
    visited: [...new Set([...visited, next].filter(Boolean))]
  };
}

export function canVisitStep({ steps, targetStep, visited, missingByStep }) {
  if (visited.includes(targetStep)) return { allowed: true };
  const targetIndex = stepIndex(steps, targetStep);
  for (const step of steps.slice(0, targetIndex)) {
    const missing = missingByStep[step.id] || [];
    if (missing.length) return { allowed: false, blockedStep: step.id, missing };
  }
  return { allowed: true };
}

export function savePlanForStepAction({ mode, action }) {
  return {
    local: true,
    server: mode === 'edit' && action === 'next',
    create: mode === 'create' && action === 'final'
  };
}
