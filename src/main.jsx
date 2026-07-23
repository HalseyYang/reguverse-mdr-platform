import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, BrainCircuit, CheckCircle2, Database, FileText, FolderKanban, Globe2, LayoutDashboard, LockKeyhole, Search, Settings, Sparkles, UsersRound } from 'lucide-react';
import './styles.css';

const navItems = [
  { id: 'dashboard', label: '总览', icon: LayoutDashboard },
  { id: 'projects', label: '项目与任务', icon: FolderKanban },
  { id: 'documents', label: '文档生成', icon: FileText },
  { id: 'knowledge', label: '法规知识库', icon: Database },
  { id: 'tools', label: 'AI 工具', icon: Sparkles },
  { id: 'team', label: '团队与权限', icon: UsersRound },
  { id: 'architecture', label: '系统架构', icon: Globe2 }
];

const classifierOptions = [
  { id: 'ce-mdr', title: 'CE MDR 分类', desc: '按 EU MDR Annex VIII 规则进行初筛分类。' },
  { id: 'fda', title: 'FDA 注册分类', desc: '按产品代码、监管路径和谓词器械线索进行初筛。' },
  { id: 'nmpa', title: 'NMPA 注册分类', desc: '按中国医疗器械分类目录和注册路径进行初筛。' },
  { id: 'hong-kong', title: '香港注册分类', desc: '按 MDACS 分类依据和香港注册资料要求进行初筛。' }
];

const classifierTitles = {
  'ce-mdr': 'CE MDR 分类界面',
  fda: 'FDA 注册分类界面',
  nmpa: 'NMPA 注册分类界面',
  'hong-kong': '香港注册分类界面'
};

const productFactDefaults = {
  productName: '一次性使用手控腔内窥镜高频手术器械',
  intendedUse: '用于内窥镜手术中组织抓持、分离、切割和凝血。',
  operatingPrinciple: '通过手控机械结构和高频能量输出实现组织抓持、切割和凝血。',
  invasiveRoute: 'surgically-invasive',
  duration: 'transient',
  bodyContact: '组织/体腔内',
  isActive: 'yes',
  energyOutput: 'high-frequency',
  isSterile: 'yes',
  isMeasuring: 'no',
  isImplantable: 'no',
  isSoftware: 'no',
  isIvd: 'no',
  hasReferenceApproval: 'unknown'
};

function findKnowledgeSignal(results, patterns) {
  const hit = results.find((item) => patterns.some((pattern) => pattern.test(`${item.title || ''} ${item.highlight || ''}`)));
  return hit ? { title: hit.title, source: hit.knowledgeBaseName || 'IMA 知识库' } : null;
}

function getClassification(mode, form, knowledgeResults = [], mdrResult = null) {
  if (form.userSelectedClass.trim()) {
    return {
      recommendedClass: form.userSelectedClass.trim(),
      primaryRule: '人工覆盖',
      codeOrNumber: '以用户确认记录为准',
      basis: '用户已手动修改类别，系统保留用户选择。',
      confidence: '人工确认',
      sourceHits: knowledgeResults,
      actions: ['记录人工修改理由', '后续输出报告时标记为人工确认分类']
    };
  }
  if (mode === 'ce-mdr') {
    const isActiveSurgical = form.invasiveRoute === 'surgically-invasive' && form.isActive === 'yes';
    const isReusableSurgicalLike = form.invasiveRoute === 'surgically-invasive' && form.isActive !== 'yes';
    const className = mdrResult?.finalClass || (isActiveSurgical ? 'Class IIb' : form.isSterile === 'yes' ? 'Class IIa' : 'Class I');
    const rule = mdrResult?.controllingRule || (isActiveSurgical
      ? 'Rule 9 / Rule 6 组合初筛'
      : isReusableSurgicalLike
        ? 'Rule 6 初筛'
        : form.isSterile === 'yes'
          ? 'Rule 1 + sterile up-classification'
          : 'Rule 1 初筛');
    return {
      recommendedClass: className,
      primaryRule: rule,
      codeOrNumber: 'EU MDR Annex VIII',
      basis: mdrResult?.rationale || `基于产品事实：${form.invasiveRoute}、${form.isActive === 'yes' ? '有源' : '非有源'}、${form.duration} 接触、${form.energyOutput}。若器械向人体组织传递高频/热能，需重点核对 Rule 9，同时核对外科侵入 Rule 6。`,
      confidence: knowledgeResults.length ? '已结合 IMA 检索依据' : '规则初筛，IMA 未命中或未配置',
      sourceHits: knowledgeResults,
      actions: ['确认 Rule 9 是否因高频能量输出适用', '确认 Rule 6 对外科侵入属性的影响', '补充人体接触部位、能量输出参数和使用时长', '由法规人员确认最终分类']
    };
  }
  if (mode === 'fda') {
    const codeHit = findKnowledgeSignal(knowledgeResults, [/product code/i, /产品代码/i, /\bGEI\b/i, /\bGAG\b/i]);
    const regulationHit = findKnowledgeSignal(knowledgeResults, [/21\s*CFR/i, /regulation number/i, /classification regulation/i]);
    return {
      recommendedClass: codeHit ? '候选 FDA 分类已命中' : 'FDA 分类候选待确认',
      primaryRule: codeHit ? `候选 Product Code：${codeHit.title}` : 'Product Code 由 IMA/FDA 数据库检索生成',
      codeOrNumber: regulationHit ? `Regulation Number 线索：${regulationHit.title}` : 'Regulation Number 待 IMA/FDA 命中',
      basis: 'FDA 分类不能让用户预填 Product Code/Regulation Number；应由产品名称、intended use、技术方法、target area、谓词器械线索检索 Product Classification Database 后生成候选。',
      confidence: knowledgeResults.length ? '已检索 IMA，需核对 FDA 官方数据库' : 'IMA 未返回命中，需扩大关键词检索',
      sourceHits: knowledgeResults,
      actions: ['用产品名称、技术方法和用途检索 FDA Product Classification Database', '输出候选 Product Code、Regulation Number、Device Class 和 Submission Type', '核对 510(k) predicate 或判断 De Novo/PMA 可能性']
    };
  }
  if (mode === 'nmpa') {
    const codeHit = findKnowledgeSignal(knowledgeResults, [/分类编码/i, /\d{2}-\d{2}-\d{2}/, /分类目录/i]);
    const classHit = findKnowledgeSignal(knowledgeResults, [/管理类别/i, /第二类/i, /第三类/i, /第一类/i]);
    return {
      recommendedClass: classHit ? '候选管理类别已命中' : 'NMPA 管理类别待确认',
      primaryRule: classHit ? `管理类别线索：${classHit.title}` : '管理类别由分类目录检索生成',
      codeOrNumber: codeHit ? `分类编码线索：${codeHit.title}` : '分类编码待 IMA/NMPA 目录命中',
      basis: 'NMPA 不应由用户先填管理类别/分类编码；系统应按结构组成、工作原理、预期用途和风险属性检索《医疗器械分类目录》后生成候选条目。',
      confidence: knowledgeResults.length ? '已检索 IMA，需核对 NMPA 分类目录' : 'IMA 未返回命中，需补充结构组成/工作原理',
      sourceHits: knowledgeResults,
      actions: ['检索 NMPA 医疗器械分类目录和分类界定资料', '输出候选管理类别、分类编码和目录条目', '若类别存疑，提示走分类界定流程']
    };
  }
  const hkHit = findKnowledgeSignal(knowledgeResults, [/MDACS/i, /TR-003/i, /Class [ABCD]/i, /分类/i]);
  return {
    recommendedClass: hkHit ? 'MDACS 候选类别已命中' : 'MDACS 类别待确认',
    primaryRule: hkHit ? `分类依据线索：${hkHit.title}` : 'MDACS / TR-003 分类规则检索生成',
    codeOrNumber: form.isIvd === 'yes' ? 'IVD MDACS route' : 'General Medical Device MDACS route',
    basis: '香港 MDACS 类别不应让用户预填；系统应先判断是否 GMD/IVD、侵入/有源/植入/风险属性，再检索 MDACS/TR-003/GN-02 等知识库资料生成 Class A/B/C/D 候选。',
    confidence: knowledgeResults.length ? '已检索 IMA，正式输出前需核对香港 MDD 当前文件' : 'IMA 未返回命中，需补充用途/机制',
    sourceHits: knowledgeResults,
    actions: ['核对香港 MDACS 当前表格和指引', '确认是否已有参考市场批准', '准备可编辑 DOCX 修订稿和待确认项批注']
  };
}

function App() {
  const [active, setActive] = useState('tools');
  const [notice, setNotice] = useState('AI 工具栏目已调整：法规助手已移除，模型配置已移到设置。');
  const ActiveIcon = navItems.find((item) => item.id === active)?.icon || Sparkles;

  const go = (tab, message) => {
    setActive(tab);
    if (message) setNotice(message);
  };

  return (
    <div className="web-app">
      <aside className="sidebar">
        <div className="brand"><div className="brand-logo"><Bot size={22} /></div><div><strong>Reguverse OS</strong><span>Medical device regulatory platform</span></div></div>
        <nav className="nav">
          {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? 'nav-item active' : 'nav-item'} onClick={() => go(id)}><Icon size={18} /><span>{label}</span></button>)}
        </nav>
        <div className="tenant-card"><LockKeyhole size={18} /><div><strong>Beauty Health</strong><span>Local regulatory workspace</span></div></div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="title-row"><ActiveIcon size={22} /><div><span>Regulatory workspace</span><h1>{active === 'settings' ? '设置' : navItems.find((item) => item.id === active)?.label}</h1></div></div>
          <div className="top-actions"><label className="global-search"><Search size={16} /><input placeholder="搜索项目、法规、文档、任务" /></label><button className="ghost-btn" onClick={() => go('settings', '已进入设置。')}><Settings size={17} />设置</button></div>
        </header>
        <section className="content">
          {notice && <div className="notice"><CheckCircle2 size={16} /><span>{notice}</span><button onClick={() => setNotice('')}>关闭</button></div>}
          {active === 'tools' && <Tools notify={setNotice} />}
          {active === 'settings' && <SettingsPage notify={setNotice} />}
          {active !== 'tools' && active !== 'settings' && <PlaceholderPage active={active} go={go} />}
        </section>
      </main>
    </div>
  );
}

function Tools({ notify }) {
  const [mode, setMode] = useState('ce-mdr');
  const [form, setForm] = useState({ userSelectedClass: '', ...productFactDefaults });
  const [classificationStarted, setClassificationStarted] = useState(false);
  const [classificationStatus, setClassificationStatus] = useState('idle');
  const [knowledgeResults, setKnowledgeResults] = useState([]);
  const [mdrResult, setMdrResult] = useState(null);
  const activeOption = classifierOptions.find((item) => item.id === mode);
  const result = getClassification(mode, form, knowledgeResults, mdrResult);

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setForm((current) => ({ ...current, userSelectedClass: '' }));
    setClassificationStarted(false);
    setClassificationStatus('idle');
    setKnowledgeResults([]);
    setMdrResult(null);
    notify(`已进入：${classifierOptions.find((item) => item.id === nextMode)?.title}`);
  };

  const buildKnowledgeQuery = () => [
    activeOption?.title,
    form.productName,
    form.intendedUse,
    form.operatingPrinciple,
    form.bodyContact,
    form.invasiveRoute,
    form.duration,
    form.isActive === 'yes' ? '有源 active device' : '无源 non active',
    form.energyOutput,
    mode === 'ce-mdr' ? 'MDR Annex VIII classification rule' : '',
    mode === 'fda' ? 'FDA product code regulation number device class submission type' : '',
    mode === 'nmpa' ? 'NMPA 医疗器械分类目录 管理类别 分类编码' : '',
    mode === 'hong-kong' ? 'Hong Kong MDACS TR-003 GN-02 classification Class A B C D' : ''
  ].filter(Boolean).join(' ');

  const startClassification = async () => {
    setClassificationStarted(false);
    setClassificationStatus('searching');
    setKnowledgeResults([]);
    setMdrResult(null);
    try {
      const [knowledgeResponse, mdrResponse] = await Promise.all([
        fetch('/api/knowledge/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: buildKnowledgeQuery() })
        }),
        mode === 'ce-mdr'
          ? fetch('/api/classifiers/eu-mdr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productName: form.productName,
              intendedUse: form.intendedUse,
              invasiveRoute: form.invasiveRoute,
              duration: form.duration,
              isActive: form.isActive === 'yes',
              activeFunction: form.energyOutput === 'none' ? 'other' : 'therapy',
              energyType: form.energyOutput,
              isSoftware: form.isSoftware === 'yes',
              isIvd: form.isIvd === 'yes',
              isReusableSurgicalInstrument: false,
              hazardousEnergy: ['high-frequency', 'laser', 'ultrasound', 'thermal'].includes(form.energyOutput)
            })
          })
          : Promise.resolve(null)
      ]);
      const knowledgeData = knowledgeResponse.ok ? await knowledgeResponse.json() : { results: [] };
      const nextMdr = mdrResponse?.ok ? await mdrResponse.json() : null;
      setKnowledgeResults(knowledgeData.results || []);
      setMdrResult(nextMdr);
      setClassificationStarted(true);
      setClassificationStatus('done');
      notify(`已保存产品事实，并基于 IMA 知识库完成 ${activeOption?.title} 初筛。`);
    } catch (error) {
      setClassificationStarted(true);
      setClassificationStatus('fallback');
      notify('IMA 知识库检索失败：已先生成本地规则初筛，正式结论需稍后重试知识库检索。');
    }
  };

  return (
    <div className="tool-layout single">
      <section className="panel span-3">
        <span className="eyebrow">Medical device classifier</span>
        <h2>医疗器械分类助手</h2>
        <p className="muted">请选择分类区域。每个按钮会进入对应的分类界面；分类结果可由系统自动推荐，也允许用户修改类别。</p>
        <div className="classifier-launch-grid">
          {classifierOptions.map((item) => <button key={item.id} type="button" className={mode === item.id ? 'classifier-launch active' : 'classifier-launch'} onClick={() => selectMode(item.id)}><BrainCircuit size={20} /><strong>{item.title}</strong><span>{item.desc}</span></button>)}
        </div>
      </section>
      <section className="panel span-3">
        <span className="eyebrow">Classification workspace</span>
        <h2>{classifierTitles[mode]}</h2>
        <p className="muted">当前入口：{activeOption?.title}。分类建议会先给出规则/编码定位，再给出推荐类别和待核对动作。</p>
        <div className="classifier-workbench">
          <div className="classifier-form-card">
            <div className="section-title"><strong>输入条件</strong><span>可由系统识别后自动填充，也允许人工调整。</span></div>
            <div className="form-grid two">
              <label>产品名称<input value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} /></label>
              <label>用户最终确认类别（可选）<input value={form.userSelectedClass} onChange={(event) => setForm({ ...form, userSelectedClass: event.target.value })} placeholder="仅在人工确认后填写" /></label>
              <label className="span-2">预期用途<textarea rows="4" value={form.intendedUse} onChange={(event) => setForm({ ...form, intendedUse: event.target.value })} /></label>
              <label className="span-2">工作原理 / 作用机制<textarea rows="3" value={form.operatingPrinciple} onChange={(event) => setForm({ ...form, operatingPrinciple: event.target.value })} /></label>
              <label>侵入属性<select value={form.invasiveRoute} onChange={(event) => setForm({ ...form, invasiveRoute: event.target.value })}><option value="none">非侵入</option><option value="natural-orifice">经自然腔道</option><option value="surgically-invasive">外科侵入</option><option value="implantable">植入</option></select></label>
              <label>接触时间<select value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })}><option value="transient">短暂</option><option value="short-term">短期</option><option value="long-term">长期</option></select></label>
              <label>接触部位<input value={form.bodyContact} onChange={(event) => setForm({ ...form, bodyContact: event.target.value })} /></label>
              <label>是否有源<select value={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.value })}><option value="yes">是</option><option value="no">否</option></select></label>
              <label>能量/主要功能<select value={form.energyOutput} onChange={(event) => setForm({ ...form, energyOutput: event.target.value })}><option value="high-frequency">高频能量</option><option value="thermal">热能</option><option value="laser">激光</option><option value="ultrasound">超声</option><option value="mechanical">机械功能</option><option value="none">无能量输出</option></select></label>
              <label>是否无菌<select value={form.isSterile} onChange={(event) => setForm({ ...form, isSterile: event.target.value })}><option value="yes">是</option><option value="no">否</option></select></label>
              <label>是否测量<select value={form.isMeasuring} onChange={(event) => setForm({ ...form, isMeasuring: event.target.value })}><option value="no">否</option><option value="yes">是</option></select></label>
              <label>是否软件 / AI<select value={form.isSoftware} onChange={(event) => setForm({ ...form, isSoftware: event.target.value })}><option value="no">否</option><option value="yes">是</option></select></label>
              <label>是否 IVD<select value={form.isIvd} onChange={(event) => setForm({ ...form, isIvd: event.target.value })}><option value="no">否</option><option value="yes">是</option></select></label>
              <label>是否已有参考市场批准<select value={form.hasReferenceApproval} onChange={(event) => setForm({ ...form, hasReferenceApproval: event.target.value })}><option value="unknown">待确认</option><option value="yes">是</option><option value="no">否</option></select></label>
            </div>
            <div className="classifier-action-bar">
              <button className="primary-btn" onClick={startClassification} disabled={classificationStatus === 'searching'}><Sparkles size={16} />{classificationStatus === 'searching' ? '正在检索 IMA...' : '保存并开始分类'}</button>
              <span>{classificationStarted ? '已生成本次初筛结果，可继续修改产品事实后重新分类。' : '填写产品事实后，系统会检索 IMA 知识库并生成分类建议。'}</span>
            </div>
          </div>
          {classificationStarted ? (
            <div className="classifier-result-card">
              <span className="eyebrow">推荐结论</span>
              <h3>{result.recommendedClass}</h3>
              <div className="result-metrics">
                <div><span>规则 / 路径</span><strong>{result.primaryRule}</strong></div>
                <div><span>编码 / 编号</span><strong>{result.codeOrNumber}</strong></div>
              </div>
              <p>{result.basis}</p>
              <div className="result-sources">
                <span>IMA 检索依据</span>
                {result.sourceHits?.length ? (
                  <ul>{result.sourceHits.slice(0, 4).map((item, index) => <li key={`${item.title}-${index}`}><strong>{item.title}</strong><small>{item.knowledgeBaseName || 'IMA 知识库'}</small></li>)}</ul>
                ) : (
                  <p>暂无 IMA 命中。请补充产品事实或检查法规知识库配置。</p>
                )}
              </div>
              <div className="result-actions"><span>待核对动作</span><ul>{result.actions.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>
          ) : (
            <div className="classifier-empty-card">
              <Sparkles size={28} />
              <strong>尚未开始分类</strong>
              <p>请先确认左侧输入条件，然后点击“保存并开始分类”。系统会在这里生成推荐类别、规则/路径、编码/编号和待核对动作。</p>
            </div>
          )}
        </div>
        <div className="classifier-placeholder"><Database size={18} /><p>下一步将接入法规知识库作为后备依据：自动推荐分类，但正式使用前仍由用户确认。</p></div>
      </section>
    </div>
  );
}

function SettingsPage({ notify }) {
  const [form, setForm] = useState({ provider: 'deepseek', model: 'deepseek-v4-pro', baseUrl: 'https://api.deepseek.com', apiKey: '' });
  const [status, setStatus] = useState('idle');
  useEffect(() => { fetch('/api/ai/config').then((res) => (res.ok ? res.json() : null)).then((data) => { if (data) setForm({ provider: data.provider || 'deepseek', model: data.model || 'deepseek-v4-pro', baseUrl: data.baseUrl || 'https://api.deepseek.com', apiKey: '' }); }).catch(() => {}); }, []);
  const save = async () => { setStatus('saving'); try { const res = await fetch('/api/ai/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); if (!res.ok) throw new Error('save failed'); setStatus('saved'); notify('模型配置已保存到设置。'); } catch { setStatus('error'); notify('模型配置保存失败：请检查本地 API 服务。'); } };
  return <div className="settings-layout"><section className="panel span-3"><span className="eyebrow">AI settings</span><h2>模型配置</h2><p className="muted">模型配置已从 AI 工具栏目移到设置页。API Key 不会在界面中回显。</p><div className="form-grid two"><label>供应商<select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}><option value="deepseek">DeepSeek</option><option value="openai">OpenAI</option></select></label><label>模型<input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label><label>Base URL<input value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} /></label><label>API Key<input type="password" value={form.apiKey} onChange={(event) => setForm({ ...form, apiKey: event.target.value })} placeholder="留空则不修改已保存密钥" /></label></div><button className="primary-btn" onClick={save}><Settings size={16} />{status === 'saving' ? '保存中' : '保存模型配置'}</button></section></div>;
}

function PlaceholderPage({ active, go }) {
  const label = navItems.find((item) => item.id === active)?.label || '工作区';
  return <section className="panel span-3"><span className="eyebrow">Workspace</span><h2>{label}</h2><p className="muted">该板块会继续接回原有工作流。当前优先恢复你要求的 AI 工具栏目和设置页。</p><button className="primary-btn" onClick={() => go('tools', '已回到医疗器械分类助手。')}>打开医疗器械分类助手</button></section>;
}

createRoot(document.getElementById('root')).render(<App />);
