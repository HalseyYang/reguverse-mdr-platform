import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BadgeCheck,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Database,
  FileCheck2,
  FileDown,
  FileSearch,
  Files,
  FlaskConical,
  Globe2,
  Layers3,
  Library,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  Network,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  SquarePen,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  Workflow
} from 'lucide-react';
import './styles.css';
import {
  HONG_KONG_REGULATORY_REGION,
  fieldConfigurationForRegulatoryRegion,
  recommendHongKongDeviceClass,
  regulatoryRegionOptions
} from './features/hong-kong-registration/regulatory-options.js';
import { ProjectManagement, ProjectNavGroup } from './features/project-management/project-navigation.jsx';
import { HongKongRegistrationTask } from './features/hong-kong-registration/HongKongRegistrationTask.jsx';
import { profileFor, incompatiblePopulatedFieldsWithAliases, clearIncompatibleMarketFields, normalizeMarketProfile, recommendHongKongDeviceClassForProfile, recommendUnitedStatesFdaSubmissionPathway, wizardSectionsFor } from './features/device-profile/market-profile-configurations.js';
import { canVisitStep, isFinalStep, navigationStepIdForDataSection, nextStep, previousStep, readStoredProfileDraft, savePlanForStepAction, writeStoredProfileDraft } from './features/device-profile/profile-navigation.js';

const navItems = [
  { id: 'dashboard', label: '总览', icon: Activity }
];

const seedProjects = [
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
];

const taskTypes = [
  ['Clinical Evaluation', 'EU MDR clinical evaluation workflow (10 steps)', 'CER / CEP / DCR', 62],
  ['GSPR Analysis', 'Annex I GSPR compliance checklist', 'GSPR 1-23', 18],
  ['Risk Management', 'ISO 14971 hazard, analysis, controls and BRA', 'Risk Register', 48],
  ['NMPA Registration', 'Import device registration eRPS CH1-CH6', 'CH1-CH6', 37],
  ['PMS / PMCF / PSUR', 'PMS activity, PMCF report, PSUR and CER update', 'Lifecycle', 25],
  ['Technical Documentation', 'Annex II/III technical documentation assembly', 'TD File', 12]
];

const taskTemplateCards = [
  ['clinical-evaluation', 'Clinical Evaluation', '初始化10步CER流程，并创建CER/CEP/DCR文档输出。', 'CER / CEP / DCR'],
  ['gspr-analysis', 'GSPR Analysis', '创建Annex I GSPR符合性任务，用于后续证据缺口和检查表。', 'GSPR Checklist'],
  ['risk-management', 'Risk Management', '创建ISO 14971风险管理任务，用于危害、控制和获益风险总结。', 'Risk File']
];

const clinicalSteps = [
  ['1', '预期用途确认', '预期用途摘要、适应症、目标人群、预期用户、禁忌/警告/注意事项、初步临床获益', '已批准'],
  ['2', '临床背景与 SOTA 综述', 'PubMed指南/综述、疾病流行病学、替代治疗、当前技术水平基线', '已批准'],
  ['3', '文献检索策略', 'PICO框架、SOTA/Similar/DUE检索词、PubMed和Embase检索式', '已批准'],
  ['4', '文献筛选', '上传RIS/NBIB/TXT、元数据标注、解析去重、AI批量标题/摘要筛选', '生成中'],
  ['5', '安全数据检索', 'DUE制造商安全数据、PMS/PMCF、市场历史和等同性相关安全信号', '待解锁'],
  ['6', '全文评价', '相关文献全文评价、质量评价、排除理由、证据等级', '待解锁'],
  ['7', '数据提取与端点', 'DCR证据表、有效性/安全性端点、SOTA接受标准', '待解锁'],
  ['8', '临床获益与风险', '临床获益确认、残余风险、获益风险结论', '待解锁'],
  ['9', '等同性分析', '技术/生物/临床等同性，按路径决定是否激活', '条件激活'],
  ['10', 'CER/CEP/DCR 组装', '批准步骤结果汇总生成DCR、CEP、CER并导出Word', '待解锁']
];

const projectWizard = [
  ['1', '基础信息', '法规类型、通用名/器械类型、器械类别、分类规则；不确定时先用AI分类工具。'],
  ['2', '适用范围', '预期用途建议复制IFU英文原文；器械描述和工作原理可中文填写。'],
  ['3', '认证与市场', '初次CE、MDD转MDR、定期CER更新；影响Step 5/6安全数据检索范围。'],
  ['4', '公司信息', '制造商、SRN、注册地址；会进入最终CEP/CER文档。'],
  ['5', '评价路径', '等同认定路径、临床试验路径、混合路径或免临床评价；影响Step 10。'],
  ['6', '评价范围', '数据库选择、检索策略标准、筛选方法和质量评价方法。'],
  ['7', '确认', '汇总核对器械类别、评价类型、评价路径，确认后创建项目。']
];

const euMdrDeviceClasses = ['Class I', 'Class Is', 'Class Im', 'Class Ir', 'Class IIa', 'Class IIb', 'Class III', 'Not determined'];

const euMdrClassificationRules = [
  'Rule 1 - Non-invasive devices',
  'Rule 2 - Channeling or storing blood/body liquids/tissues/gases',
  'Rule 3 - Modifying biological or chemical composition',
  'Rule 4 - Non-invasive devices in contact with injured skin or mucous membrane',
  'Rule 5 - Invasive devices through body orifices',
  'Rule 6 - Surgically invasive transient use',
  'Rule 7 - Surgically invasive short-term use',
  'Rule 8 - Implantable and long-term surgically invasive devices',
  'Rule 9 - Active therapeutic devices',
  'Rule 10 - Active diagnostic and monitoring devices',
  'Rule 11 - Software',
  'Rule 12 - Other active devices',
  'Rule 13 - Devices incorporating medicinal substances',
  'Rule 14 - Devices incorporating human blood/plasma derivatives',
  'Rule 15 - Contraception or prevention of sexually transmitted diseases',
  'Rule 16 - Disinfecting, cleaning, rinsing, hydrating contact lenses/devices',
  'Rule 17 - Devices using non-viable human/animal tissues or cells',
  'Rule 18 - Blood bags',
  'Rule 19 - Nanomaterial devices',
  'Rule 20 - Invasive devices administering medicinal products by inhalation',
  'Rule 21 - Substances introduced into the body',
  'Rule 22 - Active therapeutic devices with integrated diagnostic function',
  'Other / Manual classification rationale required'
];

const defaultDeviceProfile = {
  projectId: 'eu-cer',
  basics: {
    productName: 'Kranus Mictera',
    genericName: 'Digital therapeutic for urinary incontinence',
    regulation: 'EU MDR',
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
};

const profileSections = [
  {
    id: 'basics',
    title: '基础信息',
    hint: '这些字段会决定法规路径、分类判断和后续AI提示词的基础语境。',
    fields: [
      ['productName', '产品名称', true, 'input'],
      ['genericName', '通用名/器械类型', true, 'input'],
      ['regulation', '法规区域', true, 'select', regulatoryRegionOptions],
      ['deviceClass', '器械类别', true, 'select', euMdrDeviceClasses],
      ['classificationRule', '分类规则', true, 'select', euMdrClassificationRules]
    ]
  },
  {
    id: 'scope',
    title: '适用范围',
    hint: '预期用途建议使用IFU英文原文；它会注入临床评价后续全部步骤。',
    fields: [
      ['intendedUse', 'Intended Use', true, 'textarea'],
      ['indications', 'Indications', true, 'textarea'],
      ['targetPopulation', '目标人群', true, 'textarea'],
      ['intendedUsers', '预期用户', true, 'textarea'],
      ['useEnvironment', '使用环境', false, 'input'],
      ['operatingPrinciple', '工作原理', true, 'textarea']
    ]
  },
  {
    id: 'market',
    title: '认证与市场',
    hint: 'CE情形和临床研究摘要会影响安全数据检索范围和证据路径。',
    fields: [
      ['ceScenario', 'CE认证情形', true, 'select', ['Initial certification / clinical trial evidence route', 'Initial certification / marketed elsewhere', 'MDD to MDR transition', 'CER update / PMS activity']],
      ['marketedStatus', '上市状态', true, 'textarea'],
      ['marketHistory', '市场历史', false, 'textarea'],
      ['clinicalStudySummary', '临床研究摘要', true, 'textarea']
    ]
  },
  {
    id: 'company',
    title: '公司信息',
    hint: '制造商、SRN、注册地址会进入CEP/CER正文和封面信息。',
    fields: [
      ['manufacturer', '制造商', true, 'input'],
      ['manufacturerAddress', '制造商地址', true, 'input'],
      ['srn', 'SRN', false, 'input'],
      ['euAuthorizedRepresentative', '欧代信息', false, 'input'],
      ['teamSize', '团队规模', false, 'input']
    ]
  },
  {
    id: 'pathway',
    title: '评价路径',
    hint: '不同路径会决定等同性分析是否激活，以及Step 10的组装方式。',
    fields: [
      ['evaluationPathway', '评价路径', true, 'select', ['Clinical trial route', 'Equivalence route', 'Mixed route', 'Exempt from clinical evaluation']],
      ['equivalenceNeeded', '是否需要等同性分析', true, 'select', ['Yes', 'No', 'Conditional']],
      ['clinicalEvaluationType', '评价类型', true, 'select', ['Initial clinical evaluation', 'CER update / PMS activity', 'MDD to MDR transition']],
      ['step10EquivalenceActive', 'Step 10等同性是否激活', true, 'select', ['Yes', 'No', 'Conditional']]
    ]
  },
  {
    id: 'scopeSettings',
    title: '评价范围',
    hint: '这里先定义默认检索数据库、年限、筛选和质量评价方法。',
    fields: [
      ['databases', '文献数据库', true, 'input'],
      ['searchWindow', '检索年限', true, 'input'],
      ['screeningMethod', '筛选方法', true, 'textarea'],
      ['appraisalMethod', '质量评价方法', true, 'textarea'],
      ['exportFormats', '导出格式', true, 'input']
    ]
  },
  {
    id: 'confirmations',
    title: '确认',
    hint: '确认页列出必须人工核对的字段，避免错误滚雪球进入后续步骤。',
    fields: [
      ['required', '需人工确认事项', true, 'textarea'],
      ['status', '画像状态', true, 'select', ['draft', 'ready for review', 'approved']]
    ]
  }
];

function createEmptyDeviceProfile() {
  return profileSections.reduce((profile, section) => ({
    ...profile,
    [section.id]: section.fields.reduce((values, [key, , , , options]) => ({
      ...values,
      [key]: key === 'status' ? 'draft' : options?.[0] || ''
    }), {})
  }), { projectId: null });
}

function getMissingProfileFields(profile) {
  return profileSections.flatMap((section) =>
    section.fields
      .filter(([key, , required]) => required && !String(profile[section.id]?.[key] || '').trim())
      .map(([key, label]) => ({ sectionId: section.id, key, label, text: `${section.title} / ${label}` }))
  );
}

function statusLabel(status) {
  const labels = {
    approved: '已批准',
    generated: '已生成',
    generating: '生成中',
    not_started: '待开始',
    locked: '待解锁',
    conditional: '条件激活',
    draft: '草稿'
  };
  return labels[status] || status || '待开始';
}

const contextFiles = [
  ['IFU / Labeling', '用于Step 1预期用途、禁忌、警告、注意事项核对'],
  ['Clinical Study Summary', 'DINKS试验、主要终点、次要终点、安全性'],
  ['PubMed SOTA NBIB', '数据库 PubMed · 类型 SOTA · 自动识别'],
  ['Embase DUE RIS', '数据库 Embase · 类型 DUE · 自动识别'],
  ['Risk Management File', '用于Step 8获益风险和GSPR交叉引用']
];

const screeningArticles = [
  ['Krieger E, et al. 2026', 'Digital Therapy for Male LUTS: Results After Mid- and Longterm Follow-Up', 'Relevant as Similar Device evidence.'],
  ['Hafkamp A, et al. 2025', 'App-based therapy for female patients with urinary incontinence in Germany (DINKS)', 'Highly relevant as device under evaluation clinical evidence.'],
  ['Wiemer L, et al. 2025', 'Defining Minimal Important Difference in LUTS patient-centered anchor measure', 'Relevant to SOTA and endpoint acceptance criteria.'],
  ['Wadensten T, et al. 2021', 'Mobile app for self-management of urgency and mixed urinary incontinence', 'Relevant to similar digital therapeutic evidence.']
];

const documents = [
  ['Clinical Evaluation Report (CER)', 'approved', 'Insert / Export Word', 'Clinical Evaluation'],
  ['Clinical Evaluation Plan (CEP)', 'draft', 'Generate', 'Clinical Evaluation'],
  ['Data Collection Report (DCR)', 'ready', 'Download Word', 'Clinical Evaluation'],
  ['GSPR Compliance Checklist', 'draft', 'Generate', 'GSPR Analysis'],
  ['Risk Management Report', 'editing', 'Approve content', 'Risk Management'],
  ['NMPA eRPS CH3.8 Comparison', 'not started', 'Create chapter', 'NMPA Registration']
];

const knowledgeSources = [
  ['EU MDR 2017/745', '法规库', 'Articles, Annex I, Annex II/III, Annex XIV'],
  ['MDCG Guidance', '指南库', 'CER, PMCF, PMS, PSUR, legacy device guidance'],
  ['NMPA Classification Catalog', '中国分类', 'L1/L2/L3目录、免临床评价目录、标准库'],
  ['FDA Guidance / TPLC', '美国数据', '510(k), De Novo, product code lifecycle signals'],
  ['Enterprise Templates', '企业私有库', 'CER模板、GSPR模板、历史回复、内部术语'],
  ['Uploaded Context Files', '项目资料', 'IFU、风险管理、PMS、PMCF、临床文献']
];

const apiDomains = [
  ['/api/v1/projects', '项目、设备画像、任务、上下文文件'],
  ['/api/v1/clinical-eval', 'CER、CEP、DCR、步骤结果、文档生成'],
  ['/api/v1/pms', 'PMS、PMCF、PSUR、CER update'],
  ['/api/v1/nmpa', '分类目录、免临床评价、eRPS元数据、AI补全'],
  ['/api/v1/classifier', 'EU/FDA/NMPA分类与批量分类记录'],
  ['/api/v1/knowledge', '法规知识库与检索'],
  ['/api/v1/qms', 'eQMS文档模块'],
  ['/api/v1/tplc', '生命周期模板'],
  ['/api/v1/translation', '术语库、文件翻译、段落翻译'],
  ['/api/v1/auth', '账号、套餐、2FA、支付、管理员配置'],
  ['/api/v1/organizations', '组织、邀请、团队成员、企业权限'],
  ['/api/v1/llm', 'LLM健康检查、配置、对话生成']
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787/api';

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function App() {
  const [active, setActive] = useState('dashboard');
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [projectList, setProjectList] = useState(seedProjects);
  const [projectDetail, setProjectDetail] = useState(null);
  const [apiStatus, setApiStatus] = useState('connecting');
  const [selectedProject, setSelectedProject] = useState(seedProjects[0]);
  const [selectedStep, setSelectedStep] = useState(clinicalSteps[1]);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [prompt, setPrompt] = useState('请基于当前项目生成 CER 第2步全文评价的证据缺口与行动项。');
  const [notice, setNotice] = useState('已加载医疗器械注册管理平台。项目、步骤和文件处理功能均可交互。');

  const notify = (message) => setNotice(message);

  const refreshProjects = async () => {
    try {
      const next = await api('/projects');
      setProjectList(next);
      setApiStatus('connected');
      setSelectedProject((current) => next.find((item) => item.id === current?.id) || next[0] || null);
    } catch (error) {
      setApiStatus('offline');
      notify('本地 API 未连接，当前使用前端演示数据。请运行 npm run api。');
    }
  };

  const refreshDetail = async (projectId = selectedProject?.id) => {
    if (!projectId) return;
    try {
      const detail = await api(`/projects/${projectId}`);
      setProjectDetail(detail);
      setApiStatus('connected');
    } catch {
      setProjectDetail(null);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    refreshDetail(selectedProject?.id);
  }, [selectedProject?.id]);
  const go = (tab, message) => {
    setActive(tab);
    if (message) notify(message);
  };

  const startProfileCreate = () => {
    setCreatingProfile(true);
    setActive('project-create');
    notify('已进入新建项目：请完成当前法规区域的必填信息后创建项目。');
  };

  const ActiveIcon = active.startsWith('project') || active === 'projects' ? Workflow : navItems.find((item) => item.id === active)?.icon || Activity;
  const activeTitle = active === 'project-management' ? '项目管理' : active === 'project-create' ? '新建项目' : active === 'projects' ? '项目详情' : navItems.find((item) => item.id === active)?.label;

  return (
    <div className="web-app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><img src="/assets/beauty-health-logo.jpg" alt="" /></div>
          <div className="brand-copy">
            <strong>医疗器械注册管理平台</strong>
            <span>Medical Device Registration Platform</span>
          </div>
        </div>
        <nav className="nav">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={active === id ? 'nav-item active' : 'nav-item'} aria-label={label} onClick={() => { setActive(id); refreshDetail(); }}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
          <ProjectNavGroup
            active={active}
            expanded={projectsExpanded}
            onToggle={() => setProjectsExpanded((value) => !value)}
            onManage={() => { setCreatingProfile(false); setActive('project-management'); }}
            onCreate={startProfileCreate}
          />
        </nav>
        <div className="tenant-card">
          <Building2 size={18} />
          <div>
            <strong>丽和康</strong>
            <span>企业工作区</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="title-row">
            <ActiveIcon size={22} />
            <div>
              <span>Regulatory workspace</span>
              <h1>{activeTitle}</h1>
            </div>
          </div>
          <div className="top-actions">
            <label className="global-search">
              <Search size={16} />
              <input placeholder="搜索项目、法规、文档、任务" />
            </label>
            <button className="ghost-btn" onClick={() => notify('已打开设置模拟：这里会配置模型、知识库同步、审批策略和导出权限。')}><Settings size={17} />设置</button>
            <button className="avatar" onClick={() => go('team', '已进入团队与账户相关区域。')}><UserRound size={18} /></button>
          </div>
        </header>

        <section className="content">
          {notice && <Notice message={`${apiStatus === 'connected' ? 'API已连接' : apiStatus === 'offline' ? 'API离线' : 'API连接中'} · ${notice}`} onClose={() => setNotice('')} />}
          {active === 'dashboard' && <Dashboard projects={projectList} selectedProject={selectedProject} setSelectedProject={setSelectedProject} go={go} notify={notify} refreshProjects={refreshProjects} startProfileCreate={startProfileCreate} />}
          {active === 'project-management' && <ProjectManagement api={api} projects={projectList} onRefresh={refreshProjects} notify={notify} onEnter={(project) => { setCreatingProfile(false); setSelectedProject(project); setActive('projects'); }} />}
          {active === 'project-create' && <Projects projects={projectList} selectedProject={selectedProject} setSelectedProject={setSelectedProject} selectedStep={selectedStep} setSelectedStep={setSelectedStep} notify={notify} detail={projectDetail} refreshDetail={refreshDetail} refreshProjects={refreshProjects} creatingProfile={true} setCreatingProfile={setCreatingProfile} startProfileCreate={startProfileCreate} onProjectCreated={() => setActive('projects')} />}
          {active === 'projects' && <Projects projects={projectList} selectedProject={selectedProject} setSelectedProject={setSelectedProject} selectedStep={selectedStep} setSelectedStep={setSelectedStep} notify={notify} detail={projectDetail} refreshDetail={refreshDetail} refreshProjects={refreshProjects} creatingProfile={creatingProfile} setCreatingProfile={setCreatingProfile} startProfileCreate={startProfileCreate} />}
          {active === 'documents' && <Documents notify={notify} selectedProject={selectedProject} detail={projectDetail} refreshDetail={refreshDetail} />}
          {active === 'knowledge' && <Knowledge />}
          {active === 'tools' && <Tools prompt={prompt} setPrompt={setPrompt} notify={notify} />}
          {active === 'team' && <Team />}
          {active === 'architecture' && <Architecture notify={notify} />}
        </section>
      </main>
    </div>
  );
}

function Dashboard({ projects, selectedProject, setSelectedProject, go, notify, startProfileCreate }) {
  if (!selectedProject) return <section className="panel empty-projects"><h2>暂无有效项目</h2><p>已删除项目不会显示在工作区。你可以新建项目继续。</p><button className="primary-btn" onClick={startProfileCreate}><Plus size={16} />新建项目</button></section>;
  return (
    <div className="dashboard-grid">
      <section className="panel span-3">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Active dossiers</span>
            <h2>项目组合</h2>
          </div>
          <button className="primary-btn" onClick={startProfileCreate}><Plus size={16} />新建项目</button>
        </div>
        <div className="project-grid">
          {projects.map((project) => (
            <button key={project.id} className={selectedProject?.id === project.id ? 'project-card active' : 'project-card'} onClick={() => {
              setSelectedProject(project);
              notify(`已选择项目：${project.title}`);
            }}>
              <div className="project-card-top">
                <strong>{project.title}</strong>
                <span>{project.market}</span>
              </div>
              <p>{project.product} · {project.deviceClass}</p>
              <div className="progress-line"><i style={{ width: `${project.progress}%` }} /></div>
              <div className="project-meta">
                <span>{project.status}</span>
                <b>{project.progress}%</b>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Projects({ projects, selectedProject, setSelectedProject, selectedStep, setSelectedStep, notify, detail, refreshDetail, refreshProjects, creatingProfile, setCreatingProfile, startProfileCreate, onProjectCreated }) {
  const fileInput = useRef(null);
  const createFileInput = useRef(null);
  const blankProfile = useMemo(() => createEmptyDeviceProfile(), [creatingProfile]);
  const [activeExtraction, setActiveExtraction] = useState(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const detailFiles = detail?.files?.length ? detail.files : contextFiles.map(([name, note], index) => ({
    id: `seed-${index}`,
    name,
    note,
    type: 'Context'
  }));
  const workflowSteps = detail?.steps?.length
    ? clinicalSteps.map((step) => {
      const stored = detail.steps.find((item) => item.id === step[0]);
      return stored ? [stored.id, stored.title, step[2], statusLabel(stored.status), stored.output] : step;
    })
    : clinicalSteps;

  useEffect(() => {
    setActiveExtraction(creatingProfile ? null : detail?.profileExtractions?.[0] || null);
  }, [creatingProfile, detail?.project?.id, detail?.profileExtractions?.[0]?.id]);

  const uploadContextFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('type', inferFileType(file.name));
    try {
      await api(`/projects/${selectedProject.id}/files`, {
        method: 'POST',
        body: form
      });
      await refreshDetail(selectedProject.id);
      notify(`已上传并保存上下文文件：${file.name}`);
    } catch {
      notify('上传失败：请确认本地 API 服务已启动。');
    } finally {
      event.target.value = '';
    }
  };

  const createTask = async (templateId) => {
    try {
      const result = await api(`/projects/${selectedProject.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId })
      });
      await refreshDetail(selectedProject.id);
      setShowTaskPicker(false);
      notify(`已创建/初始化任务：${result.task.title}`);
    } catch {
      notify('创建任务失败：请确认本地 API 服务已启动。');
    }
  };

  const uploadCreateProfileFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('type', inferFileType(file.name));
    try {
      const extraction = await api('/profile-extractions/preview', {
        method: 'POST',
        body: form
      });
      setActiveExtraction(extraction);
      notify(`已从 ${file.name} 识别 ${extraction.candidates.length} 个画像候选字段，请确认后应用到草稿。`);
    } catch {
      notify('文件识别失败：请上传可读取的文本、DOCX或PDF文件。');
    } finally {
      event.target.value = '';
    }
  };

  const runStepAction = async (action) => {
    const endpoint = action === 'approve' ? 'approve' : 'generate';
    try {
      const updated = await api(`/projects/${selectedProject.id}/steps/${selectedStep[0]}/${endpoint}`, { method: 'POST' });
      await refreshDetail(selectedProject.id);
      setSelectedStep((current) => current[0] === updated.id
        ? [updated.id, updated.title, current[2], statusLabel(updated.status), updated.output]
        : current
      );
      notify(`${action === 'approve' ? '已批准' : '已生成'}：${updated.title}，状态已写入本地数据库。`);
    } catch {
      notify('步骤动作失败：请确认本地 API 服务已启动。');
    }
  };

  const reviewStepField = async (field, payload) => {
    try {
      const updated = await api(`/projects/${selectedProject.id}/steps/${selectedStep[0]}/output/fields/${field.sectionId}/${field.fieldKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await refreshDetail(selectedProject.id);
      setSelectedStep((current) => current[0] === updated.id
        ? [updated.id, updated.title, current[2], statusLabel(updated.status), updated.output]
        : current
      );
      notify(`已更新字段：${field.label}`);
    } catch {
      notify('字段更新失败：如果步骤已批准，输出已锁定不能修改。');
    }
  };

  const extractProfileFromFile = async (file) => {
    if (!file.storedName) {
      notify('这个示例文件没有真实上传内容。请先上传IFU、产品说明或临床摘要文件，再运行识别。');
      return;
    }
    try {
      const extraction = await api(`/projects/${selectedProject.id}/files/${file.id}/extract-profile`, { method: 'POST' });
      setActiveExtraction(extraction);
      await refreshDetail(selectedProject.id);
      notify(`已识别 ${extraction.candidates.length} 个画像候选字段，请在画像模块中确认后应用。`);
    } catch {
      notify('文件识别失败：当前原型支持文本/Markdown/JSON等文本文件；DOCX/PDF需要本地解析依赖可用。');
    }
  };

  const selectProject = (project) => {
    setCreatingProfile(false);
    setSelectedProject(project);
    notify(`已切换到项目：${project.product}`);
  };

  const handleCreatedProfileProject = async (project) => {
    setCreatingProfile(false);
    setSelectedProject(project);
    await refreshDetail(project.id);
    onProjectCreated?.(project);
  };

  const deleteProject = async () => {
    const fileCount = detail?.files?.length || 0;
    const impact = `${selectedProject.title}\n关联文件：${fileCount} 个\n项目将移入已删除项目并保留 30 天；期间可恢复，期满后项目关联数据与文件引用将永久清除。`;
    if (!window.confirm(`确认删除项目？\n\n${impact}`)) return;
    await api(`/projects/${selectedProject.id}`, { method: 'DELETE' });
    await refreshProjects();
    setCreatingProfile(false);
    notify(`项目已移入回收区：${selectedProject.title}`);
  };

  if (!creatingProfile && !selectedProject) {
    return <section className="panel empty-projects"><h2>暂无有效项目</h2><p>请选择项目或创建新项目。</p><button className="primary-btn" onClick={startProfileCreate}><Plus size={16} />新建项目</button></section>;
  }

  if (!creatingProfile && selectedProject?.market === HONG_KONG_REGULATORY_REGION) {
    const hasHongKongBusinessTask = detail?.tasks?.some((task) =>
      task.title === '香港注册文件修订'
      || task.templateId === 'hong-kong-document-revision'
      || task.templateIdentifier === 'hong-kong-document-revision'
    );
    if (hasHongKongBusinessTask) {
      return <section className="panel task-workspace"><HongKongRegistrationTask project={selectedProject} api={api} notify={notify} /></section>;
    }
    return <section className="panel empty-projects"><h2>香港注册文件修订任务未初始化</h2><p>当前项目尚未包含“香港注册文件修订”业务任务，请先在项目画像中完成香港任务创建。</p></section>;
  }

  return (
    <div className="project-detail-layout">
      <aside className="left-panel">
        <div className="panel-head compact">
          <h2>项目</h2>
          <button className="icon-btn" onClick={startProfileCreate}><Plus size={16} /></button>
        </div>
        <button className={creatingProfile ? 'side-project active' : 'side-project'} onClick={startProfileCreate}>
          <strong>新建项目画像</strong>
          <span>填写信息并创建项目</span>
        </button>
        {projects.map((project) => (
          <button key={project.id} className={!creatingProfile && selectedProject.id === project.id ? 'side-project active' : 'side-project'} onClick={() => {
            selectProject(project);
          }}>
            <strong>{project.product}</strong>
            <span>{project.market} · {project.deviceClass}</span>
          </button>
        ))}
      </aside>
      <section className="panel task-workspace">
        <div className="project-header">
          <div>
            {!creatingProfile && <span className="eyebrow">Product description</span>}
            <h2>{creatingProfile ? '新建项目' : selectedProject.title}</h2>
            {!creatingProfile && <p>{`${selectedProject.manufacturer} · ${selectedProject.market} · ${selectedProject.deviceClass} · Digital Therapeutic / SaMD`}</p>}
          </div>
          <div className="button-row">
            <input className="hidden-file" ref={fileInput} type="file" onChange={uploadContextFile} />
            <input className="hidden-file" ref={createFileInput} type="file" onChange={uploadCreateProfileFile} />
            {creatingProfile && <button className="secondary-btn" onClick={() => createFileInput.current?.click()}><Upload size={16} />上传文件识别</button>}
            {!creatingProfile && <button className="secondary-btn" onClick={() => fileInput.current?.click()}><Upload size={16} />上传上下文文件</button>}
            {!creatingProfile && <button className="primary-btn" onClick={() => setShowTaskPicker((value) => !value)}><Plus size={16} />Add Task</button>}
            {!creatingProfile && <button className="danger-btn" onClick={deleteProject}><Trash2 size={16} />删除项目</button>}
          </div>
        </div>
        {!creatingProfile && showTaskPicker && (
          <section className="task-picker">
            <div className="panel-head compact">
              <div>
                <span className="eyebrow">Task templates</span>
                <h2>添加任务模板</h2>
              </div>
              <button className="ghost-btn" onClick={() => setShowTaskPicker(false)}>关闭</button>
            </div>
            <div className="task-picker-grid">
              {taskTemplateCards.map(([id, title, desc, output]) => (
                <button className="task-template-card" key={id} onClick={() => createTask(id)}>
                  <ClipboardCheck size={18} />
                  <strong>{title}</strong>
                  <span>{output}</span>
                  <p>{desc}</p>
                </button>
              ))}
            </div>
          </section>
        )}
        <DeviceProfileWizard
          mode={creatingProfile ? 'create' : 'edit'}
          projectId={creatingProfile ? null : selectedProject.id}
          profile={creatingProfile ? blankProfile : detail?.profile || defaultDeviceProfile}
          notify={notify}
          refreshDetail={refreshDetail}
          refreshProjects={refreshProjects}
          onCreated={handleCreatedProfileProject}
          onCancel={() => setCreatingProfile(false)}
          extraction={activeExtraction}
        />
        {creatingProfile && (
          <div className="create-mode-note">
            <ShieldCheck size={18} />
            <span>创建模式下不会使用 Kranus Mictera 默认值；只有保存后才会生成项目记录。</span>
          </div>
        )}
        {!creatingProfile && (
          <>
        <div className="context-grid">
          <div>
            <div className="panel-head compact">
              <h2>上下文文件</h2>
              <span className="status">{contextFiles.length} files</span>
            </div>
            <div className="context-list">
              {detailFiles.map((file) => (
                <div className="context-file" key={file.id || file.name}>
                  <Files size={17} />
                  <div>
                    <strong>{file.name}</strong>
                    <span>{file.note || file.type || '项目上下文文件'}</span>
                  </div>
                  <button className="mini-action" onClick={() => extractProfileFromFile(file)}>识别画像</button>
                </div>
              ))}
            </div>
          </div>
          <div className="study-card">
            <span className="eyebrow">Case data</span>
            <h2>DINKS Clinical Trial</h2>
            <p>12周、单盲、随机对照、多中心数字化远程试验；194例受试者，干预组尿失禁发作频率相对减少60.95%，对照组减少1.69%，p&lt;0.0001。</p>
          </div>
        </div>
          </>
        )}
        {!creatingProfile && <div className="task-type-grid">
          {(detail?.tasks?.length ? detail.tasks.map((task) => [
            task.title,
            task.title === 'Clinical Evaluation' ? 'EU MDR clinical evaluation workflow (10 steps)' : '项目任务模板',
            task.title === 'Clinical Evaluation' ? 'CER / CEP / DCR' : 'Workflow',
            task.progress || 0
          ]) : taskTypes).map(([title, desc, output, progress]) => (
            <TaskType key={title} title={title} desc={desc} output={output} progress={progress} />
          ))}
        </div>}
        {!creatingProfile && <div className="split">
          <div>
            <div className="panel-head compact">
              <h2>Clinical Evaluation Workflow</h2>
              <span className="status">10-step CER</span>
            </div>
            <div className="step-list">
              {workflowSteps.map((step) => (
                <button key={step[0]} className={selectedStep[0] === step[0] ? 'step-row active' : 'step-row'} onClick={() => {
                  setSelectedStep(step);
                  notify(`已打开步骤：${step[1]}`);
                }}>
                  <span>{step[0]}</span>
                  <div>
                    <strong>{step[1]}</strong>
                    <small>{step[2]}</small>
                  </div>
                  <b>{step[3]}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="detail-panel">
            <span className="eyebrow">Step detail</span>
            <h2>{selectedStep[1]}</h2>
            <p>{selectedStep[2]}</p>
            <StepOutput step={selectedStep} onFieldReview={reviewStepField} />
            <div className="approval-box">
              <CheckCircle2 size={18} />
              <span>点击批准前需确认 AI 内容已对照原始文件和法规来源核对。每一步批准结果会注入后续步骤上下文，错误会向后传递。</span>
            </div>
            <div className="button-row">
              <button className="secondary-btn" onClick={() => runStepAction('approve')}><CheckCircle2 size={16} />批准</button>
              <button className="secondary-btn" onClick={() => notify(`插入Word模拟：${selectedStep[1]} 的当前内容会写入目标文档。`)}><FileDown size={16} />插入Word</button>
              <button className="secondary-btn" onClick={() => notify(`正在编辑：${selectedStep[1]}。这里会显示富文本、证据引用和人工审批控件。`)}><SquarePen size={16} />编辑</button>
              <button className="secondary-btn" onClick={() => notify(`Chat to Revise：你可以输入“把目标人群改为25-65岁女性”这类修改指令。`)}><MessageSquareText size={16} />Chat to Revise</button>
              <button className="primary-btn" onClick={() => runStepAction('generate')}><Sparkles size={16} />生成</button>
            </div>
          </div>
        </div>}
      </section>
    </div>
  );
}

function DeviceProfileWizard({ mode = 'edit', projectId, profile, notify, refreshDetail, refreshProjects, onCreated, onCancel, extraction }) {
  const [activeSection, setActiveSection] = useState('basics');
  const [draft, setDraft] = useState(profile || defaultDeviceProfile);
  const [dirty, setDirty] = useState(false);
  const [visitedSteps, setVisitedSteps] = useState(['basics']);
  const [savedAt, setSavedAt] = useState(null);
  const [candidateEdits, setCandidateEdits] = useState({});
  const [pendingRegionChange, setPendingRegionChange] = useState(null);
  const draftStorageKey = `reguverse-profile-draft-${mode === 'create' ? 'create' : projectId || 'unknown'}`;

  useEffect(() => {
    if (mode === 'create') {
      const savedDraft = readStoredProfileDraft(localStorage, draftStorageKey, profile || defaultDeviceProfile);
      setDraft(normalizeMarketProfile(savedDraft));
    } else {
      setDraft(normalizeMarketProfile(profile || defaultDeviceProfile));
    }
    setDirty(false);
    setActiveSection('basics');
    setVisitedSteps(['basics']);
    setSavedAt(null);
  }, [profile?.projectId, profile?.updatedAt, mode, draftStorageKey]);

  useEffect(() => {
    setCandidateEdits({});
  }, [extraction?.id]);

  const regulatoryFieldConfiguration = fieldConfigurationForRegulatoryRegion(draft.basics?.regulation);
  const selectedMarketProfile = profileFor(draft.basics?.regulation, draft);
  const legacyResolvedProfileSections = profileSections.map((profileSection) => {
    if (profileSection.id !== 'basics') return profileSection;
    return {
      ...profileSection,
      fields: profileSection.fields.map((field) => {
        if (field[0] === 'deviceClass') return [...field.slice(0, 4), regulatoryFieldConfiguration.deviceClasses];
        if (field[0] === 'classificationRule') {
          return [
            field[0],
            regulatoryFieldConfiguration.classificationRuleLabel,
            field[2],
            field[3],
            regulatoryFieldConfiguration.classificationBasisOptions
          ];
        }
        return field;
      })
    };
  });
  const resolvedProfileSections = draft.basics?.regulation === 'EU MDR'
    ? legacyResolvedProfileSections.map((legacySection, index) => ({
      ...legacySection,
      id: selectedMarketProfile.steps[index]?.id || legacySection.id,
      dataSectionId: legacySection.id
    }))
    : wizardSectionsFor(draft.basics?.regulation, draft).map((step) => ({
      id: step.id,
      title: step.title,
      dataSectionId: step.dataSectionId,
      hint: '',
      fields: (step.id === 'basics' ? [{ sectionId: 'basics', name: 'regulation', label: '法规区域', required: true, type: 'select', options: regulatoryRegionOptions }, ...step.fields] : step.fields)
        .filter((marketField) => marketField.name !== 'hong_kong_classification_override_reason')
        .map((marketField) => [marketField.name, marketField.label, marketField.required, marketField.type === 'select' ? 'select' : 'input', marketField.options, marketField.sectionId])
    }));
  const section = resolvedProfileSections.find((item) => item.id === activeSection) || resolvedProfileSections[0];
  const missing = (draft.basics?.regulation === 'EU MDR' ? getMissingProfileFields(draft) : resolvedProfileSections.flatMap((profileSection) => profileSection.fields
    .filter(([key, , required, , , fieldSectionId]) => required && !String(draft[fieldSectionId || profileSection.dataSectionId || profileSection.id]?.[key] || '').trim())
    .map(([key, label, , , , fieldSectionId]) => ({ sectionId: fieldSectionId || profileSection.dataSectionId || profileSection.id, key, label, text: `${profileSection.title} / ${label}` }))));
  const recommendedHongKongClass = draft.basics?.regulation === HONG_KONG_REGULATORY_REGION
    ? recommendHongKongDeviceClassForProfile(draft)
    : '';
  const hasHongKongClassificationMismatch = Boolean(
    recommendedHongKongClass && draft.basics?.hong_kong_device_class && recommendedHongKongClass !== draft.basics.hong_kong_device_class
  );
  const navigationSteps = resolvedProfileSections.map(({ id, dataSectionId }) => ({ id, dataSectionId }));
  const missingWithOverrides = hasHongKongClassificationMismatch && !String(draft.basics?.hong_kong_classification_override_reason || '').trim()
    ? [...missing, { sectionId: 'basics', key: 'hong_kong_classification_override_reason', label: '类别调整理由', text: '基础信息 / 类别调整理由' }]
    : missing;
  const missingByStep = missingWithOverrides.reduce((groups, item) => {
    const stepId = navigationStepIdForDataSection(navigationSteps, item.sectionId);
    return { ...groups, [stepId]: [...(groups[stepId] || []), item] };
  }, {});
  const currentMissing = missingByStep[activeSection] || [];
  const finalStep = isFinalStep(navigationSteps, activeSection);

  const updateField = (sectionId, key, value) => {
    if (sectionId === 'basics' && key === 'regulation') {
      const incompatible = incompatiblePopulatedFieldsWithAliases(draft.basics?.regulation, value, draft);
      if (incompatible.length) {
        setPendingRegionChange({ value, incompatible });
        return;
      }
    }
    setDraft((current) => {
      const nextSection = { ...(current[sectionId] || {}), [key]: value };
      if (sectionId === 'basics' && key === 'hong_kong_classification_basis') {
        nextSection.hong_kong_device_class = recommendHongKongDeviceClassForProfile({ ...current, basics: nextSection });
        nextSection.hong_kong_classification_override_reason = '';
      }
      if (sectionId === 'basics' && key === 'regulation') {
        const configuration = fieldConfigurationForRegulatoryRegion(value);
        nextSection.classificationRule = '';
        nextSection.deviceClass = configuration.deviceClasses[0] || '';
        nextSection.classificationMismatchReason = '';
      }
      if (sectionId === 'basics' && key === 'classificationRule' && current.basics?.regulation === HONG_KONG_REGULATORY_REGION) {
        nextSection.deviceClass = recommendHongKongDeviceClass(value).recommendedClass;
        nextSection.classificationMismatchReason = '';
      }
      const nextProfile = { ...current, [sectionId]: nextSection };
      if (nextProfile.basics?.regulation === 'EU MDR') {
        const aliases = { productName: 'product_name', genericName: 'generic_name', deviceClass: 'eu_mdr_device_class', classificationRule: 'eu_mdr_classification_rule', intendedUse: 'intended_use', targetPopulation: 'target_population', intendedUsers: 'intended_users', operatingPrinciple: 'operating_principle', ceScenario: 'eu_mdr_certification_scenario', manufacturer: 'manufacturer_full_name', manufacturerAddress: 'manufacturer_address', evaluationPathway: 'clinical_evaluation_pathway' };
        if (aliases[key]) nextProfile[sectionId] = { ...nextProfile[sectionId], [aliases[key]]: value };
        if (sectionId === 'scopeSettings') nextProfile.evaluation_scope = { ...(nextProfile.evaluation_scope || {}), clinical_evaluation_scope: [nextSection.databases, nextSection.searchWindow, nextSection.screeningMethod, nextSection.appraisalMethod, nextSection.exportFormats].filter(Boolean).join('; ') };
      }
      if (nextProfile.basics?.regulation === 'FDA' && !nextProfile.market?.selected_submission_pathway) {
        const recommended = recommendUnitedStatesFdaSubmissionPathway(nextProfile);
        if (recommended !== 'Needs regulatory assessment') nextProfile.market = { ...(nextProfile.market || {}), selected_submission_pathway: recommended };
      }
      if (sectionId === 'pathway' && key === 'relies_on_other_market_approval' && value !== 'Yes') {
        const { other_market_approval_type, ...remainingPathway } = nextProfile.pathway || {};
        nextProfile.pathway = remainingPathway;
      }
      return nextProfile;
    });
    markDirty();
  };

  const confirmRegionChange = () => {
    if (!pendingRegionChange) return;
    const next = clearIncompatibleMarketFields(draft.basics?.regulation, pendingRegionChange.value, draft);
    next.basics = { ...next.basics, regulation: pendingRegionChange.value };
    const normalizedNext = normalizeMarketProfile(next);
    setDraft(normalizedNext);
    const firstStep = profileFor(pendingRegionChange.value, normalizedNext).steps[0]?.id || 'basics';
    setActiveSection(firstStep);
    setVisitedSteps([firstStep]);
    markDirty();
    setPendingRegionChange(null);
  };

  const candidateKey = (candidate) => `${candidate.sectionId}.${candidate.fieldKey}`;

  const candidateValue = (candidate) => candidateEdits[candidateKey(candidate)] ?? candidate.value;

  const updateCandidateValue = (candidate, value) => {
    setCandidateEdits((current) => ({
      ...current,
      [candidateKey(candidate)]: value
    }));
  };

  const applyCandidate = (candidate) => {
    updateField(candidate.sectionId, candidate.fieldKey, candidateValue(candidate));
    notify(`已应用候选字段：${candidate.label}`);
  };

  const applyAllCandidates = () => {
    if (!extraction?.candidates?.length) return;
    setDraft((current) => {
      const next = { ...current };
      for (const candidate of extraction.candidates) {
        next[candidate.sectionId] = {
          ...(next[candidate.sectionId] || {}),
          [candidate.fieldKey]: candidateEdits[`${candidate.sectionId}.${candidate.fieldKey}`] ?? candidate.value
        };
      }
      return next;
    });
    markDirty();
    notify(`已应用 ${extraction.candidates.length} 个候选字段，请检查后保存画像。`);
  };

  const markSaved = () => {
    setSavedAt(new Date());
    setDirty(false);
  };

  const markDirty = () => {
    setDirty(true);
    setSavedAt(null);
  };

  const saveRecoveryDraft = () => writeStoredProfileDraft(localStorage, draftStorageKey, draft);

  const saveExistingProfile = async (saveMode = 'draft') => {
    await api(`/projects/${projectId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: normalizeMarketProfile(draft), save_mode: saveMode })
    });
  };

  const saveDraft = async () => {
    const localSaved = saveRecoveryDraft();
    const plan = savePlanForStepAction({ mode, action: 'draft' });
    if (!plan.server) {
      if (!localSaved) {
        markDirty();
        notify('画像草稿未能保存到本机，请检查浏览器存储权限。');
        return;
      }
      markSaved();
      notify('画像草稿已保存到本机浏览器。');
      return;
    }
    try {
      await saveExistingProfile(plan.saveMode);
      markSaved();
      notify('画像草稿已保存到项目。');
    } catch {
      markDirty();
      notify('保存画像草稿失败，请确认本地 API 服务已启动。');
    }
  };

  const goToStep = (targetStep) => {
    const result = canVisitStep({ steps: navigationSteps, targetStep, visited: visitedSteps, missingByStep });
    if (!result.allowed) {
      setActiveSection(result.blockedStep);
      notify(`请先补齐当前步骤的 ${result.missing.length} 项必填字段。`);
      return;
    }
    setActiveSection(targetStep);
    setVisitedSteps((current) => [...new Set([...current, targetStep])]);
  };

  const goBack = () => {
    const target = previousStep(navigationSteps, activeSection);
    if (target) setActiveSection(target);
  };

  const advance = async () => {
    const result = nextStep({ steps: navigationSteps, activeStep: activeSection, missingByStep, visited: visitedSteps });
    if (result.action === 'invalid') {
      notify('当前步骤无效，请重新打开设备画像。');
      return;
    }
    if (result.action === 'missing') {
      notify(`当前步骤还有 ${result.missing.length} 项必填字段缺失。`);
      return;
    }
    const localSaved = saveRecoveryDraft();
    const plan = savePlanForStepAction({ mode, action: 'next' });
    if (plan.server) {
      try {
        await saveExistingProfile(plan.saveMode);
        markSaved();
      } catch {
        markDirty();
        notify('自动保存设备画像失败，请确认本地 API 服务已启动。');
        return;
      }
    } else if (!localSaved) {
      markDirty();
      notify('画像草稿未能保存到本机，请检查浏览器存储权限。');
      return;
    } else {
      markSaved();
    }
    setVisitedSteps(result.visited);
    setActiveSection(result.nextStep);
  };

  const saveProfile = async () => {
    if (missingWithOverrides.length) {
      notify(`还有 ${missingWithOverrides.length} 项必填字段缺失，请补齐后再${mode === 'create' ? '创建项目' : '保存画像'}。`);
      setActiveSection(navigationStepIdForDataSection(navigationSteps, missingWithOverrides[0].sectionId));
      return;
    }
    if (hasHongKongClassificationMismatch && !String(draft.basics?.hong_kong_classification_override_reason || '').trim()) {
      notify('器械类别与系统推荐不一致，请填写修改类别的理由后再继续。');
      setActiveSection('basics');
      return;
    }
    try {
      const formalDraft = normalizeMarketProfile(draft);
      const saved = await api(mode === 'create' ? '/projects/from-profile' : `/projects/${projectId}/profile`, {
        method: mode === 'create' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'create' ? { profile: formalDraft } : { profile: formalDraft, save_mode: 'final' })
      });
      if (mode === 'create') {
        await refreshProjects();
        setDirty(false);
        notify(`已创建项目：${saved.project.title}`);
        await onCreated?.(saved.project);
        return;
      }
      const updated = saved;
      await refreshDetail(projectId);
      await refreshProjects();
      markSaved();
      notify(`设备画像已保存：${updated.basics?.productName || '未命名产品'}`);
    } catch {
      if (mode === 'edit') markDirty();
      notify(mode === 'create' ? '创建项目失败：请确认必填字段和本地 API 服务。' : '保存设备画像失败：请确认本地 API 服务已启动。');
    }
  };

  return (
    <section className="profile-builder">
      {pendingRegionChange && <div className="panel market-switch-dialog" role="dialog" aria-modal="true">
        <h3>切换市场将清除以下市场专属字段</h3>
        <ul>{pendingRegionChange.incompatible.map((item) => <li key={`${item.section}.${item.name}`}>{item.label}</li>)}</ul>
        <div className="button-row"><button className="secondary-btn" onClick={() => setPendingRegionChange(null)}>取消</button><button className="primary-btn" onClick={confirmRegionChange}>确认切换</button></div>
      </div>}
      <div className="panel-head">
        {mode !== 'create' && <div><h2>项目与设备画像</h2></div>}
        <div className="button-row">
          <span className={missingWithOverrides.length ? 'status warn' : 'status ok'}>{missingWithOverrides.length ? `${missingWithOverrides.length} 项必填缺失` : '字段完整'}</span>
          {dirty && <span className="status draft">未保存</span>}
          {mode === 'create' && <button className="secondary-btn" onClick={onCancel}>取消</button>}
        </div>
      </div>
      <div className="profile-layout profile-layout-without-summary">
        <div className="profile-steps">
          {resolvedProfileSections.map((item, index) => {
            const hasMissing = Boolean(missingByStep[item.id]?.length);
            const access = canVisitStep({ steps: navigationSteps, targetStep: item.id, visited: visitedSteps, missingByStep });
            return (
              <button key={item.id} className={activeSection === item.id ? 'profile-step active' : 'profile-step'} aria-current={activeSection === item.id ? 'step' : undefined} aria-disabled={!access.allowed} onClick={() => goToStep(item.id)}>
                <span>{index + 1}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{hasMissing ? '需补充' : '已填写'}</small>
                </div>
              </button>
            );
          })}
        </div>
        <div className="profile-form">
          <div className="section-note">
            <strong>{section.title}</strong>
            <p>{section.hint}</p>
          </div>
          <div className="profile-fields">
            {draft.basics?.regulation === 'FDA' && section.id === 'market' && <div className="profile-field wide classification-warning"><span>FDA 系统推荐路径</span><strong>{recommendUnitedStatesFdaSubmissionPathway(draft)}</strong></div>}
            {section.fields.map(([key, label, required, type, options, fieldSectionId]) => {
              const dataSectionId = fieldSectionId || section.dataSectionId || section.id;
              return (
              <label className={`${type === 'textarea' ? 'profile-field wide' : 'profile-field'}${currentMissing.some((item) => item.key === key && item.sectionId === dataSectionId) ? ' missing' : ''}`} key={key}>
                <span>{label}{required ? ' *' : ''}</span>
                {type === 'select' ? (
                  <select value={draft[dataSectionId]?.[key] || ''} onChange={(event) => updateField(dataSectionId, key, event.target.value)}>
                    <option value="">请选择</option>
                    {options.map((option) => {
                      const optionValue = typeof option === 'string' ? option : option.value;
                      const optionLabel = typeof option === 'string' ? option : option.label;
                      return <option key={optionValue} value={optionValue}>{optionLabel}</option>;
                    })}
                  </select>
                ) : type === 'textarea' ? (
                  <textarea value={draft[dataSectionId]?.[key] || ''} onChange={(event) => updateField(dataSectionId, key, event.target.value)} />
                ) : (
                  <input value={draft[dataSectionId]?.[key] || ''} onChange={(event) => updateField(dataSectionId, key, event.target.value)} />
                )}
              </label>
            );})}
            {hasHongKongClassificationMismatch && (
              <label className={`profile-field wide classification-warning${currentMissing.some((item) => item.key === 'hong_kong_classification_override_reason') ? ' missing' : ''}`}>
                <span>类别调整理由 *</span>
                <p>系统根据香港分类依据推荐 {recommendedHongKongClass}，当前选择为 {draft.basics?.hong_kong_device_class}。允许修改，但理由为必填项。</p>
                <textarea
                  value={draft.basics?.hong_kong_classification_override_reason || ''}
                  onChange={(event) => updateField('basics', 'hong_kong_classification_override_reason', event.target.value)}
                />
              </label>
            )}
          </div>
        </div>
      </div>
      {extraction && (
        <div className="extraction-review">
          <div className="panel-head compact">
            <div>
              <span className="eyebrow">Profile extraction</span>
              <h2>文档识别候选字段</h2>
            </div>
            <div className="button-row">
              <span className={extraction.status === 'completed' ? 'status ok' : 'status warn'}>
                {extraction.status === 'completed' ? `${extraction.candidates.length} 项候选` : '识别失败'}
              </span>
              {!!extraction.candidates?.length && <button className="secondary-btn" onClick={applyAllCandidates}>全部应用到草稿</button>}
            </div>
          </div>
          <div className="extraction-source">
            <strong>{extraction.fileName}</strong>
            <span>{extraction.error || extraction.textPreview || '暂无可读文本预览'}</span>
          </div>
          {!!extraction.candidates?.length && (
            <div className="candidate-list">
              {extraction.candidates.map((candidate) => {
                const currentValue = draft[candidate.sectionId]?.[candidate.fieldKey] || '';
                return (
                  <div className="candidate-row" key={`${candidate.sectionId}.${candidate.fieldKey}`}>
                    <div>
                      <strong>{candidate.label}</strong>
                      <span>{candidate.sectionId}.{candidate.fieldKey} · 置信度 {Math.round(candidate.confidence * 100)}%</span>
                    </div>
                    <div className="candidate-values">
                      <p><b>当前</b>{currentValue || '空'}</p>
                      <label className="candidate-edit">
                        <b>建议，可修改后应用</b>
                        <textarea value={candidateValue(candidate)} onChange={(event) => updateCandidateValue(candidate, event.target.value)} />
                      </label>
                      <small>{candidate.sourceSnippet}</small>
                    </div>
                    <button className="secondary-btn" onClick={() => applyCandidate(candidate)}>应用</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <footer className="profile-navigation-footer">
        <button className="secondary-btn" disabled={!previousStep(navigationSteps, activeSection)} onClick={goBack}>上一步</button>
        <div className="profile-footer-actions">
          <div className="profile-save-state">
            <button className="secondary-btn" onClick={saveDraft}>保存草稿</button>
            {savedAt && <span>已保存 {savedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          {finalStep
            ? <button className="primary-btn" onClick={saveProfile}><CheckCircle2 size={16} />{mode === 'create' ? '创建项目' : '保存画像'}</button>
            : <button className="primary-btn" onClick={advance}>下一步<ChevronRight size={16} /></button>}
        </div>
      </footer>
    </section>
  );
}

function StepOutput({ step, onFieldReview }) {
  const id = step[0];
  const output = step[4];
  if (output?.structuredFields?.length) {
    return (
      <div className="step-output generated-output">
        <h3>{output.title || step[1]}</h3>
        <p>{output.summary}</p>
        <div className="generated-meta">
          <Fact label="画像状态" value={output.generatedFrom?.profileStatus || '-'} />
          <Fact label="识别文件" value={output.generatedFrom?.extractionFileName || '未使用上传识别'} />
        </div>
        <div className="structured-field-list">
          {output.structuredFields.map((field) => (
            <StepFieldReview
              key={`${field.sectionId}.${field.fieldKey}`}
              field={field}
              locked={output.locked}
              onFieldReview={onFieldReview}
            />
          ))}
        </div>
        {!!output.extractionCandidates?.length && (
          <div className="source-checks">
            <h4>上传文件识别结果</h4>
            {output.extractionCandidates.slice(0, 5).map((candidate) => (
              <p key={`${candidate.sectionId}.${candidate.fieldKey}`}>{candidate.label}: {candidate.value}</p>
            ))}
          </div>
        )}
        <div className="source-checks">
          <h4>临床获益草案</h4>
          {output.clinicalBenefits?.map((item) => <p key={item}>{item}</p>)}
        </div>
        <div className="source-checks action-required">
          <h4>人工确认项</h4>
          {output.actionItems?.map((item) => <p key={item}>{item}</p>)}
        </div>
        <div className="approval-box">
          <CheckCircle2 size={18} />
          <span>{output.conclusion}</span>
        </div>
      </div>
    );
  }
  if (output?.sotaSections?.length) {
    return (
      <div className="step-output generated-output">
        <h3>{output.title || step[1]}</h3>
        <p>{output.summary}</p>
        <div className="generated-meta">
          <Fact label="Step 1 状态" value={output.generatedFrom?.step1Status || '-'} />
          <Fact label="Step 1 锁定" value={output.generatedFrom?.step1Locked ? '已锁定' : '未锁定'} />
        </div>
        <div className="source-checks">
          <h4>继承自 Step 1 的批准字段</h4>
          {output.inheritedFields?.map((field) => (
            <p key={`${field.sectionId}.${field.fieldKey}`}>{field.label}: {field.value || 'ACTION REQUIRED'}</p>
          ))}
        </div>
        <div className="sota-section-list">
          {output.sotaSections.map((section) => (
            <div className="sota-section" key={section.id}>
              <strong>{section.title}</strong>
              <span>{section.outputNeed}</span>
              {!!section.inputs?.length && (
                <ul>
                  {section.inputs.map((input) => <li key={input}>{input}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
        <div className="source-checks">
          <h4>Step 3 检索问题种子</h4>
          {output.searchQuestions?.map((item) => <p key={item}>{item}</p>)}
        </div>
        <div className="source-checks action-required">
          <h4>人工确认项</h4>
          {output.actionItems?.map((item) => <p key={item}>{item}</p>)}
        </div>
        <div className="approval-box">
          <CheckCircle2 size={18} />
          <span>{output.conclusion}</span>
        </div>
      </div>
    );
  }
  if (output) {
    return (
      <div className="step-output generated-output">
        <h3>{output.title || step[1]}</h3>
        <p>{output.summary}</p>
        <div className="source-checks action-required">
          {output.actionItems?.map((item) => <p key={item}>{item}</p>)}
        </div>
      </div>
    );
  }
  if (id === '1') {
    return (
      <div className="step-output">
        <h3>AI结构化输出</h3>
        <ul>
          <li>预期用途摘要：12周数字治疗程序，用于女性压力性、急迫性及混合性尿失禁。</li>
          <li>目标人群：成年女性，具备智能手机或平板使用能力。</li>
          <li><b>ACTION REQUIRED</b>：确认具体年龄下限、IFU中的禁忌症、警告和注意事项。</li>
          <li>初步临床获益：减少失禁发作、缓解尿急、改善生活质量、提升盆底肌功能。</li>
        </ul>
      </div>
    );
  }
  if (id === '2') {
    return (
      <div className="step-output">
        <h3>SOTA重点核对</h3>
        <ul>
          <li>疾病流行病学数据是否准确且有最新引用。</li>
          <li>当前治疗方案是否覆盖盆底肌训练、行为训练、药物/器械替代方案。</li>
          <li>替代治疗和竞品遗漏会导致Step 3检索策略出现盲区。</li>
        </ul>
      </div>
    );
  }
  if (id === '3') {
    return (
      <div className="step-output">
        <h3>检索策略</h3>
        <div className="pico-grid">
          <span>PICO</span><strong>Population / Intervention / Comparator / Outcome</strong>
          <span>SOTA</span><strong>指南、综述、流行病学、替代治疗</strong>
          <span>Similar</span><strong>同类数字疗法、PFMT app、尿失禁管理工具</strong>
          <span>DUE</span><strong>制造商、安全数据、上市后数据</strong>
        </div>
        <p>PubMed导出NBIB，Embase导出RIS；文件名建议包含数据库和类型，例如 pubmed-sota.nbib。</p>
      </div>
    );
  }
  if (id === '4') {
    return (
      <div className="step-output screening">
        <div className="screening-stats">
          <Fact label="Uploaded" value="PubMed / Embase · RIS / NBIB / TXT" />
          <Fact label="Deduplication" value="跨文件MD5去重" />
          <Fact label="Relevant" value="73" />
          <Fact label="Excluded" value="57" />
        </div>
        <h3>AI批量筛选结果</h3>
        <div className="article-table">
          {screeningArticles.map(([author, title, reason]) => (
            <div className="article-row" key={author}>
              <strong>{author}</strong>
              <span>{title}</span>
              <p>{reason}</p>
            </div>
          ))}
        </div>
        <div className="button-row">
          <button className="secondary-btn">重新筛选</button>
          <button className="secondary-btn">继续筛选</button>
          <button className="secondary-btn">跳过</button>
        </div>
      </div>
    );
  }
  return (
    <div className="step-output">
      <h3>前置依赖</h3>
      <p>需完成并批准前序步骤后解锁。系统会自动继承已批准步骤、上下文文件和文献筛选结果。</p>
    </div>
  );
}

function StepFieldReview({ field, locked, onFieldReview }) {
  const [draft, setDraft] = useState(field.value || '');

  useEffect(() => {
    setDraft(field.value || '');
  }, [field.value, field.reviewedAt]);

  const statusText = locked
    ? '已锁定'
    : field.confirmationStatus === 'confirmed'
      ? '已确认'
      : '待确认';

  return (
    <div className="structured-field reviewable-field">
      <div className="field-review-head">
        <span>{field.label}</span>
        <b className={field.confirmationStatus === 'confirmed' ? 'review-status confirmed' : 'review-status'}>{statusText}</b>
      </div>
      <textarea value={draft} disabled={locked} onChange={(event) => setDraft(event.target.value)} />
      <small>当前来源：{field.selectedSource === 'extraction' ? '上传文件识别' : field.selectedSource === 'manual' ? '人工编辑' : '设备画像'}</small>
      <small>画像值：{field.profileValue || '空'}</small>
      {field.extractedValue && <small>上传识别值：{field.extractedValue}</small>}
      {field.sourceSnippet && <small>来源片段：{field.sourceSnippet}</small>}
      {!locked && (
        <div className="field-review-actions">
          {field.extractedValue && <button className="secondary-btn" onClick={() => onFieldReview(field, { selectedSource: 'extraction' })}>接受识别值</button>}
          <button className="secondary-btn" onClick={() => onFieldReview(field, { selectedSource: 'profile' })}>保留画像值</button>
          <button className="secondary-btn" onClick={() => onFieldReview(field, { value: draft, selectedSource: 'manual' })}>保存编辑</button>
          <button className="primary-btn" onClick={() => onFieldReview(field, { value: draft, selectedSource: 'manual', confirmationStatus: 'confirmed' })}>确认字段</button>
        </div>
      )}
    </div>
  );
}

function Documents({ notify, selectedProject, detail, refreshDetail }) {
  const docRows = detail?.documents?.length
    ? detail.documents.map((doc) => [doc.name, doc.status, doc.action, 'Saved document', doc.id])
    : documents.map((doc, index) => [...doc, `seed-doc-${index}`]);

  const runDocumentAction = async (doc) => {
    const [name, , action, , id] = doc;
    try {
      if (!id.startsWith('seed-doc')) {
        await api(`/projects/${selectedProject.id}/documents/${id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
        await refreshDetail(selectedProject.id);
      }
      notify(`${name}：${action} 已记录。真实系统下一步会生成DOCX或进入审批。`);
    } catch {
      notify('文档动作失败：请确认本地 API 服务已启动。');
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Document automation</span>
          <h2>文档生成中心</h2>
        </div>
        <button className="primary-btn" onClick={() => notify('已启动文档套件模拟：CER、CEP、DCR、GSPR和风险总结会按任务结果批量生成。')}><FileCheck2 size={16} />生成套件</button>
      </div>
      <div className="doc-table">
        {docRows.map((doc) => {
          const [name, state, action, task] = doc;
          return (
          <div className="doc-row" key={name}>
            <FileSearch size={20} />
            <div>
              <strong>{name}</strong>
              <span>{task}</span>
            </div>
            <span className={`doc-state ${state.replaceAll(' ', '-')}`}>{state}</span>
            <button className="secondary-btn" onClick={() => runDocumentAction(doc)}>{action}</button>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function Knowledge() {
  return (
    <div className="knowledge-layout">
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Knowledge browser</span>
            <h2>法规知识库</h2>
          </div>
          <label className="panel-search"><Search size={15} /><input placeholder="搜索 EU MDR / NMPA / FDA / 企业模板" /></label>
        </div>
        <div className="source-grid">
          {knowledgeSources.map(([title, type, desc]) => (
            <div className="source-card" key={title}>
              <Database size={20} />
              <strong>{title}</strong>
              <span>{type}</span>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <span className="eyebrow">NMPA tools</span>
        <h2>分类与免临床评价</h2>
        <div className="tool-callout">
          <FlaskConical size={22} />
          <div>
            <strong>AI Exemption Check</strong>
            <span>根据产品信息比对《免于进行临床评价医疗器械目录（2025）》。</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Tools({ prompt, setPrompt, notify }) {
  const reply = useMemo(() => '系统会从项目设备画像、上下文文件、法规知识库和历史任务结果中检索，输出可追溯的证据缺口、文档章节或表格。', []);
  const [draft, setDraft] = useState(null);
  const [classifierResult, setClassifierResult] = useState(null);
  const [classifierForm, setClassifierForm] = useState({
    productName: '一次性使用手控腔内窥镜高频手术器械',
    intendedUse: 'Used in endoscopic surgery with a high-frequency generator for tissue cutting and coagulation.',
    isMedicalDevice: true,
    isIvd: false,
    invasiveRoute: 'surgically-invasive',
    duration: 'transient',
    isReusableSurgicalInstrument: false,
    contactsHeartCentralCirculationOrCns: false,
    isActive: true,
    activeFunction: 'therapy',
    administersEnergy: true,
    energyType: 'high-frequency electrical energy',
    hazardousEnergy: true,
    isSoftware: false,
    softwareRisk: '',
    monitorsVitalParametersImmediateDanger: false,
    administersMedicinalProductHazardously: false,
    ionizingRadiation: false,
    biologicalEffectOrAbsorbed: false,
    contactsIntactSkinOnly: false,
    specialRisks: {}
  });
  const [aiConfig, setAiConfig] = useState(null);
  const [aiForm, setAiForm] = useState({
    provider: 'deepseek',
    model: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com',
    apiKey: ''
  });

  useEffect(() => {
    api('/ai/config')
      .then((config) => {
        setAiConfig(config);
        setAiForm((current) => ({
          ...current,
          provider: config.provider || 'deepseek',
          model: config.profileExtractionModel || (config.provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-v4-flash'),
          baseUrl: config.baseUrl || (config.provider === 'openai' ? 'https://api.openai.com' : 'https://api.deepseek.com')
        }));
      })
      .catch(() => notify('AI配置读取失败：请确认本地 API 服务已启动。'));
  }, []);

  const updateAiProvider = (provider) => {
    setAiForm((current) => ({
      ...current,
      provider,
      model: provider === 'deepseek' ? 'deepseek-v4-flash' : 'gpt-4o-mini',
      baseUrl: provider === 'deepseek' ? 'https://api.deepseek.com' : 'https://api.openai.com'
    }));
  };

  const saveAiSettings = async () => {
    try {
      const saved = await api('/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiForm)
      });
      setAiConfig(saved);
      setAiForm((current) => ({ ...current, apiKey: '' }));
      notify(`${saved.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'} 已配置，后续文件识别会启用AI抽取。`);
    } catch {
      notify('AI配置保存失败：请检查API Key和本地服务。');
    }
  };

  const createDraft = async () => {
    try {
      const result = await api('/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      setDraft(result);
      notify(`AI草案已生成并写入事件流：${result.summary}`);
    } catch {
      notify('AI生成失败：请确认本地 API 服务已启动。');
    }
  };

  const updateClassifier = (key, value) => {
    setClassifierForm((current) => ({ ...current, [key]: value }));
  };

  const updateSpecialRisk = (key, value) => {
    setClassifierForm((current) => ({
      ...current,
      specialRisks: {
        ...(current.specialRisks || {}),
        [key]: value
      }
    }));
  };

  const runClassifier = async () => {
    try {
      const result = await api('/classifiers/eu-mdr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(classifierForm)
      });
      setClassifierResult(result);
      notify(`CE MDR分类完成：${result.finalClass} / ${result.controllingRule}`);
    } catch {
      notify('分类器运行失败：请确认本地 API 服务已启动。');
    }
  };
  return (
    <div className="tool-layout">
      <section className="panel">
        <span className="eyebrow">AI workspace</span>
        <h2>法规助手</h2>
        <div className="chat-box">
          <div className="message assistant"><Bot size={18} /><p>{reply}</p></div>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
          <button className="primary-btn" onClick={createDraft}><MessageSquareText size={16} />发送并生成任务</button>
          {draft && (
            <div className="draft-result">
              <strong>{draft.title}</strong>
              <p>{draft.summary}</p>
              {draft.sections.map((section) => <span key={section}>{section}</span>)}
            </div>
          )}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">AI settings</span>
            <h2>模型配置</h2>
          </div>
          <span className={aiConfig?.profileExtractionConfigured ? 'status ok' : 'status warn'}>
            {aiConfig?.profileExtractionConfigured ? '已启用' : '未配置'}
          </span>
        </div>
        <div className="ai-settings">
          <label className="profile-field">
            <span>供应商</span>
            <select value={aiForm.provider} onChange={(event) => updateAiProvider(event.target.value)}>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="profile-field">
            <span>模型</span>
            <input value={aiForm.model} onChange={(event) => setAiForm((current) => ({ ...current, model: event.target.value }))} />
          </label>
          <label className="profile-field wide">
            <span>Base URL</span>
            <input value={aiForm.baseUrl} onChange={(event) => setAiForm((current) => ({ ...current, baseUrl: event.target.value }))} />
          </label>
          <label className="profile-field wide">
            <span>API Key</span>
            <input type="password" value={aiForm.apiKey} placeholder={aiConfig?.hasApiKey ? '已保存，留空表示不更换' : '粘贴 API Key'} onChange={(event) => setAiForm((current) => ({ ...current, apiKey: event.target.value }))} />
          </label>
          <button className="primary-btn" onClick={saveAiSettings}><CheckCircle2 size={16} />保存 AI 设置</button>
          <p>保存后，上传文件识别会先跑本地规则，再调用模型抽取画像字段。</p>
        </div>
      </section>
      <section className="panel classifier-panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Medical Device Classifier</span>
            <h2>CE MDR 分类器</h2>
          </div>
          {classifierResult && <span className="status ok">{classifierResult.finalClass}</span>}
        </div>
        <div className="classifier-form">
          <h3>基础范围</h3>
          <label className="profile-field wide">
            <span>产品名称</span>
            <input value={classifierForm.productName} onChange={(event) => updateClassifier('productName', event.target.value)} />
          </label>
          <label className="profile-field wide">
            <span>预期用途 / 工作方式</span>
            <textarea value={classifierForm.intendedUse} onChange={(event) => updateClassifier('intendedUse', event.target.value)} />
          </label>
          <label className="profile-field">
            <span>是否MDR医疗器械</span>
            <select value={String(classifierForm.isMedicalDevice)} onChange={(event) => updateClassifier('isMedicalDevice', event.target.value === 'true')}>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </label>
          <label className="profile-field">
            <span>是否IVD</span>
            <select value={String(classifierForm.isIvd)} onChange={(event) => updateClassifier('isIvd', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <h3>侵入性与使用时间</h3>
          <label className="profile-field">
            <span>侵入方式</span>
            <select value={classifierForm.invasiveRoute} onChange={(event) => updateClassifier('invasiveRoute', event.target.value)}>
              <option value="none">非侵入</option>
              <option value="natural-orifice">自然腔道</option>
              <option value="surgically-invasive">外科侵入</option>
              <option value="implantable">植入/长期留置</option>
            </select>
          </label>
          <label className="profile-field">
            <span>连续使用时间</span>
            <select value={classifierForm.duration} onChange={(event) => updateClassifier('duration', event.target.value)}>
              <option value="transient">Transient &lt; 60 min</option>
              <option value="short-term">Short term 60 min-30 days</option>
              <option value="long-term">Long term &gt; 30 days</option>
            </select>
          </label>
          <label className="profile-field">
            <span>可重复使用外科器械</span>
            <select value={String(classifierForm.isReusableSurgicalInstrument)} onChange={(event) => updateClassifier('isReusableSurgicalInstrument', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>离子辐射能量</span>
            <select value={String(classifierForm.ionizingRadiation)} onChange={(event) => updateClassifier('ionizingRadiation', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>生物作用/主要吸收</span>
            <select value={String(classifierForm.biologicalEffectOrAbsorbed)} onChange={(event) => updateClassifier('biologicalEffectOrAbsorbed', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <h3>有源、软件与能量</h3>
          <label className="profile-field">
            <span>是否有源</span>
            <select value={String(classifierForm.isActive)} onChange={(event) => updateClassifier('isActive', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>有源功能</span>
            <select value={classifierForm.activeFunction} onChange={(event) => updateClassifier('activeFunction', event.target.value)}>
              <option value="">不适用</option>
              <option value="therapy">治疗 / 施加能量</option>
              <option value="diagnosis-monitoring">诊断 / 监护</option>
              <option value="administer-remove-substances">给药 / 移除物质</option>
              <option value="other">其他有源</option>
            </select>
          </label>
          <label className="profile-field">
            <span>是否独立软件</span>
            <select value={String(classifierForm.isSoftware)} onChange={(event) => updateClassifier('isSoftware', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>软件风险</span>
            <select value={classifierForm.softwareRisk} onChange={(event) => updateClassifier('softwareRisk', event.target.value)}>
              <option value="">不适用/低风险</option>
              <option value="diagnosis-treatment-decision">诊疗决策信息</option>
              <option value="physiological-monitoring">生理过程监测</option>
              <option value="serious-deterioration-or-surgery">可能导致严重恶化/手术干预</option>
              <option value="death-or-irreversible">可能导致死亡/不可逆恶化</option>
            </select>
          </label>
          <label className="profile-field">
            <span>能量类型</span>
            <input value={classifierForm.energyType} onChange={(event) => updateClassifier('energyType', event.target.value)} />
          </label>
          <label className="profile-field">
            <span>潜在危险能量</span>
            <select value={String(classifierForm.hazardousEnergy)} onChange={(event) => updateClassifier('hazardousEnergy', event.target.value === 'true')}>
              <option value="false">否/不确定</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>重要生命参数即时危险</span>
            <select value={String(classifierForm.monitorsVitalParametersImmediateDanger)} onChange={(event) => updateClassifier('monitorsVitalParametersImmediateDanger', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>危险方式给药/移除</span>
            <select value={String(classifierForm.administersMedicinalProductHazardously)} onChange={(event) => updateClassifier('administersMedicinalProductHazardously', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>接触心脏/中央循环/CNS</span>
            <select value={String(classifierForm.contactsHeartCentralCirculationOrCns)} onChange={(event) => updateClassifier('contactsHeartCentralCirculationOrCns', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <h3>特殊规则 Rule 14-22</h3>
          <label className="profile-field">
            <span>药械组合</span>
            <select value={String(classifierForm.specialRisks?.medicinalSubstance || false)} onChange={(event) => updateSpecialRisk('medicinalSubstance', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>避孕/预防性传播疾病</span>
            <select value={String(classifierForm.specialRisks?.contraceptionOrStdPrevention || false)} onChange={(event) => updateSpecialRisk('contraceptionOrStdPrevention', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>清洁/消毒/灭菌器械</span>
            <select value={String(classifierForm.specialRisks?.disinfectionSterilization || false)} onChange={(event) => updateSpecialRisk('disinfectionSterilization', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>诊断X射线图像</span>
            <select value={String(classifierForm.specialRisks?.xrayDiagnosticImage || false)} onChange={(event) => updateSpecialRisk('xrayDiagnosticImage', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>人体/动物组织衍生物</span>
            <select value={String(classifierForm.specialRisks?.animalHumanTissue || false)} onChange={(event) => updateSpecialRisk('animalHumanTissue', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>纳米材料</span>
            <select value={String(classifierForm.specialRisks?.nanomaterial || false)} onChange={(event) => updateSpecialRisk('nanomaterial', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>纳米材料内部暴露</span>
            <select value={classifierForm.specialRisks?.nanomaterialExposure || ''} onChange={(event) => updateSpecialRisk('nanomaterialExposure', event.target.value)}>
              <option value="">不适用/可忽略</option>
              <option value="low">低</option>
              <option value="high-or-medium">高或中等</option>
            </select>
          </label>
          <label className="profile-field">
            <span>吸入给药</span>
            <select value={String(classifierForm.specialRisks?.inhalationAdministration || false)} onChange={(event) => updateSpecialRisk('inhalationAdministration', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>物质型器械</span>
            <select value={String(classifierForm.specialRisks?.substanceIntroduced || false)} onChange={(event) => updateSpecialRisk('substanceIntroduced', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>系统吸收</span>
            <select value={String(classifierForm.specialRisks?.systemicallyAbsorbed || false)} onChange={(event) => updateSpecialRisk('systemicallyAbsorbed', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <label className="profile-field">
            <span>闭环/集成诊断治疗</span>
            <select value={String(classifierForm.specialRisks?.closedLoopIntegratedDiagnostic || false)} onChange={(event) => updateSpecialRisk('closedLoopIntegratedDiagnostic', event.target.value === 'true')}>
              <option value="false">否</option>
              <option value="true">是</option>
            </select>
          </label>
          <button className="primary-btn" onClick={runClassifier}><Sparkles size={16} />运行 MDR 分类</button>
        </div>
        {classifierResult && (
          <div className="classifier-result">
            <div className="facts">
              <Fact label="Final Class" value={classifierResult.finalClass} />
              <Fact label="Controlling Rule" value={classifierResult.controllingRule} />
            </div>
            <div className="source-checks">
              <h4>分类论证</h4>
              <p>{classifierResult.rationale}</p>
            </div>
            <div className="sota-section-list">
              {classifierResult.candidateRules.map((item) => (
                <div className="sota-section" key={`${item.rule}-${item.deviceClass}`}>
                  <strong>{item.rule} · {item.deviceClass}</strong>
                  <span>{item.reason}</span>
                </div>
              ))}
            </div>
            {!!classifierResult.informationGaps?.length && (
              <div className="source-checks action-required">
                <h4>信息缺口</h4>
                {classifierResult.informationGaps.map((gap) => <p key={gap}>{gap}</p>)}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Team() {
  return (
    <div className="dashboard-grid">
      <section className="panel">
        <span className="eyebrow">Enterprise controls</span>
        <h2>团队与权限</h2>
        <div className="facts">
          <Fact label="Roles" value="Admin / RA / Clinical / QA / Reviewer" />
          <Fact label="Security" value="2FA, invite, enterprise verification" />
          <Fact label="Isolation" value="Project, knowledge base, uploaded files" />
        </div>
      </section>
      <section className="panel span-2">
        <h2>成员</h2>
        {['Regulatory Lead', 'Clinical Evaluator', 'QA Reviewer', 'External Consultant'].map((role) => (
          <div className="member-row" key={role}>
            <UsersRound size={18} />
            <span>{role}</span>
            <b>active</b>
          </div>
        ))}
      </section>
    </div>
  );
}

function Architecture({ notify }) {
  return (
    <div className="architecture">
      <section className="panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Replica blueprint</span>
            <h2>可开发网页系统架构</h2>
          </div>
          <button className="secondary-btn" onClick={() => notify('导出设计模拟：可生成架构说明、API清单、数据库表和开发路线图。')}><FileDown size={16} />导出设计</button>
        </div>
        <div className="layer-map">
          <Layer title="Web Frontend" desc="React SPA：项目、任务流、文档、法规库、AI工具、团队后台" />
          <Layer title="Workflow Service" desc="任务模板、步骤状态、审批、版本、审计日志" />
          <Layer title="Document Service" desc="模板填充、章节生成、DOCX导出、证据引用、插入段落" />
          <Layer title="Knowledge + RAG" desc="法规库、企业知识库、向量检索、来源追溯" />
          <Layer title="AI Orchestration" desc="分类、GSPR、CER、NMPA、翻译、等同器械研究" />
          <Layer title="Identity + Tenant" desc="账户、组织、2FA、套餐、权限、数据隔离" />
        </div>
      </section>
      <section className="panel">
        <h2>后端 API 轮廓</h2>
        <div className="api-list">
          {apiDomains.map(([path, desc]) => (
            <div className="api-row" key={path}>
              <code>{path}</code>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TaskType({ title, desc, output, progress }) {
  return (
    <div className="task-type">
      <div>
        <strong>{title}</strong>
        <p>{desc}</p>
        <span>{output}</span>
      </div>
      <div className="progress-line"><i style={{ width: `${Math.max(progress, 4)}%` }} /></div>
    </div>
  );
}

function StepTimeline() {
  return (
    <div className="timeline">
      {clinicalSteps.map(([num, title, , status]) => (
        <div className="timeline-item" key={num}>
          <span>{num}</span>
          <strong>{title}</strong>
          <small>{status}</small>
        </div>
      ))}
    </div>
  );
}

function Layer({ title, desc }) {
  return (
    <div className="layer">
      <Layers3 size={18} />
      <strong>{title}</strong>
      <span>{desc}</span>
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function inferFileType(name) {
  const lower = name.toLowerCase();
  if (lower.includes('ifu')) return 'IFU';
  if (lower.endsWith('.ris') || lower.endsWith('.nbib') || lower.endsWith('.txt')) return 'Literature';
  if (lower.includes('risk')) return 'Risk';
  return 'Context';
}

function Notice({ message, onClose }) {
  return (
    <div className="notice">
      <BadgeCheck size={18} />
      <span>{message}</span>
      <button onClick={onClose}>关闭</button>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
