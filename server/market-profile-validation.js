import { profileFor, recommendHongKongDeviceClassForProfile, recommendUnitedStatesFdaSubmissionPathway, SUPPORTED_REGULATORY_REGIONS } from '../src/features/device-profile/market-profile-configurations.js';
const populated = (value) => value !== undefined && value !== null && `${value}`.trim() !== '';
export function validateMarketProfile(region, profile = {}) {
  if (!SUPPORTED_REGULATORY_REGIONS.includes(region)) return { code: 'market_profile_validation_failed', missing: [], incompatible: ['basics.regulation'], unsupportedRegulatoryRegion: region };
  const config = profileFor(region, profile);
  const missing = config.fields.filter((item) => item.required && !populated(profile?.[item.section]?.[item.name])).map((item) => item.name);
  if (region === 'FDA') {
    const recommended = recommendUnitedStatesFdaSubmissionPathway(profile);
    if (recommended === 'Needs regulatory assessment') missing.push('fda_regulatory_pathway_assessment');
    else if (populated(profile?.market?.selected_submission_pathway) && profile.market.selected_submission_pathway !== recommended && !populated(profile?.market?.united_states_fda_submission_pathway_override_reason)) missing.push('united_states_fda_submission_pathway_override_reason');
  }
  if (region === '香港注册（MDACS）') {
    const recommended = recommendHongKongDeviceClassForProfile(profile);
    if (recommended && profile?.basics?.hong_kong_device_class !== recommended && !populated(profile?.basics?.hong_kong_classification_override_reason)) missing.push('hong_kong_classification_override_reason');
  }
  const allowed = new Set(config.fields.map((item) => item.name));
  const incompatible = [];
  for (const values of Object.values(profile)) if (values && typeof values === 'object') for (const [name, value] of Object.entries(values)) if (populated(value) && !allowed.has(name) && /^(eu_|nmpa_|united_states_|existing_united_states_|hong_kong_|domestic_|overseas_|single_registration_number)/.test(name)) incompatible.push(name);
  return missing.length || incompatible.length ? { code: 'market_profile_validation_failed', missing: [...new Set(missing)], incompatible: [...new Set(incompatible)] } : { code: null, missing: [], incompatible: [] };
}
