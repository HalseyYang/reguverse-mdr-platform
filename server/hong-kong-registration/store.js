import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename as fsRename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addFiles } from './contracts.js';

const MAXIMUM_BYTE_LENGTH = 25 * 1024 * 1024;
const projectMutationTails = new Map();

function storageError(code, details = {}) {
  return Object.assign(new Error(code), { code, ...details });
}

function validateIdentifier(value, kind) {
  if (typeof value !== 'string' || !value || value.includes('..') || /[\\/:]/.test(value) || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw storageError(`invalid_${kind}_id`);
  }
  return value;
}

function safelyResolve(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) throw storageError('invalid_storage_path');
  return target;
}

function extension(name) { return path.extname(name || '').toLowerCase(); }
function validSignature(ext, buffer) {
  if (ext === '.pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (ext === '.png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (['.jpg', '.jpeg'].includes(ext)) return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === '.docx') return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]) && [0x04, 0x06, 0x08].includes(buffer[3]);
  return false;
}

function validateSource(file) {
  const ext = extension(file.originalName);
  if (!['.docx', '.pdf', '.png', '.jpg', '.jpeg'].includes(ext)) throw storageError('unsupported_file_type');
  if (!Buffer.isBuffer(file.buffer)) throw storageError('damaged_file');
  if (file.buffer.length > MAXIMUM_BYTE_LENGTH) throw storageError('file_too_large', { maximumByteLength: MAXIMUM_BYTE_LENGTH });
  if (!validSignature(ext, file.buffer)) throw storageError('content_signature_mismatch');
  return ext;
}

export function createHongKongRegistrationStore({ dataRoot = path.resolve('data'), rename = fsRename } = {}) {
  const root = safelyResolve(dataRoot, 'hong_kong_registration');
  const projectDirectory = (projectId) => safelyResolve(root, validateIdentifier(projectId, 'project'));
  const taskPath = (projectId) => safelyResolve(projectDirectory(projectId), 'task.json');

  async function ensureLayout(projectId) {
    const directory = projectDirectory(projectId);
    await Promise.all(['sources', 'extracted', 'drafts', 'finals'].map((name) => mkdir(safelyResolve(directory, name), { recursive: true })));
    return directory;
  }

  async function atomicWrite(projectId, task) {
    const directory = await ensureLayout(projectId);
    const temporary = safelyResolve(directory, `.task.json.tmp-${randomBytes(8).toString('hex')}`);
    try {
      await writeFile(temporary, `${JSON.stringify(task, null, 2)}\n`, { flag: 'wx' });
      await rename(temporary, taskPath(projectId));
    } finally { await rm(temporary, { force: true }); }
  }

  async function getTask(projectId) {
    validateIdentifier(projectId, 'project');
    try { return JSON.parse(await readFile(taskPath(projectId), 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }

  function serialize(projectId, operation) {
    validateIdentifier(projectId, 'project');
    const previous = projectMutationTails.get(`${root}:${projectId}`) || Promise.resolve();
    const current = previous.then(operation);
    projectMutationTails.set(`${root}:${projectId}`, current.catch(() => {}));
    return current;
  }

  async function createTask(projectId) {
    return serialize(projectId, async () => {
      const existing = await getTask(projectId);
      if (existing) return existing;
      const now = new Date().toISOString();
      const task = { projectId, status: 'awaiting_upload', files: [], createdAt: now, updatedAt: now };
      await atomicWrite(projectId, task);
      return task;
    });
  }

  async function mutateTask(projectId, mutator) {
    return serialize(projectId, async () => {
      const current = await getTask(projectId);
      if (!current) throw storageError('hong_kong_task_not_found');
      const next = await mutator(structuredClone(current));
      await atomicWrite(projectId, next);
      return next;
    });
  }

  async function addSourceFiles(projectId, files) {
    files.map(validateSource);
    return serialize(projectId, async () => {
      const current = await getTask(projectId);
      if (!current) throw storageError('hong_kong_task_not_found');
      const directory = await ensureLayout(projectId);
      const prepared = files.map((file) => {
        const ext = extension(file.originalName);
        const storedName = `${randomBytes(16).toString('hex')}${ext}`;
        return { ...file, storedName, temporaryPath: safelyResolve(directory, 'sources', `.${storedName}.tmp`), finalPath: safelyResolve(directory, 'sources', storedName) };
      });
      try {
        for (const file of prepared) await writeFile(file.temporaryPath, file.buffer, { flag: 'wx' });
        for (const file of prepared) await rename(file.temporaryPath, file.finalPath);
        const next = addFiles(current, prepared.map(({ originalName, storedName }) => ({ originalName, storedName })));
        await atomicWrite(projectId, next);
        return next;
      } catch (error) {
        await Promise.all(prepared.flatMap((file) => [rm(file.temporaryPath, { force: true }), rm(file.finalPath, { force: true })]));
        throw error;
      }
    });
  }

  async function deleteFile(projectId, fileId) {
    validateIdentifier(fileId, 'file');
    return serialize(projectId, async () => {
      const task = await getTask(projectId);
      if (!task) throw storageError('hong_kong_task_not_found');
      const file = task.files.find((item) => item.fileId === fileId);
      if (!file) throw storageError('file_not_found');
      for (const directory of ['sources', 'extracted', 'drafts', 'finals']) {
        for (const storedName of [file.storedName, ...(file[`${directory}StoredNames`] || [])].filter(Boolean)) {
          if (path.basename(storedName) !== storedName) throw storageError('invalid_storage_record');
          await rm(safelyResolve(projectDirectory(projectId), directory, storedName), { force: true });
        }
      }
      const next = { ...task, files: task.files.filter((item) => item.fileId !== fileId), updatedAt: new Date().toISOString() };
      await atomicWrite(projectId, next);
      return { task: next, deletedFileId: fileId, originalRemoved: Boolean(file.storedName) };
    });
  }

  async function cleanupProjectStorage(projectId) { await rm(projectDirectory(projectId), { recursive: true, force: true }); }
  function collectProjectStorage(projectId) { return { projectId: validateIdentifier(projectId, 'project'), directory: projectDirectory(projectId) }; }

  return { root, createTask, getTask, mutateTask, addSourceFiles, deleteFile, cleanupProjectStorage, collectProjectStorage };
}

export { MAXIMUM_BYTE_LENGTH };
