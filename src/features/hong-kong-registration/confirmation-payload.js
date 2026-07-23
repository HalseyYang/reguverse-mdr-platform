export function buildDocumentTypeConfirmationPayload(file) {
  return {
    confirmedDocumentType: file.confirmedDocumentType || file.recommendedDocumentType,
    recommendedDocumentType: file.recommendedDocumentType,
    gn02ItemCode: file.gn02ItemCode,
    templateIdentifier: file.templateIdentifier,
    reasoningSummary: file.reasoningSummary
  };
}
