import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { confirmDocumentType, retryFile } from './contracts.js';
import {
  applyBrowserOcrPages, classifyProcessingMode, extractSourceContent, recommendDocumentType
} from './extraction.js';
import { classifyTemplateRequirement } from './templates.js';
import { reviseSections } from './ai-revision.js';
import { createRevisionDocx, nextDraftVersion } from './docx-revision.js';
import {
  MAXIMUM_BYTE_LENGTH, MAXIMUM_FILE_COUNT_PER_UPLOAD, MAXIMUM_TOTAL_UPLOAD_BYTE_LENGTH, validateUploadBatch
} from './store.js';

function publicFile(file) {
  const { storedName, extractedStoredNames, draftsStoredNames, finalsStoredNames, ...safe } = file;
  return {
    ...safe,
    latestRevision: publicRevision(safe.latestRevision),
    revisionHistory: (safe.revisionHistory || []).map(publicRevision)
  };
}

function publicRevision(revision) {
  if (!revision) return null;
  const { storedName, checkpoints, ...safe } = revision;
  return safe;
}

function publicTask(task) {
  return { ...task, files: (task.files || []).map(publicFile) };
}

function statusFor(error) {
  if (['file_not_found', 'revision_not_found', 'hong_kong_task_not_found', 'project_not_found'].includes(error.code)) return 404;
  if (['unsupported_file_type', 'content_signature_mismatch', 'damaged_file', 'encrypted_file'].includes(error.code)) return 422;
  if (error.code === 'file_too_large' || error.code === 'LIMIT_FILE_SIZE') return 413;
  if (['too_many_files', 'upload_batch_too_large', 'LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code)) return 413;
  if (error.code?.startsWith('invalid_') || error.code === 'confirmed_document_type_required') return 400;
  if (['new_template_requires_user_approval', 'ocr_page_count_conflict'].includes(error.code)) return 409;
  return 500;
}

export function createHongKongRegistrationRouter({ store, requireProjectAccess, invokeRevisionModel, revisionModels } = {}) {
  if (!store || !requireProjectAccess) throw new TypeError('store and requireProjectAccess are required');
  const router = express.Router({ mergeParams: true });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAXIMUM_BYTE_LENGTH, files: MAXIMUM_FILE_COUNT_PER_UPLOAD, parts: MAXIMUM_FILE_COUNT_PER_UPLOAD + 8 }
  });
  const models = revisionModels || {
    flashModel: process.env.DEEPSEEK_FLASH_MODEL || 'deepseek-chat',
    proModel: process.env.DEEPSEEK_PRO_MODEL || 'deepseek-reasoner'
  };
  const invokeModel = invokeRevisionModel || (async ({ section, sourceText, model }) => {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw Object.assign(new Error('revision_service_not_configured'), { code: 'revision_service_not_configured' });
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: `Revise section "${section}" for MDACS registration. Return JSON with content and openItems. Source:\n${sourceText}` }]
      })
    });
    if (!response.ok) throw Object.assign(new Error('revision_model_failed'), { code: 'revision_model_failed' });
    return JSON.parse((await response.json()).choices[0].message.content);
  });

  router.use(async (req, res, next) => {
    try {
      const access = await requireProjectAccess(req.params.projectId);
      if (!access?.project) return res.status(404).json({ code: 'project_not_found' });
      if (access.project.deletedAt) return res.status(409).json({ code: 'project_deleted' });
      if (access.project.market !== '香港注册（MDACS）') return res.status(409).json({ code: 'project_market_not_mdacs' });
      if (!access.hasHongKongTask) return res.status(409).json({ code: 'hong_kong_task_required' });
      req.hongKongProject = access.project;
      next();
    } catch (error) { next(error); }
  });

  router.get('/task', async (req, res, next) => {
    try {
      const task = await store.getTask(req.params.projectId);
      if (!task) return res.status(404).json({ code: 'hong_kong_task_storage_not_found' });
      res.json(publicTask(task));
    } catch (error) { next(error); }
  });

  router.post('/task', async (req, res, next) => {
    try {
      const existing = await store.getTask(req.params.projectId);
      if (existing) return res.status(200).json(publicTask(existing));
      res.status(201).json(publicTask(await store.createTask(req.params.projectId)));
    } catch (error) { next(error); }
  });

  router.get('/files', async (req, res, next) => {
    try {
      const task = await store.getTask(req.params.projectId);
      if (!task) return res.status(404).json({ code: 'hong_kong_task_storage_not_found' });
      res.json({ files: task.files.map(publicFile) });
    } catch (error) { next(error); }
  });

  router.post('/files', upload.array('files'), async (req, res, next) => {
    try {
      if (!req.files?.length) return res.status(400).json({ code: 'files_required' });
      validateUploadBatch(req.files);
      const task = await store.addSourceFiles(req.params.projectId, req.files.map((file) => ({ originalName: file.originalname, buffer: file.buffer })));
      res.status(201).json(publicTask(task));
    } catch (error) { next(error); }
  });

  router.post('/files/:fileId/retry', async (req, res, next) => {
    try {
      const task = await store.mutateTask(req.params.projectId, (current) => retryFile(current, req.params.fileId));
      res.json({ file: publicFile(task.files.find((file) => file.fileId === req.params.fileId)) });
    } catch (error) { next(error); }
  });

  async function runRevision(req, res, next, retry = false) {
    try {
      const task = await store.getTask(req.params.projectId);
      const file = task?.files.find((item) => item.fileId === req.params.fileId);
      if (!file) return res.status(404).json({ code: 'file_not_found' });
      const version = nextDraftVersion(file.revisionHistory || []);
      const sections = req.body?.sections || ['identity', 'intended_use', 'regulatory_content'];
      const result = await reviseSections({
        sourceFingerprint: file.sourceFingerprint || file.fileId,
        templateIdentifier: file.templateIdentifier || req.body?.templateIdentifier || 'MDACS',
        version,
        sourceText: file.extraction?.textPreview || file.textPreview || '',
        sections,
        completedCheckpoints: retry ? (file.latestRevision?.checkpoints || {}) : {},
        invokeModel,
        models
      });
      const buffer = createRevisionDocx({
        title: file.templateIdentifier || file.originalName,
        version,
        templateMarkdown: req.body?.templateMarkdown || '',
        sections: Object.entries(result.checkpoints).map(([heading, value]) => ({ heading, content: value.content || '' })),
        openItems: result.openItems
      });
      const saved = await store.saveRevision(req.params.projectId, file.fileId, {
        version,
        revisionKey: result.revisionKey,
        checkpoints: result.checkpoints,
        openItems: result.openItems,
        canCreateFormalVersion: result.canCreateFormalVersion
      }, buffer);
      res.status(201).json({ revision: publicRevision(saved.revision) });
    } catch (error) { next(error); }
  }

  router.post('/files/:fileId/revisions', (req, res, next) => runRevision(req, res, next));
  router.post('/files/:fileId/revisions/retry', (req, res, next) => runRevision(req, res, next, true));
  router.get('/files/:fileId/revisions/latest', async (req, res, next) => {
    try {
      const task = await store.getTask(req.params.projectId);
      const file = task?.files.find((item) => item.fileId === req.params.fileId);
      if (!file) return res.status(404).json({ code: 'file_not_found' });
      if (!file.latestRevision) return res.status(404).json({ code: 'revision_not_found' });
      res.json({ revision: publicRevision(file.latestRevision) });
    } catch (error) { next(error); }
  });
  router.get('/files/:fileId/revisions/history', async (req, res, next) => {
    try {
      const task = await store.getTask(req.params.projectId);
      const file = task?.files.find((item) => item.fileId === req.params.fileId);
      if (!file) return res.status(404).json({ code: 'file_not_found' });
      res.json({ revisions: (file.revisionHistory || []).map(publicRevision) });
    } catch (error) { next(error); }
  });
  router.get('/files/:fileId/revisions/:version/download', async (req, res, next) => {
    try {
      const { revision, buffer } = await store.readRevisionArtifact(req.params.projectId, req.params.fileId, req.params.version);
      res.setHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('content-disposition', `attachment; filename="${req.params.fileId}-${revision.version}.docx"`);
      res.send(buffer);
    } catch (error) { next(error); }
  });

  router.post('/files/:fileId/extract', async (req, res, next) => {
    try {
      const current = await store.getTask(req.params.projectId);
      const source = current?.files.find((file) => file.fileId === req.params.fileId);
      if (!source) return res.status(404).json({ code: 'file_not_found' });
      if (!source.storedName || path.basename(source.storedName) !== source.storedName) {
        return res.status(422).json({ code: 'damaged_file' });
      }
      const sourcePath = path.resolve(store.root, req.params.projectId, 'sources', source.storedName);
      const result = await extractSourceContent({
        fileName: source.originalName,
        buffer: await readFile(sourcePath)
      });
      const recommendation = recommendDocumentType({
        fileName: source.originalName,
        textPreview: result.extraction.textPreview
      });
      const task = await store.mutateTask(req.params.projectId, (taskDraft) => ({
        ...taskDraft,
        files: taskDraft.files.map((file) => file.fileId === req.params.fileId
          ? { ...file, ...result, ...recommendation, updatedAt: new Date().toISOString() }
          : file),
        updatedAt: new Date().toISOString()
      }));
      res.json({ file: publicFile(task.files.find((file) => file.fileId === req.params.fileId)) });
    } catch (error) {
      if (['damaged_file', 'encrypted_file'].includes(error.code)) {
        try {
          await store.mutateTask(req.params.projectId, (taskDraft) => ({
            ...taskDraft,
            files: taskDraft.files.map((file) => file.fileId === req.params.fileId
              ? { ...file, status: 'processing_failed', failure: { code: error.code }, updatedAt: new Date().toISOString() }
              : file),
            updatedAt: new Date().toISOString()
          }));
        } catch {}
      }
      next(error);
    }
  });

  router.post('/files/:fileId/browser-ocr-pages', async (req, res, next) => {
    try {
      const task = await store.mutateTask(req.params.projectId, (taskDraft) => ({
        ...taskDraft,
        files: taskDraft.files.map((file) => file.fileId === req.params.fileId
          ? applyBrowserOcrPages(file, req.body || {})
          : file),
        updatedAt: new Date().toISOString()
      }));
      const file = task.files.find((item) => item.fileId === req.params.fileId);
      if (!file) return res.status(404).json({ code: 'file_not_found' });
      res.json({ file: publicFile(file) });
    } catch (error) { next(error); }
  });

  router.post('/files/:fileId/confirm-type', async (req, res, next) => {
    try {
      const input = req.body || {};
      const processingMode = classifyProcessingMode({
        documentType: input.confirmedDocumentType,
        translationRequested: Boolean(input.translationRequested)
      });
      const template = classifyTemplateRequirement({
        documentType: input.confirmedDocumentType,
        templateIdentifier: input.templateIdentifier ?? null,
        modifiable: processingMode !== 'review_only'
      });
      const task = await store.mutateTask(req.params.projectId, (current) => confirmDocumentType(current, req.params.fileId, {
        ...input,
        templateIdentifier: template.templateIdentifier
      }));
      res.json({ file: publicFile(task.files.find((file) => file.fileId === req.params.fileId)) });
    } catch (error) { next(error); }
  });

  router.delete('/files/:fileId', async (req, res, next) => {
    try {
      const result = await store.deleteFile(req.params.projectId, req.params.fileId);
      res.json({ ...result, task: publicTask(result.task) });
    }
    catch (error) { next(error); }
  });

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const code = error.code === 'LIMIT_FILE_SIZE' ? 'file_too_large'
      : ['LIMIT_FILE_COUNT', 'LIMIT_PART_COUNT'].includes(error.code) ? 'too_many_files'
        : (error.code || 'hong_kong_registration_error');
    const body = { code };
    if (code === 'file_too_large') body.maximumByteLength = MAXIMUM_BYTE_LENGTH;
    if (code === 'too_many_files') body.maximumFileCount = MAXIMUM_FILE_COUNT_PER_UPLOAD;
    if (code === 'upload_batch_too_large') body.maximumTotalUploadByteLength = MAXIMUM_TOTAL_UPLOAD_BYTE_LENGTH;
    res.status(statusFor(error)).json(body);
  });
  return router;
}
