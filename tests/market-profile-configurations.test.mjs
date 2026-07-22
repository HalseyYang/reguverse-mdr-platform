import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SUPPORTED_REGULATORY_REGIONS,
  profileFor,
  incompatiblePopulatedFields
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
  assert.ok(fda.fields.find((field) => field.name === 'selected_submission_pathway').options.includes('510(k)'));
  assert.equal(fda.fields.find((field) => field.name === 'selected_submission_pathway').editable, true);

  const hk = profileFor(HONG_KONG_REGULATORY_REGION);
  assert.ok(hk.fields.some((field) => field.name === 'hong_kong_local_responsible_person_email' && field.required));
  assert.ok(!hk.steps.some((step) => step.id === 'evaluation_scope'));
  assert.deepEqual(fieldConfigurationForRegulatoryRegion(HONG_KONG_REGULATORY_REGION).deviceClasses, ['Class II', 'Class III', 'Class IV']);
});

test('server rejects an edited FDA recommendation without rationale', () => {
  const result = validateMarketProfile('FDA', {
    basics: { product_name: 'Device', generic_name: 'Pump', united_states_fda_device_class: 'Class II', united_states_fda_regulation_number: '21 CFR 880.5725', united_states_fda_product_code: 'FRN' },
    scope: { intended_use: 'Infusion', indications: 'Treatment', target_population: 'Adults', intended_users: 'Clinicians', operating_principle: 'Pump' },
    market: { united_states_marketing_status: 'Not marketed', recommended_submission_pathway: '510(k)', selected_submission_pathway: 'De Novo' },
    company: { manufacturer_full_name: 'Acme', manufacturer_address: 'One St', united_states_agent_full_name: 'Agent', establishment_registration_status: 'Registered', device_listing_status: 'Listed' },
    submission: { submission_document_scope: 'Full' }, confirmations: { status: 'draft' }
  });
  assert.equal(result.code, 'market_profile_validation_failed');
  assert.ok(result.missing.includes('submission_pathway_change_rationale'));
});

test('reports populated fields that are incompatible with a market switch', () => {
  const fields = incompatiblePopulatedFields('FDA', 'EU MDR', { basics: { united_states_fda_product_code: 'FRN' } });
  assert.deepEqual(fields.map((field) => field.name), ['united_states_fda_product_code']);
  assert.ok(fields[0].label.includes('FDA'));
});
