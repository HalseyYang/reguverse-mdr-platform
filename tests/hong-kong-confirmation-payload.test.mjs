import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocumentTypeConfirmationPayload } from '../src/features/hong-kong-registration/confirmation-payload.js';

test('document type confirmation submits the user-edited type instead of the recommendation', () => {
  assert.deepEqual(buildDocumentTypeConfirmationPayload({
    confirmedDocumentType: 'user_selected_test_report',
    recommendedDocumentType: 'risk_management_report',
    gn02ItemCode: 'GN02-5.1',
    templateIdentifier: null,
    reasoningSummary: 'AI recommendation'
  }), {
    confirmedDocumentType: 'user_selected_test_report',
    recommendedDocumentType: 'risk_management_report',
    gn02ItemCode: 'GN02-5.1',
    templateIdentifier: null,
    reasoningSummary: 'AI recommendation'
  });
});

test('document type confirmation falls back to recommendation when no edited type exists', () => {
  assert.equal(buildDocumentTypeConfirmationPayload({
    confirmedDocumentType: '',
    recommendedDocumentType: 'clinical_evaluation_report'
  }).confirmedDocumentType, 'clinical_evaluation_report');
});
