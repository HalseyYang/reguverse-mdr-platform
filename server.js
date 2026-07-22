import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  listActiveProjects,
  prepareDeletedProjects,
  purgeExpiredProjects,
  purgeProject,
  restoreProject,
  softDeleteProject
} from './server/project-lifecycle.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const uploadDir = path.join(dataDir, 'uploads');
const dbPath = path.join(dataDir, 'db.json');
const envPath = path.join(__dirname, '.env');

try {
  process.loadEnvFile?.(envPath);
} catch {
  // Local AI configuration is optional; rule-based extraction works without .env.
}

const app = express();
const upload = multer({ dest: uploadDir });

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const seed = {
  projects: [
    {
      id: 'eu-cer',
      title: 'EU MDR CER - Kranus Mictera',
      product: 'Kranus Mictera',
      market: 'EU MDR',
      deviceClass: 'Class I',
      manufacturer: 'Kranus Health GmbH',
      status: 'Step 4 文献筛选',
      progress: 40
    },
    {
      id: 'nmpa-reg',
      title: 'NMPA Import Registration - Infusion Pump',
      product: 'Smart Infusion Pump',
      market: 'NMPA',
      deviceClass: 'II',
      manufacturer: 'Acme MedTech GmbH',
      status: 'eRPS章节准备',
      progress: 37
    },
    {
      id: 'gspr-risk',
      title: 'GSPR + ISO 14971 Gap Assessment',
      product: 'Surgical Navigation Software',
      market: 'EU MDR',
      deviceClass: 'IIb',
      manufacturer: 'Acme Digital Health',
      status: '风险控制审阅',
      progress: 48
    }
  ],
  tasks: [
    { id: 'ce', projectId: 'eu-cer', title: 'Clinical Evaluation', status: 'in_progress', progress: 40 },
    { id: 'gspr', projectId: 'eu-cer', title: 'GSPR Analysis', status: 'not_started', progress: 0 },
    { id: 'risk', projectId: 'eu-cer', title: 'Risk Management', status: 'draft', progress: 12 }
  ],
  steps: [
    { id: '1', projectId: 'eu-cer', title: '预期用途确认', status: 'approved' },
    { id: '2', projectId: 'eu-cer', title: '临床背景与 SOTA 综述', status: 'approved' },
    { id: '3', projectId: 'eu-cer', title: '文献检索策略', status: 'approved' },
    { id: '4', projectId: 'eu-cer', title: '文献筛选', status: 'generating' }
  ],
  files: [
    { id: 'ifu', projectId: 'eu-cer', name: 'IFU / Labeling', type: 'IFU', note: '用于Step 1预期用途、禁忌、警告、注意事项核对' },
    { id: 'study', projectId: 'eu-cer', name: 'Clinical Study Summary', type: 'Clinical', note: 'DINKS试验、主要终点、次要终点、安全性' }
  ],
  deviceProfiles: [
    {
      projectId: 'eu-cer',
      basics: {
        productName: 'Kranus Mictera',
        genericName: 'Digital therapeutic for urinary incontinence',
        regulation: 'EU MDR',
        deviceType: 'SaMD / Medical Device Software',
        deviceClass: 'Class I',
        classificationRule: 'MDR Annex VIII software rule assessment required'
      },
      scope: {
        intendedUse: 'Kranus Mictera is a 12-week digital therapeutic programme delivered through a smartphone or tablet to support conservative treatment of female urinary incontinence.',
        indications: 'Women diagnosed with or experiencing symptoms of stress urinary incontinence, urge urinary incontinence, or mixed urinary incontinence.',
        targetPopulation: 'Adult women capable of using a smartphone or tablet and performing self-directed pelvic floor and bladder training exercises.',
        intendedUsers: 'Primary users are patients. Healthcare professionals may prescribe, recommend, or monitor use.',
        useEnvironment: 'Home or community setting, outside a clinical environment.',
        operatingPrinciple: 'The app combines pelvic floor muscle training, bladder behaviour training, CBT, mindfulness relaxation, urge-stop function, bladder diary, education, video, audio, haptic feedback, and text guidance.'
      },
      market: {
        ceScenario: 'Initial certification / clinical trial evidence route',
        marketedStatus: 'Example product identified via public sources and EUDAMED search',
        marketHistory: 'Demonstration assumes Class I self-declared product; market history to be confirmed by manufacturer.',
        clinicalStudySummary: 'DINKS was a 12-week randomized controlled multicentre remote study in Germany with 194 women. Intervention achieved 60.95% relative reduction in daily incontinence episode frequency versus 1.69% in control; p<0.0001.'
      },
      company: {
        manufacturer: 'Kranus Health GmbH',
        manufacturerAddress: 'Munich, Germany; offices in Berlin and Paris',
        srn: 'To be confirmed',
        euAuthorizedRepresentative: 'Not required if manufacturer is established in EU/EEA',
        teamSize: '70+'
      },
      pathway: {
        evaluationPathway: 'Clinical trial route',
        equivalenceNeeded: 'No',
        clinicalEvaluationType: 'Initial clinical evaluation',
        step10EquivalenceActive: 'No'
      },
      scopeSettings: {
        databases: 'PubMed, Embase',
        searchWindow: 'Default 5 years, adjustable based on device and indication',
        screeningMethod: 'Title/abstract screening followed by full-text appraisal',
        appraisalMethod: 'Relevance, methodological quality, applicability, and evidence grading',
        exportFormats: 'PubMed NBIB; Embase RIS'
      },
      confirmations: {
        required: 'Confirm classification rule, IFU wording, age lower limit, contraindications, warnings, precautions, and manufacturer-specific market history.',
        status: 'draft'
      }
    }
  ],
  documents: [
    { id: 'cer', projectId: 'eu-cer', name: 'Clinical Evaluation Report (CER)', status: 'approved', action: 'Export Word' },
    { id: 'cep', projectId: 'eu-cer', name: 'Clinical Evaluation Plan (CEP)', status: 'draft', action: 'Generate' },
    { id: 'dcr', projectId: 'eu-cer', name: 'Data Collection Report (DCR)', status: 'ready', action: 'Download Word' },
    { id: 'gspr-doc', projectId: 'eu-cer', name: 'GSPR Compliance Checklist', status: 'draft', action: 'Generate' }
  ],
  profileExtractions: [],
  events: []
};

const clinicalEvaluationStepTemplates = [
  ['1', '预期用途确认', 'approved'],
  ['2', '临床背景与 SOTA 综述', 'not_started'],
  ['3', '文献检索策略', 'not_started'],
  ['4', '文献筛选', 'not_started'],
  ['5', '安全数据检索', 'locked'],
  ['6', '全文评价', 'locked'],
  ['7', '数据提取与端点', 'locked'],
  ['8', '临床获益与风险', 'locked'],
  ['9', '等同性分析', 'conditional'],
  ['10', 'CER/CEP/DCR 组装', 'locked']
];

const clinicalEvaluationDocuments = [
  ['cer', 'Clinical Evaluation Report (CER)', 'draft', 'Generate'],
  ['cep', 'Clinical Evaluation Plan (CEP)', 'draft', 'Generate'],
  ['dcr', 'Data Collection Report (DCR)', 'draft', 'Generate']
];

const taskTemplates = [
  {
    id: 'hong-kong-document-revision',
    title: '香港注册文件修订',
    description: 'Revise an uploaded source document for Hong Kong MDACS submission and produce an editable DOCX draft.'
  },
  {
    id: 'clinical-evaluation',
    title: 'Clinical Evaluation',
    description: 'EU MDR clinical evaluation workflow with 10 steps and CER/CEP/DCR outputs.'
  },
  {
    id: 'gspr-analysis',
    title: 'GSPR Analysis',
    description: 'Annex I GSPR checklist and evidence gap workflow.'
  },
  {
    id: 'risk-management',
    title: 'Risk Management',
    description: 'ISO 14971 hazard analysis, risk controls and benefit-risk summary.'
  }
];

async function ensureDb() {
  await fs.mkdir(uploadDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(seed, null, 2));
  }
}

async function readDb() {
  await ensureDb();
  const db = JSON.parse(await fs.readFile(dbPath, 'utf8'));
  let changed = false;
  for (const [key, value] of Object.entries(seed)) {
    if (!Array.isArray(db[key])) {
      db[key] = value;
      changed = true;
    }
  }
  if (!db.deviceProfiles.find((item) => item.projectId === 'eu-cer')) {
    db.deviceProfiles.push(seed.deviceProfiles[0]);
    changed = true;
  }
  if (changed) await writeDb(db);
  return db;
}

async function writeDb(db) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

async function removeStoredUploads(storedNames = []) {
  await Promise.all(storedNames.map(async (storedName) => {
    if (!storedName || path.basename(storedName) !== storedName) return;
    const target = path.resolve(uploadDir, storedName);
    if (path.dirname(target) !== path.resolve(uploadDir)) return;
    await fs.rm(target, { force: true });
  }));
}

function event(db, type, message, meta = {}) {
  db.events.unshift({
    id: `evt-${Date.now()}`,
    type,
    message,
    meta,
    createdAt: new Date().toISOString()
  });
  db.events = db.events.slice(0, 80);
}

const requiredProfileFields = {
  basics: ['productName', 'genericName', 'regulation', 'deviceClass', 'classificationRule'],
  scope: ['intendedUse', 'indications', 'targetPopulation', 'intendedUsers', 'operatingPrinciple'],
  market: ['ceScenario', 'marketedStatus', 'clinicalStudySummary'],
  company: ['manufacturer', 'manufacturerAddress'],
  pathway: ['evaluationPathway', 'equivalenceNeeded', 'clinicalEvaluationType', 'step10EquivalenceActive'],
  scopeSettings: ['databases', 'searchWindow', 'screeningMethod', 'appraisalMethod', 'exportFormats'],
  confirmations: ['required', 'status']
};

function missingProfileFields(profile = {}) {
  return Object.entries(requiredProfileFields).flatMap(([section, fields]) =>
    fields
      .filter((field) => !String(profile[section]?.[field] || '').trim())
      .map((field) => `${section}.${field}`)
  );
}

function profileProjectFields(profile) {
  const product = profile.basics?.productName || 'New Device';
  const isHongKongRegistration = profile.basics?.regulation === '香港注册（MDACS）';
  return {
    title: isHongKongRegistration ? `香港注册 - ${product}` : `EU MDR CER - ${product}`,
    product,
    market: profile.basics?.regulation || 'EU MDR',
    deviceClass: profile.basics?.deviceClass || 'Class IIa',
    manufacturer: profile.company?.manufacturer || 'New Manufacturer'
  };
}

const hongKongRecommendedClasses = {
  RULE_2_NON_INVASIVE: 'Class II',
  RULE_5_INVASIVE: 'Class II',
  RULE_6_SURGICALLY_INVASIVE_TRANSIENT: 'Class II',
  RULE_7_SURGICALLY_INVASIVE_SHORT_TERM: 'Class III',
  RULE_8_IMPLANTABLE_LONG_TERM: 'Class IV',
  RULE_9_ACTIVE_THERAPEUTIC: 'Class II',
  RULE_10_ACTIVE_DIAGNOSTIC: 'Class II',
  RULE_12_OTHER_ACTIVE: 'Class II'
};

function missingHongKongClassificationOverrideReason(profile = {}) {
  if (profile.basics?.regulation !== '香港注册（MDACS）') return false;
  const recommendedClass = hongKongRecommendedClasses[profile.basics?.classificationRule];
  const isOverride = recommendedClass && recommendedClass !== profile.basics?.deviceClass;
  return Boolean(isOverride && !String(profile.basics?.classificationMismatchReason || '').trim());
}

function initializeHongKongDocumentRevisionTask(db, projectId) {
  return createTaskFromTemplate(db, projectId, 'hong-kong-document-revision');
}

function initializeClinicalEvaluationWorkflow(db, projectId) {
  let task = db.tasks.find((item) => item.projectId === projectId && item.title === 'Clinical Evaluation');
  if (!task) {
    task = { id: `${projectId}-ce`, projectId, title: 'Clinical Evaluation', status: 'not_started', progress: 0 };
    db.tasks.push(task);
  }

  for (const [id, title, status] of clinicalEvaluationStepTemplates) {
    const exists = db.steps.some((item) => item.projectId === projectId && item.id === id);
    if (!exists) db.steps.push({ id, projectId, taskId: task.id, title, status });
  }

  for (const [suffix, name, status, action] of clinicalEvaluationDocuments) {
    const id = `${projectId}-${suffix}`;
    const exists = db.documents.some((item) => item.projectId === projectId && (item.id === id || item.name === name));
    if (!exists) db.documents.push({ id, projectId, taskId: task.id, name, status, action });
  }

  return task;
}

function createTaskFromTemplate(db, projectId, templateId) {
  if (templateId === 'clinical-evaluation') {
    return initializeClinicalEvaluationWorkflow(db, projectId);
  }
  const template = taskTemplates.find((item) => item.id === templateId);
  if (!template) return null;
  let task = db.tasks.find((item) => item.projectId === projectId && item.title === template.title);
  if (!task) {
    task = { id: `${projectId}-${templateId}`, projectId, title: template.title, status: 'not_started', progress: 0 };
    db.tasks.push(task);
  }
  return task;
}

function extensionOf(name = '') {
  return path.extname(name).toLowerCase();
}

async function extractTextFromStoredFile(file) {
  if (!file.storedName) throw new Error('Uploaded file has no stored payload');
  const storedPath = path.join(uploadDir, file.storedName);
  const ext = extensionOf(file.name);
  if (['.txt', '.md', '.json', '.csv', '.ris', '.nbib'].includes(ext)) {
    return fs.readFile(storedPath, 'utf8');
  }
  if (ext === '.docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: storedPath });
      return result.value || '';
    } catch {
      throw new Error('DOCX parser is not available. Install mammoth to enable DOCX extraction.');
    }
  }
  if (ext === '.pdf') {
    try {
      const pdfParse = await import('pdf-parse');
      const buffer = await fs.readFile(storedPath);
      const parser = pdfParse.default || pdfParse;
      const result = await parser(buffer);
      return result.text || '';
    } catch {
      throw new Error('PDF parser is not available. Install pdf-parse to enable PDF extraction.');
    }
  }
  throw new Error(`Unsupported file type: ${ext || 'unknown'}`);
}

function compactText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function snippetAround(text, value) {
  const cleanText = compactText(text);
  const cleanValue = compactText(value);
  if (!cleanValue) return cleanText.slice(0, 180);
  const index = cleanText.toLowerCase().indexOf(cleanValue.toLowerCase());
  if (index < 0) return cleanText.slice(0, 180);
  return cleanText.slice(Math.max(0, index - 70), Math.min(cleanText.length, index + cleanValue.length + 90));
}

function aiExtractionConfigured() {
  if (process.env.DISABLE_AI_EXTRACTION === '1') return false;
  const provider = process.env.AI_PROVIDER || 'openai';
  return provider === 'deepseek'
    ? Boolean(process.env.DEEPSEEK_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

function aiConfig() {
  const provider = process.env.AI_PROVIDER || (process.env.DEEPSEEK_API_KEY ? 'deepseek' : 'openai');
  const model = process.env.AI_PROFILE_MODEL || process.env.OPENAI_PROFILE_MODEL || (provider === 'deepseek' ? 'deepseek-v4-flash' : 'gpt-4o-mini');
  const baseUrl = process.env.AI_BASE_URL || (provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com');
  const apiKey = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
  return {
    provider,
    model,
    baseUrl: baseUrl.replace(/\/$/, ''),
    apiKey
  };
}

function publicAiConfig() {
  const config = aiConfig();
  return {
    provider: config.provider,
    profileExtractionConfigured: aiExtractionConfigured(),
    profileExtractionModel: config.model,
    baseUrl: config.baseUrl,
    hasApiKey: Boolean(config.apiKey)
  };
}

function envLine(key, value) {
  if (!value) return '';
  return `${key}=${String(value).replace(/\n/g, '').trim()}`;
}

async function saveAiConfig(input = {}) {
  const provider = input.provider === 'deepseek' ? 'deepseek' : 'openai';
  const model = input.model || (provider === 'deepseek' ? 'deepseek-v4-flash' : 'gpt-4o-mini');
  const baseUrl = input.baseUrl || (provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com');
  const current = aiConfig();
  const apiKey = input.apiKey || current.apiKey || '';
  const lines = [
    envLine('AI_PROVIDER', provider),
    envLine('AI_BASE_URL', baseUrl),
    envLine('AI_PROFILE_MODEL', model),
    provider === 'deepseek' ? envLine('DEEPSEEK_API_KEY', apiKey) : envLine('OPENAI_API_KEY', apiKey)
  ].filter(Boolean);
  await fs.writeFile(envPath, `${lines.join('\n')}\n`, { mode: 0o600 });
  process.env.AI_PROVIDER = provider;
  process.env.AI_BASE_URL = baseUrl;
  process.env.AI_PROFILE_MODEL = model;
  if (provider === 'deepseek') {
    process.env.DEEPSEEK_API_KEY = apiKey;
  } else {
    process.env.OPENAI_API_KEY = apiKey;
  }
  return publicAiConfig();
}

const aiCandidateMap = {
  productName: ['basics', 'productName', '产品名称'],
  genericName: ['basics', 'genericName', '通用名/器械类型'],
  deviceClass: ['basics', 'deviceClass', '器械类别'],
  classificationRule: ['basics', 'classificationRule', '分类规则'],
  intendedUse: ['scope', 'intendedUse', 'Intended Use'],
  indications: ['scope', 'indications', 'Indications'],
  targetPopulation: ['scope', 'targetPopulation', '目标人群'],
  intendedUsers: ['scope', 'intendedUsers', '预期用户'],
  useEnvironment: ['scope', 'useEnvironment', '使用环境'],
  operatingPrinciple: ['scope', 'operatingPrinciple', '工作原理'],
  clinicalStudySummary: ['market', 'clinicalStudySummary', '临床研究摘要'],
  manufacturer: ['company', 'manufacturer', '制造商'],
  manufacturerAddress: ['company', 'manufacturerAddress', '制造商地址']
};

async function extractProfileCandidatesWithAi(text) {
  if (!aiExtractionConfigured()) return [];
  const config = aiConfig();
  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Extract medical device profile fields from the provided document.',
            'Return only JSON. Example JSON: {"productName":null,"genericName":null,"deviceClass":null,"classificationRule":null,"intendedUse":null,"indications":null,"targetPopulation":null,"intendedUsers":null,"useEnvironment":null,"operatingPrinciple":null,"clinicalStudySummary":null,"manufacturer":null,"manufacturerAddress":null}.',
            'Use null when a field is not supported by the text.',
            'Do not invent values. Prefer exact wording from the document.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({
            fields: Object.keys(aiCandidateMap),
            documentText: compactText(text).slice(0, 18000)
          })
        }
      ]
    })
  });
  if (!response.ok) throw new Error(`AI extraction failed: ${response.status}`);
  const payload = await response.json();
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
  return Object.entries(aiCandidateMap).flatMap(([jsonKey, [sectionId, fieldKey, label]]) => {
    const value = cleanExtractedValue(parsed[jsonKey] || '');
    if (!value) return [];
    return [{
      sectionId,
      fieldKey,
      label,
      value,
      confidence: 0.92,
      source: 'ai',
      sourceSnippet: snippetAround(text, value)
    }];
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function looksLikeHeading(line, allLabels) {
  const normalized = line.trim().replace(/[:：\-–—]\s*$/, '').toLowerCase();
  if (!normalized) return false;
  if (allLabels.some((label) => normalized === label.toLowerCase())) return true;
  return normalized.length < 70 && /^[A-Za-z][A-Za-z /()&-]+$/.test(normalized);
}

function cleanExtractedValue(value = '') {
  return compactText(value)
    .replace(/^[：:\-–—]\s*/, '')
    .replace(/\s+(section|chapter)\s+\d+.*$/i, '')
    .trim();
}

function findHeadingBlock(lines, index, allLabels) {
  const block = [];
  for (let cursor = index + 1; cursor < Math.min(lines.length, index + 5); cursor += 1) {
    const line = lines[cursor].trim();
    if (!line) continue;
    if (looksLikeHeading(line, allLabels)) break;
    block.push(line);
    if (block.join(' ').length > 420) break;
  }
  return cleanExtractedValue(block.join(' ')).slice(0, 520);
}

function findFieldValue(text, rule) {
  const labels = rule.labels || [];
  const allLabels = extractionFieldRules.flatMap((item) => item.labels || []);
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const label of labels) {
    const escaped = escapeRegExp(label);
    const linePattern = new RegExp(`^${escaped}\\s*[:：\\-–—]\\s*(.+)$`, 'i');
    const matchingLine = lines.find((line) => linePattern.test(line));
    if (matchingLine) return cleanExtractedValue(matchingLine.match(linePattern)?.[1] || '');

    const headingPattern = new RegExp(`^${escaped}\\s*[:：\\-–—]?$`, 'i');
    const headingIndex = lines.findIndex((line) => headingPattern.test(line));
    if (headingIndex >= 0) {
      const headingValue = findHeadingBlock(lines, headingIndex, allLabels);
      if (headingValue) return headingValue;
    }

    const inlinePattern = new RegExp(`${escaped}\\s*[:：\\-–—]\\s*([^\\n]{4,520})`, 'i');
    const inlineMatch = String(text).match(inlinePattern);
    if (inlineMatch) return cleanExtractedValue(inlineMatch[1]);
  }
  if (rule.fallback) return rule.fallback(String(text), lines);
  return '';
}

const extractionFieldRules = [
  { sectionId: 'basics', fieldKey: 'productName', label: '产品名称', confidence: 0.88, labels: ['Product Name', 'Device Name', 'Trade Name', 'Commercial Name', 'Name of Device', '产品名称', '器械名称'] },
  {
    sectionId: 'basics',
    fieldKey: 'genericName',
    label: '通用名/器械类型',
    confidence: 0.78,
    labels: ['Generic Name', 'Device Generic Name', 'Common Name', 'Device Description', 'Product Description', '通用名', '器械通用名称'],
    fallback: (text) => cleanExtractedValue(text.match(/\bis\s+(?:a|an)\s+([^.\n]{8,160}?(?:system|device|software|monitor|sensor|app|application|platform))/i)?.[1] || '')
  },
  {
    sectionId: 'basics',
    fieldKey: 'deviceClass',
    label: '器械类别',
    confidence: 0.82,
    labels: ['Device Class', 'Risk Class', 'MDR Classification', 'Medical Device Class', 'Classification', 'Classification under MDR', '器械类别', '管理类别'],
    fallback: (text) => cleanExtractedValue(text.match(/\bClass\s+(I{1,3}[ab]?|A|B|C|D)\b/i)?.[0] || '')
  },
  {
    sectionId: 'basics',
    fieldKey: 'classificationRule',
    label: '分类规则',
    confidence: 0.74,
    labels: ['Classification Rule', 'MDR Rule', 'Rule Applied', 'Classification Rationale', '分类规则'],
    fallback: (text) => cleanExtractedValue(text.match(/\b(?:MDR\s+Annex\s+VIII\s+)?Rule\s+\d+[a-z]?\b[^.\n]{0,160}/i)?.[0] || '')
  },
  { sectionId: 'scope', fieldKey: 'intendedUse', label: 'Intended Use', confidence: 0.9, labels: ['Intended Use', 'Intended Purpose', 'Intended Medical Purpose', 'Purpose', 'Clinical Use', '预期用途', '预期目的'] },
  { sectionId: 'scope', fieldKey: 'indications', label: 'Indications', confidence: 0.86, labels: ['Indications', 'Indications for Use', 'Indication for Use', 'Medical Indication', 'Clinical Indication', '适应症', '适用症'] },
  { sectionId: 'scope', fieldKey: 'targetPopulation', label: '目标人群', confidence: 0.82, labels: ['Target Population', 'Patient Population', 'Intended Patient Population', 'Patient Target Group', 'Target Patient Group', 'Patient Group', '目标人群', '患者人群'] },
  { sectionId: 'scope', fieldKey: 'intendedUsers', label: '预期用户', confidence: 0.78, labels: ['Intended Users', 'Intended User', 'Intended Operator', 'Operator', 'User Profile', 'Users', '预期用户', '使用者'] },
  { sectionId: 'scope', fieldKey: 'useEnvironment', label: '使用环境', confidence: 0.76, labels: ['Use Environment', 'Environment of Use', 'Use Setting', 'Clinical Setting', 'Use Location', '使用环境', '使用场景'] },
  { sectionId: 'scope', fieldKey: 'operatingPrinciple', label: '工作原理', confidence: 0.8, labels: ['Operating Principle', 'Principle of Operation', 'Mode of Action', 'Working Principle', 'Technology Principle', '工作原理', '作用机理'] },
  { sectionId: 'market', fieldKey: 'clinicalStudySummary', label: '临床研究摘要', confidence: 0.78, labels: ['Clinical Study Summary', 'Clinical Evidence Summary', '临床研究摘要', '临床证据摘要'] },
  { sectionId: 'company', fieldKey: 'manufacturer', label: '制造商', confidence: 0.86, labels: ['Manufacturer', 'Legal Manufacturer', 'Manufacturer Name', '制造商', '注册人'] },
  { sectionId: 'company', fieldKey: 'manufacturerAddress', label: '制造商地址', confidence: 0.78, labels: ['Manufacturer Address', 'Registered Address', '制造商地址', '注册地址'] }
];

function mapProfileCandidates(text) {
  const candidates = [];
  for (const rule of extractionFieldRules) {
    const value = findFieldValue(text, rule);
    if (!value) continue;
    candidates.push({
      sectionId: rule.sectionId,
      fieldKey: rule.fieldKey,
      label: rule.label,
      value,
      confidence: rule.confidence,
      source: 'rules',
      sourceSnippet: snippetAround(text, value)
    });
  }
  return candidates;
}

function mergeCandidates(ruleCandidates, aiCandidates) {
  const merged = new Map();
  for (const candidate of ruleCandidates) {
    merged.set(`${candidate.sectionId}.${candidate.fieldKey}`, candidate);
  }
  for (const candidate of aiCandidates) {
    merged.set(`${candidate.sectionId}.${candidate.fieldKey}`, candidate);
  }
  return [...merged.values()];
}

async function extractProfileCandidates(text) {
  const ruleCandidates = mapProfileCandidates(text);
  try {
    const aiCandidates = await extractProfileCandidatesWithAi(text);
    return {
      candidates: mergeCandidates(ruleCandidates, aiCandidates),
      engine: aiCandidates.length ? 'rules+ai' : 'rules',
      aiConfigured: aiExtractionConfigured(),
      aiError: null
    };
  } catch (error) {
    return {
      candidates: ruleCandidates,
      engine: 'rules',
      aiConfigured: aiExtractionConfigured(),
      aiError: error.message
    };
  }
}

function latestCompletedExtraction(db, projectId) {
  return db.profileExtractions.find((item) => item.projectId === projectId && item.status === 'completed') || null;
}

function candidateFor(extraction, sectionId, fieldKey) {
  return extraction?.candidates?.find((item) => item.sectionId === sectionId && item.fieldKey === fieldKey) || null;
}

function fieldSource(extraction, sectionId, fieldKey) {
  const candidate = candidateFor(extraction, sectionId, fieldKey);
  if (!candidate) return { source: '设备画像', snippet: '' };
  return {
    source: `上传文件识别：${extraction.fileName}`,
    snippet: candidate.sourceSnippet || ''
  };
}

function profileField(profile, sectionId, fieldKey, fallback = '') {
  return profile?.[sectionId]?.[fieldKey] || fallback;
}

function makeStructuredField(profile, extraction, sectionId, fieldKey, label, fallback = '') {
  const source = fieldSource(extraction, sectionId, fieldKey);
  const candidate = candidateFor(extraction, sectionId, fieldKey);
  const profileValue = profileField(profile, sectionId, fieldKey, fallback);
  return {
    sectionId,
    fieldKey,
    label,
    value: profileValue,
    profileValue,
    extractedValue: candidate?.value || '',
    selectedSource: 'profile',
    confirmationStatus: 'pending',
    source: source.source,
    sourceSnippet: source.snippet
  };
}

function buildIntendedUseConfirmationOutput(db, projectId) {
  const profile = db.deviceProfiles.find((item) => item.projectId === projectId);
  const extraction = latestCompletedExtraction(db, projectId);
  const fields = [
    makeStructuredField(profile, extraction, 'basics', 'productName', '产品名称'),
    makeStructuredField(profile, extraction, 'basics', 'genericName', '通用名/器械类型'),
    makeStructuredField(profile, extraction, 'basics', 'deviceClass', '器械类别'),
    makeStructuredField(profile, extraction, 'scope', 'intendedUse', '预期用途'),
    makeStructuredField(profile, extraction, 'scope', 'indications', '适应症'),
    makeStructuredField(profile, extraction, 'scope', 'targetPopulation', '目标人群'),
    makeStructuredField(profile, extraction, 'scope', 'intendedUsers', '预期用户'),
    makeStructuredField(profile, extraction, 'scope', 'useEnvironment', '使用环境'),
    makeStructuredField(profile, extraction, 'scope', 'operatingPrinciple', '工作原理')
  ];
  const missing = fields.filter((item) => !String(item.value || '').trim()).map((item) => item.label);
  const extractionCandidates = extraction?.candidates?.filter((item) =>
    ['basics.productName', 'basics.deviceClass', 'scope.intendedUse', 'scope.indications', 'scope.targetPopulation', 'scope.intendedUsers', 'scope.useEnvironment', 'scope.operatingPrinciple']
      .includes(`${item.sectionId}.${item.fieldKey}`)
  ) || [];

  return {
    title: 'Step 1 预期用途确认',
    summary: `${profile?.basics?.productName || '该器械'} 的预期用途确认已基于设备画像${extraction ? `和上传文件 ${extraction.fileName} 的识别结果` : ''}生成。`,
    generatedFrom: {
      profileProjectId: projectId,
      profileStatus: profile?.confirmations?.status || 'unknown',
      extractionId: extraction?.id || null,
      extractionFileName: extraction?.fileName || null
    },
    locked: false,
    structuredFields: fields,
    extractionCandidates,
    clinicalBenefits: [
      '减少或改善目标适应症相关症状',
      '支持患者在预期使用环境下完成保守治疗或训练',
      '改善与目标疾病相关的生活质量或功能状态'
    ],
    actionItems: [
      ...missing.map((label) => `ACTION REQUIRED：补充或确认 ${label}`),
      'ACTION REQUIRED：核对 IFU/Labeling 中预期用途、适应症、禁忌、警告和注意事项是否与画像一致',
      'ACTION REQUIRED：确认目标人群边界，例如年龄范围、疾病亚型、使用能力和排除条件',
      '批准前需确认上传文件识别结果没有覆盖正式 IFU 原文含义'
    ],
    conclusion: missing.length
      ? '当前预期用途信息仍有缺失，不能直接作为最终 CER 输入。'
      : '当前预期用途信息已形成可审阅结构化草稿，可进入人工核对和批准。'
  };
}

function fieldValueFromSource(field, selectedSource, manualValue) {
  if (selectedSource === 'extraction') return field.extractedValue || field.value || '';
  if (selectedSource === 'profile') return field.profileValue || field.value || '';
  if (typeof manualValue === 'string') return manualValue;
  return field.value || '';
}

function refreshStep1Conclusion(output) {
  const missing = output.structuredFields?.filter((item) => !String(item.value || '').trim()).map((item) => item.label) || [];
  const pending = output.structuredFields?.filter((item) => item.confirmationStatus !== 'confirmed').length || 0;
  output.actionItems = [
    ...missing.map((label) => `ACTION REQUIRED：补充或确认 ${label}`),
    pending ? `ACTION REQUIRED：还有 ${pending} 个字段未完成人工确认` : '所有结构化字段已完成人工确认',
    'ACTION REQUIRED：核对 IFU/Labeling 中预期用途、适应症、禁忌、警告和注意事项是否与画像一致',
    'ACTION REQUIRED：确认目标人群边界，例如年龄范围、疾病亚型、使用能力和排除条件',
    '批准前需确认上传文件识别结果没有覆盖正式 IFU 原文含义'
  ];
  output.conclusion = missing.length
    ? '当前预期用途信息仍有缺失，不能直接作为最终 CER 输入。'
    : pending
      ? '当前预期用途信息已形成结构化草稿，但仍需完成字段级人工确认。'
      : '当前预期用途信息已完成字段级人工确认，可进入批准锁定。';
}

function stepFieldValue(step, sectionId, fieldKey) {
  return step?.output?.structuredFields?.find((item) => item.sectionId === sectionId && item.fieldKey === fieldKey)?.value || '';
}

function makeInheritedField(step, sectionId, fieldKey, label) {
  const field = step?.output?.structuredFields?.find((item) => item.sectionId === sectionId && item.fieldKey === fieldKey);
  return {
    sectionId,
    fieldKey,
    label,
    value: field?.value || '',
    selectedSource: field?.selectedSource || 'unknown',
    confirmationStatus: field?.confirmationStatus || 'unknown'
  };
}

function buildSotaReviewOutput(db, projectId) {
  const step1 = db.steps.find((item) => item.projectId === projectId && item.id === '1');
  if (step1?.status !== 'approved' || !step1.output?.locked) {
    return { error: 'Step 1 must be approved before generating Step 2', status: 409 };
  }

  const productName = stepFieldValue(step1, 'basics', 'productName') || '该器械';
  const intendedUse = stepFieldValue(step1, 'scope', 'intendedUse');
  const indications = stepFieldValue(step1, 'scope', 'indications');
  const targetPopulation = stepFieldValue(step1, 'scope', 'targetPopulation');
  const targetPopulationSearchTerm = targetPopulation ? targetPopulation.charAt(0).toLowerCase() + targetPopulation.slice(1) : 'adult women';
  const intendedUsers = stepFieldValue(step1, 'scope', 'intendedUsers');
  const useEnvironment = stepFieldValue(step1, 'scope', 'useEnvironment');
  const operatingPrinciple = stepFieldValue(step1, 'scope', 'operatingPrinciple');

  return {
    title: 'Step 2 临床背景与 SOTA 综述',
    summary: `${productName} 的 SOTA 综述框架已继承 Step 1 批准后的预期用途、适应症和目标人群。`,
    generatedFrom: {
      step1Status: step1.status,
      step1ApprovedAt: step1.approvedAt || null,
      step1Locked: Boolean(step1.output.locked)
    },
    inheritedFields: [
      makeInheritedField(step1, 'basics', 'productName', '产品名称'),
      makeInheritedField(step1, 'scope', 'intendedUse', '预期用途'),
      makeInheritedField(step1, 'scope', 'indications', '适应症'),
      makeInheritedField(step1, 'scope', 'targetPopulation', '目标人群'),
      makeInheritedField(step1, 'scope', 'intendedUsers', '预期用户'),
      makeInheritedField(step1, 'scope', 'useEnvironment', '使用环境'),
      makeInheritedField(step1, 'scope', 'operatingPrinciple', '工作原理')
    ],
    sotaSections: [
      {
        id: 'disease-background',
        title: '疾病背景与流行病学',
        inputs: [indications, targetPopulation].filter(Boolean),
        outputNeed: '定义疾病负担、自然病程、患病率、目标人群临床需求和未满足需求。'
      },
      {
        id: 'current-treatment',
        title: '当前治疗方案与替代方案',
        inputs: [intendedUse, intendedUsers, useEnvironment].filter(Boolean),
        outputNeed: '覆盖保守治疗、行为训练、药物、器械、手术和数字疗法等可比替代方案。'
      },
      {
        id: 'technology-baseline',
        title: '当前技术水平与接受标准',
        inputs: [operatingPrinciple, intendedUse].filter(Boolean),
        outputNeed: '形成同类技术的安全性、有效性、可用性和患者依从性基线。'
      }
    ],
    searchQuestions: [
      `What is the disease burden and standard care for ${targetPopulationSearchTerm}?`,
      `What clinical outcomes are accepted for ${indications || 'the claimed indications'}?`,
      `How do digital therapeutic or SaMD interventions compare with current conservative treatment for ${targetPopulationSearchTerm}?`,
      `Which safety, usability, adherence, and quality-of-life endpoints are expected for ${productName}?`
    ],
    actionItems: [
      'ACTION REQUIRED：补充最新指南、系统综述和流行病学数据来源',
      'ACTION REQUIRED：确认 SOTA 接受标准是否覆盖 Step 1 已批准的适应症和目标人群',
      'ACTION REQUIRED：确认竞品和替代治疗不会遗漏 Step 3 检索策略'
    ],
    conclusion: 'Step 2 已继承 Step 1 批准结果，可作为 SOTA 文献检索和临床背景综述的结构化输入。'
  };
}

function buildStepOutput(db, projectId, step) {
  if (step.id === '1') return buildIntendedUseConfirmationOutput(db, projectId);
  if (step.id === '2') return buildSotaReviewOutput(db, projectId);
  return {
    title: step.title,
    summary: `已基于项目设备画像、上下文文件和法规知识库生成 ${step.title} 的初稿。`,
    actionItems: ['核对ACTION REQUIRED标记', '确认来源文件一致性', '批准后进入下一步']
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'reguverse-local-mvp' });
});

app.get('/api/ai/config', (req, res) => {
  res.json(publicAiConfig());
});

app.put('/api/ai/config', async (req, res) => {
  try {
    const saved = await saveAiConfig(req.body || {});
    res.json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/profile-extractions/preview', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const file = {
    id: `preview-file-${Date.now()}`,
    name: req.file.originalname || 'Uploaded file',
    storedName: req.file.filename
  };

  try {
    const text = await extractTextFromStoredFile(file);
    const normalized = compactText(text);
    if (!normalized) return res.status(422).json({ error: 'No readable text found in file' });
    const extractionResult = await extractProfileCandidates(text);
    res.status(201).json({
      id: `preview-extract-${Date.now()}`,
      projectId: null,
      fileId: file.id,
      fileName: file.name,
      status: 'completed',
      engine: extractionResult.engine,
      aiConfigured: extractionResult.aiConfigured,
      aiError: extractionResult.aiError,
      textPreview: normalized.slice(0, 700),
      candidates: extractionResult.candidates,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(422).json({
      id: `preview-extract-${Date.now()}`,
      projectId: null,
      fileId: file.id,
      fileName: file.name,
      status: 'failed',
      error: error.message,
      textPreview: '',
      candidates: [],
      createdAt: new Date().toISOString()
    });
  } finally {
    await fs.rm(path.join(uploadDir, req.file.filename), { force: true });
  }
});

app.get('/api/projects', async (req, res) => {
  let db = await readDb();
  const expired = purgeExpiredProjects(db, new Date());
  if (expired.purgedProjectIds.length) {
    db = expired.db;
    await writeDb(db);
    await removeStoredUploads(expired.uploadReferences);
  }
  res.json(listActiveProjects(db));
});

app.get('/api/projects/deleted', async (req, res) => {
  const db = await readDb();
  const result = prepareDeletedProjects(db, new Date());
  if (result.purgedProjectIds.length) {
    await writeDb(result.db);
    await removeStoredUploads(result.uploadReferences);
  }
  res.json(result.projects);
});

app.post('/api/projects', async (req, res) => {
  const db = await readDb();
  const id = `project-${Date.now()}`;
  const project = {
    id,
    title: req.body.title || `EU MDR CER - ${req.body.product || 'New Device'}`,
    product: req.body.product || 'New Device',
    market: req.body.market || 'EU MDR',
    deviceClass: req.body.deviceClass || 'Class IIa',
    manufacturer: req.body.manufacturer || 'New Manufacturer',
    status: '项目已创建',
    progress: 5
  };
  db.projects.unshift(project);
  initializeClinicalEvaluationWorkflow(db, id);
  event(db, 'project.created', `创建项目：${project.title}`, { projectId: id });
  await writeDb(db);
  res.status(201).json(project);
});

app.post('/api/projects/from-profile', async (req, res) => {
  const profileInput = req.body.profile || req.body;
  const missing = missingProfileFields(profileInput);
  if (missing.length) {
    return res.status(400).json({ error: 'Missing required profile fields', missing });
  }
  if (missingHongKongClassificationOverrideReason(profileInput)) {
    return res.status(400).json({ error: 'Classification override reason is required' });
  }

  const db = await readDb();
  const id = `project-${Date.now()}`;
  const project = {
    id,
    ...profileProjectFields(profileInput),
    status: '项目画像已创建',
    progress: 8
  };
  const profile = {
    projectId: id,
    ...profileInput,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.projects.unshift(project);
  db.deviceProfiles.push(profile);
  const task = profileInput.basics?.regulation === '香港注册（MDACS）'
    ? initializeHongKongDocumentRevisionTask(db, id)
    : initializeClinicalEvaluationWorkflow(db, id);
  event(db, 'project.created_from_profile', `从设备画像创建项目：${project.title}`, { projectId: id });
  await writeDb(db);
  res.status(201).json({ project, profile, tasks: [task] });
});

app.delete('/api/projects/:projectId', async (req, res) => {
  const db = await readDb();
  try {
    const result = softDeleteProject(db, req.params.projectId, new Date());
    event(result.db, 'project.deleted', `项目移入回收区：${result.project.title}`, { projectId: result.project.id });
    await writeDb(result.db);
    res.json({ project: result.project, fileCount: result.fileCount, deletedAt: result.project.deletedAt, purgeAt: result.project.purgeAt });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.post('/api/projects/:projectId/restore', async (req, res) => {
  const db = await readDb();
  try {
    const result = restoreProject(db, req.params.projectId);
    event(result.db, 'project.restored', `恢复项目：${result.project.title}`, { projectId: result.project.id });
    await writeDb(result.db);
    res.json({ project: result.project, fileCount: result.fileCount, deletedAt: null, purgeAt: null });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.delete('/api/projects/:projectId/permanent', async (req, res) => {
  const db = await readDb();
  try {
    const result = purgeProject(db, req.params.projectId);
    await writeDb(result.db);
    await removeStoredUploads(result.uploadReferences);
    res.json({ project: result.project, fileCount: result.fileCount, deletedAt: result.project.deletedAt, purgeAt: result.project.purgeAt });
  } catch (error) {
    const status = error.message.startsWith('Project not found') ? 404 : 409;
    res.status(status).json({ error: error.message });
  }
});

app.get('/api/projects/:projectId', async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json({
    project,
    profile: db.deviceProfiles.find((item) => item.projectId === project.id) || null,
    tasks: db.tasks.filter((item) => item.projectId === project.id),
    steps: db.steps.filter((item) => item.projectId === project.id),
    files: db.files.filter((item) => item.projectId === project.id),
    profileExtractions: db.profileExtractions.filter((item) => item.projectId === project.id).slice(0, 20),
    documents: db.documents.filter((item) => item.projectId === project.id),
    events: db.events.filter((item) => !item.meta.projectId || item.meta.projectId === project.id).slice(0, 20)
  });
});

app.get('/api/task-templates', (req, res) => {
  res.json(taskTemplates);
});

app.post('/api/projects/:projectId/tasks', async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const templateId = req.body.templateId || 'clinical-evaluation';
  const task = createTaskFromTemplate(db, project.id, templateId);
  if (!task) return res.status(400).json({ error: 'Unsupported task template' });
  event(db, 'task.created', `创建任务：${task.title}`, { projectId: project.id, taskId: task.id, templateId });
  await writeDb(db);
  res.json({
    task,
    steps: db.steps.filter((item) => item.projectId === project.id),
    documents: db.documents.filter((item) => item.projectId === project.id)
  });
});

app.put('/api/projects/:projectId/profile', async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const existing = db.deviceProfiles.find((item) => item.projectId === project.id);
  const profile = {
    projectId: project.id,
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  if (existing) {
    Object.assign(existing, profile);
  } else {
    db.deviceProfiles.push(profile);
  }
  project.product = profile.basics?.productName || project.product;
  project.market = profile.basics?.regulation || project.market;
  project.deviceClass = profile.basics?.deviceClass || project.deviceClass;
  project.manufacturer = profile.company?.manufacturer || project.manufacturer;
  event(db, 'profile.saved', `保存设备画像：${project.product}`, { projectId: project.id });
  await writeDb(db);
  res.json(existing || profile);
});

app.post('/api/projects/:projectId/files', upload.single('file'), async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const file = {
    id: `file-${Date.now()}`,
    projectId: project.id,
    name: req.file?.originalname || req.body.name || 'Uploaded file',
    type: req.body.type || 'Context',
    note: req.body.note || '用户上传的项目上下文文件',
    storedName: req.file?.filename || null,
    uploadedAt: new Date().toISOString()
  };
  db.files.push(file);
  event(db, 'file.uploaded', `上传文件：${file.name}`, { projectId: project.id, fileId: file.id });
  await writeDb(db);
  res.status(201).json(file);
});

app.post('/api/projects/:projectId/files/:fileId/extract-profile', async (req, res) => {
  const db = await readDb();
  const project = db.projects.find((item) => item.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const file = db.files.find((item) => item.projectId === project.id && item.id === req.params.fileId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  try {
    const text = await extractTextFromStoredFile(file);
    const normalized = compactText(text);
    if (!normalized) return res.status(422).json({ error: 'No readable text found in file' });
    const extractionResult = await extractProfileCandidates(text);

    const extraction = {
      id: `extract-${Date.now()}`,
      projectId: project.id,
      fileId: file.id,
      fileName: file.name,
      status: 'completed',
      engine: extractionResult.engine,
      aiConfigured: extractionResult.aiConfigured,
      aiError: extractionResult.aiError,
      textPreview: normalized.slice(0, 700),
      candidates: extractionResult.candidates,
      createdAt: new Date().toISOString()
    };
    db.profileExtractions.unshift(extraction);
    event(db, 'profile.extracted', `识别设备画像候选字段：${file.name}`, { projectId: project.id, fileId: file.id, extractionId: extraction.id });
    await writeDb(db);
    res.status(201).json(extraction);
  } catch (error) {
    const extraction = {
      id: `extract-${Date.now()}`,
      projectId: project.id,
      fileId: file.id,
      fileName: file.name,
      status: 'failed',
      error: error.message,
      textPreview: '',
      candidates: [],
      createdAt: new Date().toISOString()
    };
    db.profileExtractions.unshift(extraction);
    await writeDb(db);
    res.status(422).json(extraction);
  }
});

app.post('/api/projects/:projectId/steps/:stepId/generate', async (req, res) => {
  const db = await readDb();
  const step = db.steps.find((item) => item.projectId === req.params.projectId && item.id === req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });
  const output = buildStepOutput(db, req.params.projectId, step);
  if (output.error) return res.status(output.status || 400).json({ error: output.error });
  step.status = 'generated';
  step.generatedAt = new Date().toISOString();
  step.output = output;
  event(db, 'step.generated', `生成步骤：${step.title}`, { projectId: req.params.projectId, stepId: step.id });
  await writeDb(db);
  res.json(step);
});

app.put('/api/projects/:projectId/steps/:stepId/output/fields/:sectionId/:fieldKey', async (req, res) => {
  const db = await readDb();
  const step = db.steps.find((item) => item.projectId === req.params.projectId && item.id === req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });
  if (!step.output?.structuredFields) return res.status(400).json({ error: 'Step output has not been generated' });
  if (step.output.locked || step.status === 'approved') return res.status(409).json({ error: 'Step output is locked after approval' });

  const field = step.output.structuredFields.find((item) => item.sectionId === req.params.sectionId && item.fieldKey === req.params.fieldKey);
  if (!field) return res.status(404).json({ error: 'Structured field not found' });

  const selectedSource = req.body.selectedSource || field.selectedSource || 'manual';
  field.selectedSource = selectedSource;
  field.value = fieldValueFromSource(field, selectedSource, req.body.value);
  if (typeof req.body.value === 'string' && selectedSource === 'manual') field.manualValue = req.body.value;
  field.confirmationStatus = req.body.confirmationStatus || field.confirmationStatus || 'pending';
  field.reviewedAt = new Date().toISOString();
  field.reviewerNote = req.body.reviewerNote || field.reviewerNote || '';
  refreshStep1Conclusion(step.output);

  event(db, 'step.field_reviewed', `审阅字段：${field.label}`, { projectId: req.params.projectId, stepId: step.id, sectionId: field.sectionId, fieldKey: field.fieldKey });
  await writeDb(db);
  res.json(step);
});

app.post('/api/projects/:projectId/steps/:stepId/approve', async (req, res) => {
  const db = await readDb();
  const step = db.steps.find((item) => item.projectId === req.params.projectId && item.id === req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });
  step.status = 'approved';
  step.approvedAt = new Date().toISOString();
  if (step.output) {
    step.output.locked = true;
    step.output.lockedAt = step.approvedAt;
    if (step.output.structuredFields) refreshStep1Conclusion(step.output);
  }
  event(db, 'step.approved', `批准步骤：${step.title}`, { projectId: req.params.projectId, stepId: step.id });
  await writeDb(db);
  res.json(step);
});

app.post('/api/projects/:projectId/documents/:documentId/action', async (req, res) => {
  const db = await readDb();
  const doc = db.documents.find((item) => item.projectId === req.params.projectId && item.id === req.params.documentId);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  doc.status = req.body.action?.includes('Generate') ? 'generated' : 'actioned';
  doc.lastAction = req.body.action || doc.action;
  doc.updatedAt = new Date().toISOString();
  event(db, 'document.action', `${doc.name}: ${doc.lastAction}`, { projectId: req.params.projectId, documentId: doc.id });
  await writeDb(db);
  res.json(doc);
});

const mdrClassRank = {
  'Class I': 1,
  'Class IIa': 2,
  'Class IIb': 3,
  'Class III': 4
};

function highestMdrCandidate(candidates) {
  return [...candidates].sort((a, b) => (mdrClassRank[b.deviceClass] || 0) - (mdrClassRank[a.deviceClass] || 0))[0] || null;
}

function candidate(rule, deviceClass, reason, applies = true) {
  return { rule, deviceClass, reason, applies };
}

function classifyEuMdr(input = {}) {
  const candidates = [];
  const gaps = [];
  const excludedRules = [];

  if (input.isMedicalDevice === false) {
    return {
      finalClass: 'Out of MDR scope',
      controllingRule: 'Scope',
      candidateRules: [],
      excludedRules: [],
      informationGaps: ['The product is marked as not having a medical purpose under MDR.'],
      rationale: 'MDR classification is not performed because the product is outside the declared MDR medical-device scope.',
      regulatoryBasis: ['Regulation (EU) 2017/745 Article 51', 'MDR Annex VIII']
    };
  }
  if (input.isIvd) gaps.push('Product may fall under IVDR rather than MDR; confirm regulatory scope before MDR classification.');
  if (!input.intendedUse) gaps.push('Intended purpose is missing.');
  if (!input.invasiveRoute) gaps.push('Invasive route is missing.');
  if (!input.duration) gaps.push('Duration of use is missing.');

  if (input.invasiveRoute === 'none') {
    candidates.push(candidate('Rule 1', 'Class I', 'Non-invasive device or device only contacting intact skin, subject to special-rule screening.'));
  }
  if (input.invasiveRoute === 'natural-orifice') {
    const classForRule5 = input.duration === 'long-term' ? 'Class IIb' : input.duration === 'short-term' ? 'Class IIa' : 'Class I';
    candidates.push(candidate('Rule 5', classForRule5, 'Device enters the body through a natural orifice and is not surgically invasive.'));
  }
  if (input.invasiveRoute === 'surgically-invasive' && input.duration === 'transient') {
    if (input.isReusableSurgicalInstrument) {
      candidates.push(candidate('Rule 6', 'Class I', 'Reusable surgical instrument for transient surgically invasive use; mark Ir separately.'));
    } else if (input.contactsHeartCentralCirculationOrCns) {
      candidates.push(candidate('Rule 6', 'Class III', 'Transient surgically invasive device directly contacting the heart, central circulatory system, or central nervous system.'));
    } else if (input.ionizingRadiation || input.biologicalEffectOrAbsorbed || input.administersMedicinalProductHazardously) {
      candidates.push(candidate('Rule 6', 'Class IIb', 'Transient surgically invasive device meets a Rule 6 escalation condition.'));
    } else {
      candidates.push(candidate('Rule 6', 'Class IIa', 'Transient surgically invasive device without Rule 6 escalation conditions.'));
    }
  }
  if (input.invasiveRoute === 'surgically-invasive' && input.duration === 'short-term') {
    candidates.push(candidate(input.contactsHeartCentralCirculationOrCns ? 'Rule 7' : 'Rule 7', input.contactsHeartCentralCirculationOrCns ? 'Class III' : 'Class IIa', 'Short-term surgically invasive device.'));
  }
  if (input.invasiveRoute === 'implantable' || input.duration === 'long-term') {
    candidates.push(candidate('Rule 8', input.contactsHeartCentralCirculationOrCns || input.specialRisks?.implantHighRisk ? 'Class III' : 'Class IIb', 'Implantable or long-term surgically invasive device.'));
  }

  if (input.isActive && input.activeFunction === 'therapy') {
    const isHazardousEnergy = Boolean(input.hazardousEnergy || /high[- ]?frequency|radiofrequency|laser|ultrasound|electrosurgical|coagulation|cutting/i.test(`${input.energyType || ''} ${input.intendedUse || ''}`));
    candidates.push(candidate('Rule 9', isHazardousEnergy ? 'Class IIb' : 'Class IIa', isHazardousEnergy
      ? `Active therapeutic device administering potentially hazardous energy${input.energyType ? ` (${input.energyType})` : ''}.`
      : 'Active therapeutic device administering or exchanging energy without a declared hazardous-energy condition.'));
  }
  if (input.isActive && input.activeFunction === 'diagnosis-monitoring') {
    candidates.push(candidate('Rule 10', input.monitorsVitalParametersImmediateDanger ? 'Class IIb' : 'Class IIa', 'Active diagnostic or monitoring device.'));
  }
  if (input.isSoftware) {
    const softwareClass = input.softwareRisk === 'death-or-irreversible' ? 'Class III'
      : input.softwareRisk === 'serious-deterioration-or-surgery' ? 'Class IIb'
        : input.softwareRisk === 'diagnosis-treatment-decision' || input.softwareRisk === 'physiological-monitoring' ? 'Class IIa'
          : 'Class I';
    candidates.push(candidate('Rule 11', softwareClass, 'Medical device software classification based on intended decision support or monitoring risk.'));
  }
  if (input.isActive && input.activeFunction === 'administer-remove-substances') {
    candidates.push(candidate('Rule 12', input.administersMedicinalProductHazardously ? 'Class IIb' : 'Class IIa', 'Active device administering or removing medicinal products, body liquids, or other substances.'));
  }
  if (input.isActive && !['therapy', 'diagnosis-monitoring', 'administer-remove-substances'].includes(input.activeFunction || '') && !input.isSoftware) {
    candidates.push(candidate('Rule 13', 'Class I', 'Other active device not covered by Rules 9-12.'));
  }

  if (input.specialRisks?.medicinalSubstance) candidates.push(candidate('Rule 14', 'Class III', 'Device incorporates a medicinal substance with ancillary action.'));
  if (input.specialRisks?.contraceptionOrStdPrevention) candidates.push(candidate('Rule 15', input.invasiveRoute === 'implantable' || input.duration === 'long-term' ? 'Class III' : 'Class IIb', 'Device intended for contraception or prevention of sexually transmitted diseases.'));
  if (input.specialRisks?.disinfectionSterilization) candidates.push(candidate('Rule 16', input.specialRisks?.disinfectsInvasiveDevices ? 'Class IIb' : 'Class IIa', 'Device intended for cleaning, disinfection, or sterilization of medical devices.'));
  if (input.specialRisks?.xrayDiagnosticImage) candidates.push(candidate('Rule 17', 'Class IIa', 'Device records diagnostic X-ray images.'));
  if (input.specialRisks?.animalHumanTissue) candidates.push(candidate('Rule 18', input.contactsIntactSkinOnly ? 'Class I' : 'Class III', 'Device uses non-viable human or animal tissues, cells, or derivatives.'));
  if (input.specialRisks?.nanomaterial) candidates.push(candidate('Rule 19', input.specialRisks?.nanomaterialExposure === 'high-or-medium' ? 'Class III' : input.specialRisks?.nanomaterialExposure === 'low' ? 'Class IIb' : 'Class IIa', 'Device incorporates nanomaterial.'));
  if (input.specialRisks?.inhalationAdministration) candidates.push(candidate('Rule 20', input.specialRisks?.lifeThreateningOrImportantDrugImpact ? 'Class IIb' : 'Class IIa', 'Device administers medicinal products by inhalation.'));
  if (input.specialRisks?.substanceIntroduced) candidates.push(candidate('Rule 21', input.specialRisks?.systemicallyAbsorbed ? 'Class III' : 'Class IIb', 'Device composed of substances or combinations introduced into the body.'));
  if (input.specialRisks?.closedLoopIntegratedDiagnostic) candidates.push(candidate('Rule 22', 'Class III', 'Active therapeutic device with integrated diagnostic function significantly determining patient management.'));

  const final = highestMdrCandidate(candidates);
  if (!final) gaps.push('No MDR classification rule could be applied from the supplied attributes.');

  const allRules = Array.from({ length: 22 }, (_, index) => `Rule ${index + 1}`);
  for (const rule of allRules) {
    if (!candidates.some((item) => item.rule === rule)) excludedRules.push({ rule, reason: 'No triggering attribute was declared in this questionnaire version.' });
  }

  return {
    finalClass: final?.deviceClass || 'Insufficient information',
    controllingRule: final?.rule || 'Undetermined',
    candidateRules: candidates,
    excludedRules,
    informationGaps: gaps,
    rationale: final
      ? `${input.productName || 'The device'} is classified as ${final.deviceClass} under ${final.rule}. ${final.reason}`
      : 'Classification cannot be completed until the missing attributes are confirmed.',
    regulatoryBasis: [
      'Regulation (EU) 2017/745 Article 51',
      'MDR Annex VIII classification rules',
      'MDCG 2021-24 Rev.1 classification guidance'
    ]
  };
}

app.post('/api/classifiers/eu-mdr', (req, res) => {
  res.json(classifyEuMdr(req.body || {}));
});

app.post('/api/ai/draft', async (req, res) => {
  const db = await readDb();
  const prompt = req.body.prompt || '';
  const result = {
    id: `draft-${Date.now()}`,
    title: 'AI Draft',
    summary: `根据提示生成了任务草案：${prompt.slice(0, 80)}`,
    sections: [
      '法规依据和输入资料确认',
      '证据缺口与ACTION REQUIRED',
      '建议生成的文档章节',
      '下一步人工审阅动作'
    ]
  };
  event(db, 'ai.draft', result.summary, {});
  await writeDb(db);
  res.json(result);
});

app.get('/api/events', async (req, res) => {
  const db = await readDb();
  res.json(db.events);
});

const port = Number(process.env.PORT || 8787);
app.listen(port, '127.0.0.1', () => {
  console.log(`Reguverse local API running at http://127.0.0.1:${port}`);
});
