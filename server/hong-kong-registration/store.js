import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename as fsRename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { addFiles } from './contracts.js';

const MAXIMUM_BYTE_LENGTH = 25 * 1024 * 1024;
const MAXIMUM_FILE_COUNT_PER_UPLOAD = 4;
const MAXIMUM_TOTAL_UPLOAD_BYTE_LENGTH = 100 * 1024 * 1024;
const MAXIMUM_ZIP_ENTRY_COUNT = 2_048;
const MAXIMUM_ZIP_ENTRY_UNCOMPRESSED_BYTE_LENGTH = 64 * 1024 * 1024;
const MAXIMUM_ZIP_TOTAL_UNCOMPRESSED_BYTE_LENGTH = 256 * 1024 * 1024;
const MAXIMUM_ZIP_COMPRESSION_RATIO = 1_000;
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

function validateRevisionVersion(value) {
  if (typeof value !== 'string' || !/^v\d+\.\d+$/.test(value)) throw storageError('invalid_revision_version');
  return value;
}

function safelyResolve(root, ...segments) {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) throw storageError('invalid_storage_path');
  return target;
}

function extension(name) { return path.extname(name || '').toLowerCase(); }
function zipCentralDirectoryEntryNames(buffer) {
  const minimumEndOffset = Math.max(0, buffer.length - 65_557);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimumEndOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { endOffset = offset; break; }
  }
  if (endOffset < 0) return null;
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  if (entryCount > MAXIMUM_ZIP_ENTRY_COUNT) return null;
  const centralDirectoryLength = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectoryLength;
  if (centralDirectoryEnd > endOffset || centralDirectoryEnd > buffer.length) return null;
  const names = new Set();
  let totalUncompressedByteLength = 0;
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > centralDirectoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50) return null;
    const flags = buffer.readUInt16LE(offset + 8);
    if (flags & 0x0001) throw storageError('encrypted_file');
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    if (![0, 8].includes(compressionMethod)) return null;
    const checksum = buffer.readUInt32LE(offset + 16);
    const compressedLength = buffer.readUInt32LE(offset + 20);
    const uncompressedLength = buffer.readUInt32LE(offset + 24);
    if (uncompressedLength > MAXIMUM_ZIP_ENTRY_UNCOMPRESSED_BYTE_LENGTH) return null;
    totalUncompressedByteLength += uncompressedLength;
    if (totalUncompressedByteLength > MAXIMUM_ZIP_TOTAL_UNCOMPRESSED_BYTE_LENGTH) return null;
    if (compressedLength === 0 ? uncompressedLength > 0 : uncompressedLength / compressedLength > MAXIMUM_ZIP_COMPRESSION_RATIO) return null;
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + nameLength + extraLength + commentLength;
    if (nextOffset > centralDirectoryEnd) return null;
    const entryName = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8').replaceAll('\\', '/');
    if (!entryName || entryName.includes('\0') || entryName.startsWith('/') || /^[A-Za-z]:/.test(entryName)
      || entryName.split('/').some((segment) => segment === '..') || names.has(entryName)) return null;
    if (localHeaderOffset + 30 > centralDirectoryOffset || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) return null;
    const localFlags = buffer.readUInt16LE(localHeaderOffset + 6);
    if (localFlags & 0x0001) throw storageError('encrypted_file');
    const localCompressionMethod = buffer.readUInt16LE(localHeaderOffset + 8);
    if (localCompressionMethod !== compressionMethod || ((localFlags ^ flags) & 0x0009)) return null;
    const localChecksum = buffer.readUInt32LE(localHeaderOffset + 14);
    const localCompressedLength = buffer.readUInt32LE(localHeaderOffset + 18);
    const localUncompressedLength = buffer.readUInt32LE(localHeaderOffset + 22);
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const localDataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (localDataOffset + compressedLength > centralDirectoryOffset) return null;
    const usesDataDescriptor = Boolean(flags & 0x0008);
    if (!usesDataDescriptor && (localChecksum !== checksum || localCompressedLength !== compressedLength || localUncompressedLength !== uncompressedLength)) return null;
    if (usesDataDescriptor && ((localChecksum && localChecksum !== checksum)
      || (localCompressedLength && localCompressedLength !== compressedLength)
      || (localUncompressedLength && localUncompressedLength !== uncompressedLength))) return null;
    const localName = buffer.subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLength).toString('utf8').replaceAll('\\', '/');
    if (localName !== entryName) return null;
    names.add(entryName);
    offset = nextOffset;
  }
  return offset === centralDirectoryEnd ? names : null;
}

function validSignature(ext, buffer) {
  if (ext === '.pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (ext === '.png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (['.jpg', '.jpeg'].includes(ext)) return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === '.docx') {
    const entries = zipCentralDirectoryEntryNames(buffer);
    return Boolean(entries?.has('[Content_Types].xml') && entries.has('word/document.xml'));
  }
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

export function validateUploadBatch(files) {
  if (files.length > MAXIMUM_FILE_COUNT_PER_UPLOAD) throw storageError('too_many_files', { maximumFileCount: MAXIMUM_FILE_COUNT_PER_UPLOAD });
  const totalByteLength = files.reduce((total, file) => total + Number(file.buffer?.length || 0), 0);
  if (totalByteLength > MAXIMUM_TOTAL_UPLOAD_BYTE_LENGTH) {
    throw storageError('upload_batch_too_large', { maximumTotalUploadByteLength: MAXIMUM_TOTAL_UPLOAD_BYTE_LENGTH });
  }
}

export function createHongKongRegistrationStore({ dataRoot = path.resolve('data'), rename = fsRename, remove = rm } = {}) {
  const root = safelyResolve(dataRoot, 'hong_kong_registration');
  const deletedProjectStorage = new Set();
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

  async function readTask(projectId) {
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

  async function getTask(projectId) {
    return serialize(projectId, () => readTask(projectId));
  }

  async function createTask(projectId) {
    return serialize(projectId, async () => {
      if (deletedProjectStorage.has(projectId)) throw storageError('project_storage_deleted');
      const existing = await readTask(projectId);
      if (existing) return existing;
      const now = new Date().toISOString();
      const task = { projectId, status: 'awaiting_upload', files: [], createdAt: now, updatedAt: now };
      await atomicWrite(projectId, task);
      return task;
    });
  }

  async function mutateTask(projectId, mutator) {
    return serialize(projectId, async () => {
      if (deletedProjectStorage.has(projectId)) throw storageError('project_storage_deleted');
      const current = await readTask(projectId);
      if (!current) throw storageError('hong_kong_task_not_found');
      const next = await mutator(structuredClone(current));
      await atomicWrite(projectId, next);
      return next;
    });
  }

  async function addSourceFiles(projectId, files) {
    validateUploadBatch(files);
    files.map(validateSource);
    return serialize(projectId, async () => {
      if (deletedProjectStorage.has(projectId)) throw storageError('project_storage_deleted');
      const now = new Date().toISOString();
      const current = await readTask(projectId) || { projectId, status: 'awaiting_upload', files: [], createdAt: now, updatedAt: now };
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
      let task = await readTask(projectId);
      if (!task) throw storageError('hong_kong_task_not_found');
      let file = task.files.find((item) => item.fileId === fileId);
      if (!file) throw storageError('file_not_found');
      let deletionToken = file.deletionToken;
      let controlledNames = file.pendingControlledStoredNames;
      if (file.status !== 'deletion_pending') {
        deletionToken = randomBytes(16).toString('hex');
        controlledNames = {
          sources: [file.storedName].filter(Boolean),
          extracted: file.extractedStoredNames || [],
          drafts: file.draftsStoredNames || [],
          finals: file.finalsStoredNames || []
        };
        const pendingTask = structuredClone(task);
        const pendingFile = pendingTask.files.find((item) => item.fileId === fileId);
        pendingFile.status = 'deletion_pending';
        pendingFile.deletionToken = deletionToken;
        pendingFile.pendingControlledStoredNames = structuredClone(controlledNames);
        pendingFile.updatedAt = new Date().toISOString();
        pendingTask.updatedAt = pendingFile.updatedAt;
        await atomicWrite(projectId, pendingTask);
      }
      for (const [directory, storedNames] of Object.entries(controlledNames)) {
        for (const storedName of storedNames) {
          if (path.basename(storedName) !== storedName) throw storageError('invalid_storage_record');
          await remove(safelyResolve(projectDirectory(projectId), directory, storedName), { force: true });
        }
      }
      task = await readTask(projectId);
      file = task?.files.find((item) => item.fileId === fileId);
      if (!file || file.status !== 'deletion_pending' || file.deletionToken !== deletionToken) throw storageError('file_deletion_state_changed');
      const next = { ...task, files: task.files.filter((item) => item.fileId !== fileId), updatedAt: new Date().toISOString() };
      await atomicWrite(projectId, next);
      return { task: next, deletedFileId: fileId, originalRemoved: Boolean(file.storedName) };
    });
  }

  async function cleanupProjectStorage(projectId) {
    return serialize(projectId, async () => {
      deletedProjectStorage.add(projectId);
      await remove(projectDirectory(projectId), { recursive: true, force: true });
    });
  }
  async function saveRevision(projectId, fileId, revision, buffer) {
    validateIdentifier(fileId, 'file');
    return serialize(projectId, async () => {
      const task = await readTask(projectId);
      if (!task) throw storageError('hong_kong_task_not_found');
      const file = task.files.find((item) => item.fileId === fileId);
      if (!file) throw storageError('file_not_found');
      validateRevisionVersion(revision.version);
      const storedName = `${fileId}-${revision.version}.docx`;
      const directory = await ensureLayout(projectId);
      await writeFile(safelyResolve(directory, 'drafts', storedName), buffer);
      const now = new Date().toISOString();
      const record = { ...revision, storedName, createdAt: revision.createdAt || now };
      const history = [...(file.revisionHistory || []).filter((item) => item.version !== record.version), record];
      file.revisionHistory = history;
      file.latestRevision = record;
      file.draftsStoredNames = [...new Set([...(file.draftsStoredNames || []), storedName])];
      file.status = 'revision_completed';
      file.updatedAt = now;
      task.updatedAt = now;
      await atomicWrite(projectId, task);
      return { task, revision: record };
    });
  }

  async function readRevisionArtifact(projectId, fileId, version) {
    validateIdentifier(fileId, 'file');
    validateRevisionVersion(version);
    const task = await getTask(projectId);
    const file = task?.files.find((item) => item.fileId === fileId);
    if (!file) throw storageError('file_not_found');
    const revision = (file.revisionHistory || []).find((item) => item.version === version);
    if (!revision) throw storageError('revision_not_found');
    if (path.basename(revision.storedName) !== revision.storedName) throw storageError('invalid_storage_record');
    return { revision, buffer: await readFile(safelyResolve(projectDirectory(projectId), 'drafts', revision.storedName)) };
  }

  function collectProjectStorage(projectId) { return { projectId: validateIdentifier(projectId, 'project'), directory: projectDirectory(projectId) }; }

  return {
    root, createTask, getTask, mutateTask, addSourceFiles, deleteFile, saveRevision,
    readRevisionArtifact, cleanupProjectStorage, collectProjectStorage
  };
}

export { MAXIMUM_BYTE_LENGTH, MAXIMUM_FILE_COUNT_PER_UPLOAD, MAXIMUM_TOTAL_UPLOAD_BYTE_LENGTH };
