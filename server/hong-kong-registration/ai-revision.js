import { createHash } from 'node:crypto';

export function modelForRevisionStage(stage, models = {}) {
  return stage === 'substantive_revision' ? models.proModel : models.flashModel;
}

export function createRevisionKey({ sourceFingerprint, templateIdentifier, version }) {
  return createHash('sha256')
    .update(JSON.stringify([sourceFingerprint, templateIdentifier, version]))
    .digest('hex');
}

export async function reviseSections({
  sourceFingerprint,
  templateIdentifier,
  version,
  sourceText,
  sections,
  completedCheckpoints = {},
  invokeModel,
  models = {}
}) {
  const checkpoints = { ...completedCheckpoints };
  const revisionKey = createRevisionKey({ sourceFingerprint, templateIdentifier, version });

  for (const section of sections) {
    if (checkpoints[section]) continue;
    checkpoints[section] = await invokeModel({
      revisionKey,
      section,
      sourceText,
      model: modelForRevisionStage('substantive_revision', models)
    });
  }

  const openItems = Object.values(checkpoints).flatMap((checkpoint) => checkpoint.openItems ?? []);
  return {
    revisionKey,
    checkpoints,
    openItems,
    canCreateFormalVersion: openItems.length === 0
  };
}
