import path from 'node:path';

export function selectExtractor(fileName) {
  const extension = path.extname(fileName || '').toLowerCase();
  if (extension === '.docx') return 'docx';
  if (extension === '.pdf') return 'pdf';
  if (['.png', '.jpg', '.jpeg'].includes(extension)) return 'browser_ocr';
  return null;
}

export function detectPdfContentMode({ text = '' } = {}) {
  const hasExtractableText = text.replace(/\s/g, '').length >= 20;
  return hasExtractableText
    ? { mode: 'text', browserOcrRequired: false }
    : { mode: 'scan', browserOcrRequired: true };
}

export function classifyProcessingMode({ documentType = '', translationRequested = false } = {}) {
  if (translationRequested) return 'translation_draft';
  if (/(certificate|approval|test[\s_-]*report|证书|批准|检测报告)/i.test(documentType)) return 'review_only';
  return 'revise';
}

export function recommendDocumentType({ fileName = '', textPreview = '' } = {}) {
  const evidence = `${fileName} ${textPreview}`.toLowerCase();
  if (/(risk[_\s-]*management|iso\s*14971|风险管理)/i.test(evidence)) {
    return {
      recommendedDocumentType: 'risk_management_report',
      gn02ItemCode: 'GN02-4.2',
      templateIdentifier: 'risk_management_report',
      reasoningSummary: '文件名及内容包含风险管理/ISO 14971特征。'
    };
  }
  if (/(clinical[_\s-]*evaluation|临床评价)/i.test(evidence)) {
    return {
      recommendedDocumentType: 'clinical_evaluation_report',
      gn02ItemCode: 'GN02-4.3',
      templateIdentifier: 'clinical_evaluation_report',
      reasoningSummary: '文件名及内容包含临床评价特征。'
    };
  }
  if (/(certificate|approval|证书|批准)/i.test(evidence)) {
    return {
      recommendedDocumentType: 'approval_certificate',
      gn02ItemCode: 'GN02-2.1',
      templateIdentifier: null,
      reasoningSummary: '文件名及内容包含批准或证书特征。'
    };
  }
  return {
    recommendedDocumentType: 'other_supporting_document',
    gn02ItemCode: 'GN02-PENDING',
    templateIdentifier: null,
    reasoningSummary: '未匹配到稳定模板，请人工确认文件类型与GN02项目。'
  };
}

const previewOf = (text) => String(text || '').slice(0, 4_000);
const characterCountOf = (text) => String(text || '').length;

async function defaultDocxParser({ buffer }) {
  const mammoth = await import('mammoth');
  return mammoth.extractRawText({ buffer });
}

async function defaultPdfParser(buffer) {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try { return await parser.getText(); }
  finally { await parser.destroy(); }
}

function normalizedExtractionError(error) {
  const message = `${error?.message || ''}`.toLowerCase();
  const code = /(password|encrypted)/.test(message) ? 'encrypted_file' : 'damaged_file';
  return Object.assign(new Error(code), { code });
}

export async function extractSourceContent({
  fileName,
  buffer,
  docxParser = defaultDocxParser,
  pdfParser = defaultPdfParser
}) {
  const extractor = selectExtractor(fileName);
  if (!extractor) throw Object.assign(new Error('unsupported_file_type'), { code: 'unsupported_file_type' });
  if (extractor === 'browser_ocr') {
    return {
      status: 'extracting_content',
      extraction: {
        mode: 'browser_ocr_required',
        browserOcrRequired: true,
        characterCount: 0,
        pageCount: 1,
        processedPageCount: 0,
        progressPercent: 0,
        textPreview: ''
      }
    };
  }
  try {
    if (extractor === 'docx') {
      const result = await docxParser({ buffer });
      const text = result.value || '';
      return {
        status: 'awaiting_document_type_confirmation',
        extraction: {
          mode: 'text',
          browserOcrRequired: false,
          characterCount: characterCountOf(text),
          pageCount: null,
          processedPageCount: null,
          progressPercent: 100,
          textPreview: previewOf(text)
        }
      };
    }
    const parsed = await pdfParser(buffer);
    const text = parsed.text || '';
    const pageCount = Number(parsed.total || parsed.numpages || 0);
    const mode = detectPdfContentMode({ text, pageCount });
    return {
      status: mode.browserOcrRequired ? 'extracting_content' : 'awaiting_document_type_confirmation',
      extraction: {
        mode: mode.mode,
        browserOcrRequired: mode.browserOcrRequired,
        characterCount: characterCountOf(text),
        pageCount,
        processedPageCount: mode.browserOcrRequired ? 0 : pageCount,
        progressPercent: mode.browserOcrRequired ? 0 : 100,
        textPreview: previewOf(text)
      }
    };
  } catch (error) {
    throw normalizedExtractionError(error);
  }
}

export function applyBrowserOcrPages(file, { pages = [], declaredPageCount } = {}) {
  const existingPageCount = Number(file.extraction?.pageCount) || null;
  const requestedPageCount = declaredPageCount === undefined ? existingPageCount : Number(declaredPageCount);
  if (requestedPageCount !== null && (!Number.isInteger(requestedPageCount) || requestedPageCount < 1)) {
    throw Object.assign(new Error('invalid_ocr_page_count'), { code: 'invalid_ocr_page_count' });
  }
  if (existingPageCount && requestedPageCount !== existingPageCount) {
    throw Object.assign(new Error('ocr_page_count_conflict'), { code: 'ocr_page_count_conflict' });
  }
  const pageCount = requestedPageCount;
  const byPage = new Map((file.extraction?.pages || []).map((page) => [page.pageNumber, page]));
  for (const page of pages) {
    const pageNumber = Number(page.pageNumber);
    if (!Number.isInteger(pageNumber) || pageNumber < 1 || (pageCount && pageNumber > pageCount) || typeof page.text !== 'string') {
      throw Object.assign(new Error('invalid_ocr_page'), { code: 'invalid_ocr_page' });
    }
    const existing = byPage.get(pageNumber);
    if (existing && existing.text !== page.text) {
      throw Object.assign(new Error('ocr_page_conflict'), { code: 'ocr_page_conflict' });
    }
    byPage.set(pageNumber, { pageNumber, text: page.text });
  }
  const mergedPages = [...byPage.values()].sort((left, right) => left.pageNumber - right.pageNumber);
  const processedPageCount = mergedPages.length;
  const allPagesPresent = Boolean(pageCount)
    && processedPageCount === pageCount
    && mergedPages.every(({ pageNumber }, index) => pageNumber === index + 1);
  const text = mergedPages.map(({ text: pageText }) => pageText).join('\n');
  return {
    ...file,
    status: allPagesPresent ? 'awaiting_document_type_confirmation' : 'extracting_content',
    extraction: {
      ...file.extraction,
      pageCount,
      pages: mergedPages,
      characterCount: characterCountOf(text),
      processedPageCount,
      progressPercent: pageCount ? Math.round((processedPageCount / pageCount) * 100) : 0,
      textPreview: previewOf(text)
    },
    updatedAt: new Date().toISOString()
  };
}
