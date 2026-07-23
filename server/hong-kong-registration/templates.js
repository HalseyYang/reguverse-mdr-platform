const template = (identifier, sourceRelativePath, documentTypes) => Object.freeze({
  identifier,
  sourceRelativePath,
  sourceStatus: 'approved',
  documentTypes: Object.freeze(documentTypes)
});

export const HONG_KONG_TEMPLATE_REGISTRY = Object.freeze([
  template('MDS-01', 'templates/MDS-01_template.md', ['application form mds-01', 'mds-01']),
  template('MDS-02', 'templates/MDS-02_template.md', ['application form mds-02', 'mds-02']),
  template('risk_management_report', 'templates/risk_analysis_report_template.md', ['risk management report']),
  template('clinical_evaluation_report', 'templates/clinical_evaluation_report_template.md', ['clinical evaluation report']),
  template('essential_principles_checklist', 'templates/essential_principles_checklist_template.md', ['essential principles checklist'])
]);

export function recommendTemplate({ documentType = '', modifiable = false } = {}) {
  const normalized = documentType.trim().toLowerCase();
  const match = HONG_KONG_TEMPLATE_REGISTRY.find(({ documentTypes }) => documentTypes.includes(normalized));
  if (match) return { templateIdentifier: match.identifier, recommendation: 'approved_template' };
  return {
    templateIdentifier: null,
    recommendation: modifiable ? 'new_template_requires_user_approval' : 'no_template_required'
  };
}

export async function checkTemplateSourceAvailability(sourceExists) {
  if (typeof sourceExists !== 'function') throw new TypeError('sourceExists is required');
  return Promise.all(HONG_KONG_TEMPLATE_REGISTRY.map(async ({ identifier, sourceRelativePath }) => ({
    identifier,
    sourceRelativePath,
    available: Boolean(await sourceExists(sourceRelativePath))
  })));
}

export function classifyTemplateRequirement({ documentType = '', templateIdentifier = null, modifiable = false } = {}) {
  if (templateIdentifier !== null && !HONG_KONG_TEMPLATE_REGISTRY.some(({ identifier }) => identifier === templateIdentifier)) {
    throw Object.assign(new Error('invalid_template_identifier'), { code: 'invalid_template_identifier' });
  }
  if (templateIdentifier) return { templateIdentifier, requirement: 'approved_template' };
  const recommendation = recommendTemplate({ documentType, modifiable });
  if (recommendation.recommendation === 'new_template_requires_user_approval') {
    throw Object.assign(new Error('new_template_requires_user_approval'), { code: 'new_template_requires_user_approval' });
  }
  return { templateIdentifier: null, requirement: recommendation.recommendation };
}
