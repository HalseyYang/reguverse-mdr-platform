import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_REGULATORY_REGIONS,
  profileFor,
  incompatiblePopulatedFields,
  recommendHongKongDeviceClassForProfile,
  recommendUnitedStatesFdaSubmissionPathway
} from '../src/features/device-profile/market-profile-configurations.js';
import { validateMarketProfile } from '../server/market-profile-validation.js';
import {
  HONG_KONG_REGULATORY_REGION,
  fieldConfigurationForRegulatoryRegion
} from '../src/features/hong-kong-registration/regulatory-options.js';

const regions = ['EU MDR', 'NMPA', 'FDA', '香港注册（MDACS）'];

test('supports exactly the four approved regulatory regions', () => {
  assert.deepEqual(SUPPORTED_REGULATORY_REGIONS, regions);
  assert.ok(!SUPPORTED_REGULATORY_REGIONS.includes('UK MDR'));
});

test('provides the approved step count and key market fields', () => {
  for (const region of regions) assert.equal(profileFor(region).region, region);
  assert.equal(profileFor('EU MDR').steps.length, 7);
  assert.equal(profileFor('NMPA').steps.length, 7);
  assert.equal(profileFor('FDA').steps.length, 7);
  assert.equal(profileFor(HONG_KONG_REGULATORY_REGION).steps.length, 6);

  const nmpa = profileFor('NMPA', { market: { product_source: '进口' } });
  assert.ok(nmpa.fields.some((field) => field.name === 'overseas_registrant_full_name' && field.required));
  assert.ok(nmpa.fields.some((field) => field.name === 'domestic_agent_full_name' && field.required));
  assert.ok(!nmpa.fields.some((field) => field.name === 'domestic_registrant_full_name'));
  const domestic = profileFor('NMPA', { market: { product_source: '境内' } });
  assert.ok(domestic.fields.some((field) => field.name === 'domestic_registrant_full_name' && field.required));

  const fda = profileFor('FDA');
  assert.ok(fda.fields.some((field) => field.name === 'united_states_fda_product_code' && field.required));
  assert.ok(fda.fields.some((field) => field.name === 'existing_united_states_fda_submission_number'));
  assert.ok(fda.fields.find((field) => field.name === 'selected_submission_pathway').options.includes('510(k)'));
  assert.equal(fda.fields.find((field) => field.name === 'selected_submission_pathway').editable, true);

  const hk = profileFor(HONG_KONG_REGULATORY_REGION);
  assert.ok(hk.fields.some((field) => field.name === 'hong_kong_local_responsible_person_email' && field.required));
  assert.deepEqual(hk.fields.find((field) => field.name === 'hong_kong_application_type').options, ['新申请', '变更申请', '续期维护', '待判断']);
  assert.deepEqual(hk.fields.find((field) => field.name === 'hong_kong_marketing_status').options, ['未在香港上市', '已在香港上市', '待确认']);
  assert.deepEqual(hk.fields.find((field) => field.name === 'relies_on_other_market_approval').options, ['Yes', 'No', 'To be determined']);
  assert.ok(!hk.steps.some((step) => step.id === 'evaluation_scope'));
  assert.deepEqual(fieldConfigurationForRegulatoryRegion(HONG_KONG_REGULATORY_REGION).deviceClasses, ['Class II', 'Class III', 'Class IV']);
});

test('server rejects an edited FDA recommendation without rationale', () => {
  const result = validateMarketProfile('FDA', {
    basics: { product_name: 'Device', generic_name: 'Pump', united_states_fda_device_class: 'Class II', united_states_fda_regulation_number: '21 CFR 880.5725', united_states_fda_product_code: 'FRN' },
    scope: { intended_use: 'Infusion', indications: 'Treatment', target_population: 'Adults', intended_users: 'Clinicians', operating_principle: 'Pump' },
    market: { united_states_marketing_status: 'Not marketed', legally_marketed_predicate_device: 'Yes', selected_submission_pathway: 'De Novo' },
    company: { manufacturer_full_name: 'Acme', manufacturer_address: 'One St', united_states_agent_full_name: 'Agent', establishment_registration_status: 'Registered', device_listing_status: 'Listed' },
    submission: { submission_document_scope: 'Full' }, confirmations: { status: 'draft' }
  });
  assert.equal(result.code, 'market_profile_validation_failed');
  assert.ok(result.missing.includes('united_states_fda_submission_pathway_override_reason'));
});

test('FDA recommendation is deterministic and server does not trust a submitted recommendation', () => {
  assert.equal(recommendUnitedStatesFdaSubmissionPathway({ market: { united_states_fda_exemption_confirmed: 'Yes' } }), 'Exempt');
  assert.equal(recommendUnitedStatesFdaSubmissionPathway({ market: { humanitarian_device_exemption_eligible: 'Yes' } }), 'HDE');
  assert.equal(recommendUnitedStatesFdaSubmissionPathway({ basics: { united_states_fda_device_class: 'Class III' } }), 'PMA');
  assert.equal(recommendUnitedStatesFdaSubmissionPathway({ market: { legally_marketed_predicate_device: 'Yes' } }), '510(k)');
  assert.equal(recommendUnitedStatesFdaSubmissionPathway({ basics: { united_states_fda_device_class: 'Class II' }, market: { legally_marketed_predicate_device: 'No' } }), 'De Novo');
  assert.equal(recommendUnitedStatesFdaSubmissionPathway({}), 'Needs regulatory assessment');

  const profile = completeFdaProfile();
  profile.market.recommended_submission_pathway = 'De Novo';
  profile.market.selected_submission_pathway = 'De Novo';
  const result = validateMarketProfile('FDA', profile);
  assert.ok(result.missing.includes('united_states_fda_submission_pathway_override_reason'));
});

test('Hong Kong recommendation is editable but an override requires the formal reason field', () => {
  const profile = completeHongKongProfile();
  assert.equal(recommendHongKongDeviceClassForProfile(profile), 'Class II');
  profile.basics.hong_kong_device_class = 'Class IV';
  let result = validateMarketProfile(HONG_KONG_REGULATORY_REGION, profile);
  assert.ok(result.missing.includes('hong_kong_classification_override_reason'));
  profile.basics.hong_kong_classification_override_reason = 'Conservative classification based on intended use.';
  result = validateMarketProfile(HONG_KONG_REGULATORY_REGION, profile);
  assert.equal(result.code, null);
});

function completeFdaProfile() {
  return {
    basics: { product_name: 'Device', generic_name: 'Pump', regulation: 'FDA', united_states_fda_device_class: 'Class II', united_states_fda_regulation_number: '21 CFR 880.5725', united_states_fda_product_code: 'FRN' },
    scope: { intended_use: 'Infusion', indications: 'Treatment', target_population: 'Adults', intended_users: 'Clinicians', operating_principle: 'Pump' },
    market: { united_states_marketing_status: 'Not marketed', legally_marketed_predicate_device: 'Yes', selected_submission_pathway: '510(k)' },
    company: { manufacturer_full_name: 'Acme', manufacturer_address: 'One St', united_states_agent_full_name: 'Agent', establishment_registration_status: 'Registered', device_listing_status: 'Listed' },
    submission: { submission_document_scope: 'Full' }, confirmations: { status: 'draft' }
  };
}

function completeHongKongProfile() {
  return {
    basics: { product_name: 'Device', generic_name: 'Instrument', regulation: HONG_KONG_REGULATORY_REGION, hong_kong_device_class: 'Class II', hong_kong_classification_basis: 'RULE_6_SURGICALLY_INVASIVE_TRANSIENT' },
    scope: { intended_use: 'Suturing', indications: 'Surgery', target_population: 'Adults', intended_users: 'Surgeons', operating_principle: 'Mechanical' },
    market: { hong_kong_application_type: '新申请', hong_kong_marketing_status: '未在香港上市' },
    company: { manufacturer_full_name: 'Acme', manufacturer_address: 'One St', hong_kong_local_responsible_person_name: 'LRP', hong_kong_local_responsible_person_address: 'HK', hong_kong_local_responsible_person_contact: 'Lee', hong_kong_local_responsible_person_phone: '123', hong_kong_local_responsible_person_email: 'a@example.com' },
    pathway: { hong_kong_application_pathway: '新申请', relies_on_other_market_approval: 'No' }, confirmations: { status: 'draft' }
  };
}

test('reports populated fields that are incompatible with a market switch', () => {
  const fields = incompatiblePopulatedFields('FDA', 'EU MDR', { basics: { united_states_fda_product_code: 'FRN' } });
  assert.deepEqual(fields.map((field) => field.name), ['united_states_fda_product_code']);
  assert.ok(fields[0].label.includes('FDA'));
});
