# CE MDR Classification Logic

This document summarizes the CE MDR classification logic intended for the Medical Device Classifier in the AI Tools page.

## Objective

Determine the device class under Regulation (EU) 2017/745 Annex VIII:

- Class I
- Class IIa
- Class IIb
- Class III

For Class I devices, the system should also identify whether additional flags may apply:

- Is: sterile
- Im: measuring function
- Ir: reusable surgical instrument

## Core Principles

Classification should not be based on product name alone.

The system should first extract regulatory attributes, then screen all applicable classification rules, then select the highest-risk applicable result.

## Required Inputs

- Whether the product is within MDR scope
- Whether it is an IVD
- Intended purpose
- Indications
- Target patient population
- Intended user
- Use environment
- Invasive route
- Contact site
- Duration of use
- Whether it is implantable
- Whether it is active
- Whether it is software
- Energy type and whether energy may be hazardous
- Whether it administers or removes substances
- Whether it contains medicinal substances, animal or human tissues, nanomaterials, or absorbed substances

## Rule Screening Logic

The classifier should screen all MDR Annex VIII rules:

- Rule 1 to Rule 4: non-invasive devices
- Rule 5 to Rule 8: invasive and implantable devices
- Rule 9 to Rule 13: active devices and software
- Rule 14 to Rule 22: special rules

If multiple rules apply, the highest class controls.

```text
Class I   = 1
Class IIa = 2
Class IIb = 3
Class III = 4

Final class = highest applicable candidate class
```

## Example 1: High-Frequency Endoscopic Surgical Instrument

Candidate results:

- Rule 6: transient surgically invasive device, candidate Class IIa
- Rule 9: active therapeutic device administering high-frequency energy in a potentially hazardous way, candidate Class IIb

Final result:

- Class IIb
- Controlling rule: Rule 9

## Example 2: Endoscopic Suturing Instrument

Candidate result:

- Rule 6: transient surgically invasive device, candidate Class IIa

If the product is not active, does not administer hazardous energy, does not directly contact the heart, central circulatory system, or central nervous system, and does not include implantable components, the final result is usually:

- Class IIa
- Controlling rule: Rule 6

## Output Requirements

The classifier should output:

- Final class
- Controlling rule
- Candidate rules
- Excluded rules
- Rationale
- Information gaps
- Regulatory basis

The result should remain a decision-support output and should require human regulatory review.
