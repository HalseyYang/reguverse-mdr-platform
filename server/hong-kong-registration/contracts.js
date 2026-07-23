import { randomUUID } from 'node:crypto';

export const HONG_KONG_DOCUMENT_REVISION_PHASES = Object.freeze([
  { key: 'upload_files', label: '上传文件' },
  { key: 'identify_files', label: '文件识别' },
  { key: 'confirm_document_type_and_template', label: '文件类型与模板确认' },
  { key: 'review_and_revise_hong_kong_requirements', label: '香港要求审查与修订' },
  { key: 'pending_confirmations', label: '待确认项' },
  { key: 'docx_version_and_download', label: 'DOCX版本与下载' }
]);

export const HONG_KONG_DOCUMENT_REVISION_STATUSES = Object.freeze([
  'awaiting_upload', 'extracting_content', 'awaiting_document_type_confirmation',
  'revising_sections', 'awaiting_user_confirmation', 'ready_for_formal_version',
  'completed', 'processing_failed'
]);

function updateFile(task, fileId, updater) {
  let found = false;
  const files = (task.files || []).map((file) => {
    if (file.fileId !== fileId) return structuredClone(file);
    found = true;
    if (file.status === 'deletion_pending') throw Object.assign(new Error('file_deletion_pending'), { code: 'file_deletion_pending' });
    return updater(structuredClone(file));
  });
  if (!found) throw Object.assign(new Error('file_not_found'), { code: 'file_not_found' });
  return { ...structuredClone(task), files, updatedAt: new Date().toISOString() };
}

export function addFiles(task, files) {
  const now = new Date().toISOString();
  return {
    ...structuredClone(task),
    files: [...(task.files || []).map((file) => structuredClone(file)), ...files.map((file) => ({
      fileId: file.fileId || `hk-file-${randomUUID()}`,
      originalName: file.originalName,
      storedName: file.storedName || null,
      status: 'extracting_content',
      processingMode: file.processingMode || 'revise',
      createdAt: now,
      updatedAt: now
    }))],
    updatedAt: now
  };
}

export function markFileFailed(task, fileId, failure) {
  return updateFile(task, fileId, (file) => ({ ...file, status: 'processing_failed', failure: structuredClone(failure), updatedAt: new Date().toISOString() }));
}

export function retryFile(task, fileId) {
  return updateFile(task, fileId, (file) => {
    const next = { ...file, status: 'extracting_content', updatedAt: new Date().toISOString() };
    delete next.failure;
    return next;
  });
}

function processingModeFor(input) {
  const type = `${input.confirmedDocumentType || ''} ${input.recommendedDocumentType || ''}`.toLowerCase();
  if (input.translationRequested) return 'translation_draft';
  if (/(certificate|approval|test_report|证书|批准|检测报告)/i.test(type)) return 'review_only';
  return 'revise';
}

export function confirmDocumentType(task, fileId, input) {
  if (!input.confirmedDocumentType) throw Object.assign(new Error('confirmed_document_type_required'), { code: 'confirmed_document_type_required' });
  return updateFile(task, fileId, (file) => ({
    ...file,
    recommendedDocumentType: input.recommendedDocumentType || null,
    confirmedDocumentType: input.confirmedDocumentType,
    templateIdentifier: input.templateIdentifier ?? null,
    gn02ItemCode: input.gn02ItemCode ?? input.gn02Item ?? null,
    reasoningSummary: input.reasoningSummary ?? file.reasoningSummary ?? null,
    processingMode: processingModeFor(input),
    status: 'revising_sections',
    updatedAt: new Date().toISOString()
  }));
}
