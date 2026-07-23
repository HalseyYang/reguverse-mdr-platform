import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HONG_KONG_REGULATORY_REGION,
  fieldConfigurationForRegulatoryRegion,
  recommendHongKongDeviceClass,
  regulatoryRegionOptions
} from '../src/features/hong-kong-registration/regulatory-options.js';

test('Hong Kong registration is an available regulatory region', () => {
  assert.ok(regulatoryRegionOptions.includes(HONG_KONG_REGULATORY_REGION));
});

test('Hong Kong registration changes the classification field contract', () => {
  const configuration = fieldConfigurationForRegulatoryRegion(HONG_KONG_REGULATORY_REGION);

  assert.equal(configuration.classificationRuleLabel, '香港分类依据');
  assert.deepEqual(configuration.deviceClasses, ['Class II', 'Class III', 'Class IV']);
  assert.equal(configuration.allowsMultipleClassificationBases, false);
});

test('Hong Kong classification basis recommends but does not lock the device class', () => {
  const recommendation = recommendHongKongDeviceClass('RULE_2_NON_INVASIVE');

  assert.equal(recommendation.recommendedClass, 'Class II');
  assert.equal(recommendation.deviceClassIsEditable, true);
});

test('EU MDR retains its existing classification labels and options', () => {
  const configuration = fieldConfigurationForRegulatoryRegion('EU MDR');

  assert.equal(configuration.classificationRuleLabel, '分类规则');
  assert.ok(configuration.deviceClasses.includes('Class I'));
  assert.ok(configuration.classificationBasisOptions.some((option) => option.value === 'Rule 1 - Non-invasive devices'));
});
