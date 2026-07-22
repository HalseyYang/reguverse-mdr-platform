const PROJECT_COLLECTIONS = ['tasks', 'steps', 'files', 'profileExtractions', 'documents', 'deviceProfiles'];

function cloneDb(db) {
  return structuredClone(db);
}

function requireProject(db, id) {
  const project = db.projects?.find((item) => item.id === id);
  if (!project) throw new Error(`Project not found: ${id}`);
  return project;
}

function parseNow(now) {
  const date = now instanceof Date ? new Date(now) : new Date(now ?? Date.now());
  if (Number.isNaN(date.valueOf())) throw new Error('Invalid lifecycle timestamp');
  return date;
}

export function listActiveProjects(db) {
  return (db.projects || []).filter((project) => !project.deletedAt).map((project) => structuredClone(project));
}

export function listDeletedProjects(db) {
  return (db.projects || []).filter((project) => project.deletedAt).map((project) => ({
    ...structuredClone(project),
    fileCount: (db.files || []).filter((file) => file.projectId === project.id).length
  }));
}

export function softDeleteProject(db, id, now) {
  const next = cloneDb(db);
  const project = requireProject(next, id);
  if (project.deletedAt) throw new Error(`Project already deleted: ${id}`);
  const deletedAt = parseNow(now);
  const purgeAt = new Date(deletedAt);
  purgeAt.setUTCDate(purgeAt.getUTCDate() + 30);
  project.deletedAt = deletedAt.toISOString();
  project.purgeAt = purgeAt.toISOString();
  return { db: next, project: structuredClone(project), fileCount: (next.files || []).filter((file) => file.projectId === id).length };
}

export function restoreProject(db, id) {
  const next = cloneDb(db);
  const project = requireProject(next, id);
  if (!project.deletedAt) throw new Error(`Project is not deleted: ${id}`);
  if (project.purgePendingAt) throw new Error(`Project purge is pending: ${id}`);
  delete project.deletedAt;
  delete project.purgeAt;
  return { db: next, project: structuredClone(project), fileCount: (next.files || []).filter((file) => file.projectId === id).length };
}

export function purgeProject(db, id) {
  const next = cloneDb(db);
  const project = requireProject(next, id);
  if (!project.deletedAt) throw new Error(`Project must be soft-deleted before permanent deletion: ${id}`);
  const projectFiles = (next.files || []).filter((file) => file.projectId === id);
  next.projects = next.projects.filter((item) => item.id !== id);
  for (const key of PROJECT_COLLECTIONS) next[key] = (next[key] || []).filter((item) => item.projectId !== id);
  next.events = (next.events || []).filter((item) => item.meta?.projectId !== id);
  return {
    db: next,
    project: structuredClone(project),
    fileCount: projectFiles.length,
    uploadReferences: projectFiles.map((file) => file.storedName).filter(Boolean)
  };
}

export async function purgeProjectSafely(db, id, deleteUploads) {
  const purged = purgeProject(db, id);
  await deleteUploads(purged.uploadReferences);
  return purged;
}

export async function purgeProjectTwoPhase(db, id, { readDb, writeDb, deleteUploads, now }) {
  let pendingDb = cloneDb(db);
  const project = requireProject(pendingDb, id);
  if (!project.deletedAt) throw new Error(`Project must be soft-deleted before permanent deletion: ${id}`);
  if (!project.purgePendingAt) {
    project.purgePendingAt = parseNow(now).toISOString();
    project.pendingStoredNames = (pendingDb.files || [])
      .filter((file) => file.projectId === id)
      .map((file) => file.storedName)
      .filter(Boolean);
    await writeDb(pendingDb);
  }
  await deleteUploads(project.pendingStoredNames || []);
  const latestDb = readDb ? await readDb() : pendingDb;
  const latestProject = requireProject(latestDb, id);
  if (!latestProject.deletedAt || latestProject.purgePendingAt !== project.purgePendingAt) {
    throw new Error(`Project purge state changed: ${id}`);
  }
  const purged = purgeProject(latestDb, id);
  await writeDb(purged.db);
  return purged;
}

export async function finalizeProjectUpload({ projectId, file, readDb, writeDb, deleteUploads, beforeWrite }) {
  const db = await readDb();
  const project = db.projects?.find((item) => item.id === projectId);
  if (!project || project.deletedAt) {
    await deleteUploads([file.storedName].filter(Boolean));
    if (!project) throw new Error(`Project not found: ${projectId}`);
    throw new Error(`Project is deleted: ${projectId}`);
  }
  const next = cloneDb(db);
  next.files ||= [];
  next.files.unshift(structuredClone(file));
  beforeWrite?.(next);
  try {
    await writeDb(next);
  } catch (error) {
    await deleteUploads([file.storedName].filter(Boolean));
    throw error;
  }
  return { db: next, file: structuredClone(file) };
}

export function purgeExpiredProjects(db, now) {
  const cutoff = parseNow(now);
  let next = cloneDb(db);
  const expiredIds = (next.projects || [])
    .filter((project) => project.deletedAt && new Date(project.purgeAt || project.deletedAt) <= cutoff)
    .map((project) => project.id);
  const uploadReferences = [];
  for (const id of expiredIds) {
    const purged = purgeProject(next, id);
    next = purged.db;
    uploadReferences.push(...purged.uploadReferences);
  }
  return { db: next, purgedProjectIds: expiredIds, uploadReferences };
}

export function prepareDeletedProjects(db, now) {
  const purged = purgeExpiredProjects(db, now);
  return { ...purged, projects: listDeletedProjects(purged.db) };
}

export const listActive = listActiveProjects;
export const listDeleted = listDeletedProjects;
export const restore = restoreProject;
