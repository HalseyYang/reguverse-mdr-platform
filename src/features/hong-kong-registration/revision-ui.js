export function latestRevisionFrom(file = {}) {
  if (file.latestRevision) return file.latestRevision;
  const history = file.revisionHistory || [];
  return history[history.length - 1] || null;
}

export function countOpenItems(revision) {
  return Array.isArray(revision?.openItems) ? revision.openItems.length : 0;
}

export function isRevisionReady(file = {}) {
  return Boolean(file.confirmedDocumentType)
    && ['revising_sections', 'revision_completed', 'awaiting_user_confirmation', 'ready_for_formal_version'].includes(file.status);
}

export function revisionDownloadPath(base, fileId, version) {
  return `${base}/files/${encodeURIComponent(fileId)}/revisions/${encodeURIComponent(version)}/download`;
}
