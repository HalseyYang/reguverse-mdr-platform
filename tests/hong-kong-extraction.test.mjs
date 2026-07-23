import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectExtractor,
  detectPdfContentMode,
  classifyProcessingMode,
  extractSourceContent,
  applyBrowserOcrPages,
  recommendDocumentType
} from '../server/hong-kong-registration/extraction.js';
import {
  HONG_KONG_TEMPLATE_REGISTRY,
  recommendTemplate,
  checkTemplateSourceAvailability
} from '../server/hong-kong-registration/templates.js';

test('selectExtractor accepts supported document and image extensions', () => {
  assert.equal(selectExtractor('submission.docx'), 'docx');
  assert.equal(selectExtractor('submission.pdf'), 'pdf');
  assert.equal(selectExtractor('photo.png'), 'browser_ocr');
  assert.equal(selectExtractor('photo.jpg'), 'browser_ocr');
  assert.equal(selectExtractor('photo.jpeg'), 'browser_ocr');
});

test('selectExtractor returns null for unsupported xlsx input', () => {
  assert.equal(selectExtractor('submission.xlsx'), null);
});

test('detectPdfContentMode distinguishes text PDFs from scanned PDFs', () => {
  assert.deepEqual(detectPdfContentMode({ text: 'A'.repeat(80), pageCount: 2 }), {
    mode: 'text',
    browserOcrRequired: false
  });
  assert.deepEqual(detectPdfContentMode({ text: ' \n ', pageCount: 3 }), {
    mode: 'scan',
    browserOcrRequired: true
  });
});

test('classifyProcessingMode keeps certificates, approvals, and test reports review-only', () => {
  for (const type of ['certificate', 'market approval', 'test report']) {
    assert.equal(classifyProcessingMode({ documentType: type }), 'review_only');
  }
});

test('classifyProcessingMode gives translation requests priority and revises other files', () => {
  assert.equal(classifyProcessingMode({ documentType: 'certificate', translationRequested: true }), 'translation_draft');
  assert.equal(classifyProcessingMode({ documentType: 'instructions for use' }), 'revise');
});

test('template registry exposes five stable identifiers with portable approved source paths', () => {
  assert.deepEqual(HONG_KONG_TEMPLATE_REGISTRY.map(({ identifier }) => identifier), [
    'MDS-01',
    'MDS-02',
    'risk_management_report',
    'clinical_evaluation_report',
    'essential_principles_checklist'
  ]);
  for (const template of HONG_KONG_TEMPLATE_REGISTRY) {
    assert.equal(template.sourceStatus, 'approved');
    assert.match(template.sourceRelativePath, /^templates[\\/]/);
    assert.equal(template.sourceRelativePath.includes('E:\\'), false);
  }
});

test('unknown modifiable document requires approval before a new template is used', () => {
  assert.deepEqual(recommendTemplate({ documentType: 'custom editable annex', modifiable: true }), {
    templateIdentifier: null,
    recommendation: 'new_template_requires_user_approval'
  });
});

test('template source existence check reports each approved relative path without exposing a configured root', async () => {
  const checked = [];
  const availability = await checkTemplateSourceAvailability(async (relativePath) => {
    checked.push(relativePath);
    return !relativePath.includes('MDS-02');
  });
  assert.equal(availability.length, 5);
  assert.equal(availability.find(({ identifier }) => identifier === 'MDS-02').available, false);
  assert.deepEqual(checked, HONG_KONG_TEMPLATE_REGISTRY.map(({ sourceRelativePath }) => sourceRelativePath));
});

test('DOCX extraction persists a bounded preview and character progress contract', async () => {
  const result = await extractSourceContent({
    fileName: 'ifu.docx',
    buffer: Buffer.from('docx'),
    docxParser: async () => ({ value: 'Instructions for use\nSterile device' })
  });
  assert.equal(result.status, 'awaiting_document_type_confirmation');
  assert.equal(result.extraction.mode, 'text');
  assert.equal(result.extraction.characterCount, 35);
  assert.equal(result.extraction.progressPercent, 100);
  assert.equal(result.extraction.textPreview, 'Instructions for use\nSterile device');
});

test('scanned PDF and images return an honest browser OCR requirement', async () => {
  const pdf = await extractSourceContent({
    fileName: 'scan.pdf',
    buffer: Buffer.from('%PDF'),
    pdfParser: async () => ({ text: '', total: 4 })
  });
  assert.equal(pdf.status, 'extracting_content');
  assert.deepEqual(pdf.extraction, {
    mode: 'scan',
    browserOcrRequired: true,
    characterCount: 0,
    pageCount: 4,
    processedPageCount: 0,
    progressPercent: 0,
    textPreview: ''
  });
  const image = await extractSourceContent({ fileName: 'label.png', buffer: Buffer.from('png') });
  assert.equal(image.extraction.mode, 'browser_ocr_required');
  assert.equal(image.extraction.browserOcrRequired, true);
});

test('browser OCR page callbacks accumulate page progress and advance only when complete', () => {
  const partial = applyBrowserOcrPages({
    extraction: { browserOcrRequired: true, pageCount: 3, pages: [] }
  }, { pages: [{ pageNumber: 1, text: 'First page' }], completed: false });
  assert.equal(partial.status, 'extracting_content');
  assert.equal(partial.extraction.processedPageCount, 1);
  assert.equal(partial.extraction.progressPercent, 33);

  const complete = applyBrowserOcrPages(partial, {
    pages: [{ pageNumber: 2, text: 'Second page' }, { pageNumber: 3, text: 'Third page' }],
    completed: true
  });
  assert.equal(complete.status, 'awaiting_document_type_confirmation');
  assert.equal(complete.extraction.processedPageCount, 3);
  assert.equal(complete.extraction.progressPercent, 100);
  assert.match(complete.extraction.textPreview, /First page/);
});

test('file recognition recommendation includes type, GN02 item, template, and concise reasoning', () => {
  assert.deepEqual(recommendDocumentType({
    fileName: 'risk_management_report.docx',
    textPreview: 'ISO 14971 risk management report'
  }), {
    recommendedDocumentType: 'risk_management_report',
    gn02ItemCode: 'GN02-4.2',
    templateIdentifier: 'risk_management_report',
    reasoningSummary: '文件名及内容包含风险管理/ISO 14971特征。'
  });
});
