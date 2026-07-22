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
