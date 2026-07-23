import express from 'express';
import multer from 'multer';
import { confirmDocumentType, retryFile } from './contracts.js';
import { MAXIMUM_BYTE_LENGTH } from './store.js';

function publicFile(file) {
  const { storedName, extractedStoredNames, draftsStoredNames, finalsStoredNames, ...safe } = file;
  return safe;
}

function publicTask(task) {
  return { ...task, files: (task.files || []).map(publicFile) };
}

function statusFor(error) {
  if (['file_not_found', 'hong_kong_task_not_found', 'project_not_found'].includes(error.code)) return 404;
  if (['unsupported_file_type', 'content_signature_mismatch', 'damaged_file', 'encrypted_file'].includes(error.code)) return 422;
  if (error.code === 'file_too_large' || error.code === 'LIMIT_FILE_SIZE') return 413;
  if (error.code?.startsWith('invalid_') || error.code === 'confirmed_document_type_required') return 400;
  return 500;
}

export function createHongKongRegistrationRouter({ store, requireProjectAccess }) {
  if (!store || !requireProjectAccess) throw new TypeError('store and requireProjectAccess are required');
  const router = express.Router({ mergeParams: true });
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAXIMUM_BYTE_LENGTH } });

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
      const task = await store.getTask(req.params.projectId) || await store.createTask(req.params.projectId);
      res.json(publicTask(task));
    } catch (error) { next(error); }
  });

  router.get('/files', async (req, res, next) => {
    try {
      const task = await store.getTask(req.params.projectId) || await store.createTask(req.params.projectId);
      res.json({ files: task.files.map(publicFile) });
    } catch (error) { next(error); }
  });

  router.post('/files', upload.array('files'), async (req, res, next) => {
    try {
      if (!req.files?.length) return res.status(400).json({ code: 'files_required' });
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

  router.post('/files/:fileId/confirm-type', async (req, res, next) => {
    try {
      const task = await store.mutateTask(req.params.projectId, (current) => confirmDocumentType(current, req.params.fileId, req.body || {}));
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
    const code = error.code === 'LIMIT_FILE_SIZE' ? 'file_too_large' : (error.code || 'hong_kong_registration_error');
    const body = { code };
    if (code === 'file_too_large') body.maximumByteLength = MAXIMUM_BYTE_LENGTH;
    res.status(statusFor(error)).json(body);
  });
  return router;
}
