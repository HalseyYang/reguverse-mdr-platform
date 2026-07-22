export const HONG_KONG_REGULATORY_REGION = '香港注册（MDACS）';
export const regulatoryRegionOptions = ['EU MDR', 'NMPA', 'FDA', 'UK MDR', HONG_KONG_REGULATORY_REGION];
export const euMdrDeviceClasses = ['Class I', 'Class Is', 'Class Im', 'Class Ir', 'Class IIa', 'Class IIb', 'Class III', 'Not determined'];
export const euMdrClassificationRules = [
  'Rule 1 - Non-invasive devices',
  'Rule 2 - Channeling or storing blood/body liquids/tissues/gases',
  'Rule 3 - Modifying biological or chemical composition',
  'Rule 4 - Non-invasive devices in contact with injured skin or mucous membrane',
  'Rule 5 - Invasive devices through body orifices',
  'Rule 6 - Surgically invasive transient use',
  'Rule 7 - Surgically invasive short-term use',
  'Rule 8 - Implantable and long-term surgically invasive devices',
  'Rule 9 - Active therapeutic devices',
  'Rule 10 - Active diagnostic and monitoring devices',
  'Rule 11 - Software',
  'Rule 12 - Other active devices',
  'Rule 13 - Devices incorporating medicinal substances',
  'Rule 14 - Devices incorporating human blood/plasma derivatives',
  'Rule 15 - Contraception or prevention of sexually transmitted diseases',
  'Rule 16 - Disinfecting, cleaning, rinsing, hydrating contact lenses/devices',
  'Rule 17 - Devices using non-viable human/animal tissues or cells',
  'Rule 18 - Blood bags',
  'Rule 19 - Nanomaterial devices',
  'Rule 20 - Invasive devices administering medicinal products by inhalation',
  'Rule 21 - Substances introduced into the body',
  'Rule 22 - Active therapeutic devices with integrated diagnostic function',
  'Other / Manual classification rationale required'
];
export const hongKongClassificationBasisOptions = [
  { value: 'RULE_2_NON_INVASIVE', label: 'Rule 2 - Non-invasive medical devices', recommendedClass: 'Class II' },
  { value: 'RULE_5_INVASIVE', label: 'Rule 5 - Invasive medical devices', recommendedClass: 'Class II' },
  { value: 'RULE_6_SURGICALLY_INVASIVE_TRANSIENT', label: 'Rule 6 - Surgically invasive devices for transient use', recommendedClass: 'Class II' },
  { value: 'RULE_7_SURGICALLY_INVASIVE_SHORT_TERM', label: 'Rule 7 - Surgically invasive devices for short-term use', recommendedClass: 'Class III' },
  { value: 'RULE_8_IMPLANTABLE_LONG_TERM', label: 'Rule 8 - Implantable and long-term surgically invasive devices', recommendedClass: 'Class IV' },
  { value: 'RULE_9_ACTIVE_THERAPEUTIC', label: 'Rule 9 - Active therapeutic medical devices', recommendedClass: 'Class II' },
  { value: 'RULE_10_ACTIVE_DIAGNOSTIC', label: 'Rule 10 - Active diagnostic medical devices', recommendedClass: 'Class II' },
  { value: 'RULE_12_OTHER_ACTIVE', label: 'Rule 12 - Other active medical devices', recommendedClass: 'Class II' }
];

export function fieldConfigurationForRegulatoryRegion(regulatoryRegion) {
  if (regulatoryRegion === HONG_KONG_REGULATORY_REGION) {
    return {
      classificationRuleLabel: '香港分类依据',
      classificationBasisOptions: hongKongClassificationBasisOptions,
      deviceClasses: ['Class II', 'Class III', 'Class IV'],
      allowsMultipleClassificationBases: false
    };
  }
  return {
    classificationRuleLabel: '分类规则',
    classificationBasisOptions: euMdrClassificationRules.map((value) => ({ value, label: value, recommendedClass: null })),
    deviceClasses: euMdrDeviceClasses,
    allowsMultipleClassificationBases: false
  };
}

export function recommendHongKongDeviceClass(classificationBasis) {
  const option = hongKongClassificationBasisOptions.find((item) => item.value === classificationBasis);
  return { recommendedClass: option?.recommendedClass ?? '', deviceClassIsEditable: true };
}
