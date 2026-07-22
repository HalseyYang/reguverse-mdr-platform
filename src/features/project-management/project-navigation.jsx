import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, Search, Trash2 } from 'lucide-react';
import './project-management.css';

export function ProjectNavGroup({ active, expanded, onToggle, onManage, onCreate }) {
  return <div className="project-nav-group">
    <button className={active.startsWith('project') || active === 'projects' ? 'nav-item active' : 'nav-item'} onClick={onToggle}>
      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}<span>项目与任务</span>
    </button>
    {expanded && <div className="project-nav-children">
      <button className={active === 'project-management' ? 'active' : ''} onClick={onManage}>项目管理</button>
      <button className={active === 'project-create' ? 'active' : ''} onClick={onCreate}>新建项目</button>
    </div>}
  </div>;
}

export function ProjectManagement({ api, projects, onEnter, onRefresh, notify }) {
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('全部市场');
  const [showDeleted, setShowDeleted] = useState(false);
  const [deleted, setDeleted] = useState([]);
  const loadDeleted = async () => {
    try { setDeleted(await api('/projects/deleted')); } catch { notify('无法加载已删除项目。'); }
  };
  useEffect(() => { if (showDeleted) loadDeleted(); }, [showDeleted]);
  const markets = useMemo(() => ['全部市场', ...new Set(projects.map((project) => project.market).filter(Boolean))], [projects]);
  const visible = projects.filter((project) => `${project.title} ${project.product} ${project.manufacturer}`.toLowerCase().includes(query.toLowerCase()) && (market === '全部市场' || project.market === market));
  const restore = async (project) => {
    await api(`/projects/${project.id}/restore`, { method: 'POST' });
    await Promise.all([loadDeleted(), onRefresh()]);
    notify(`已恢复项目：${project.title}`);
  };
  const purge = async (project) => {
    const impact = `${project.title}\n关联文件：${project.fileCount || 0} 个\n将永久删除项目、任务、步骤、文件、画像、文档及事件，且无法恢复。`;
    if (!window.confirm(`确认永久删除？\n\n${impact}`)) return;
    await api(`/projects/${project.id}/permanent`, { method: 'DELETE' });
    await loadDeleted();
    notify(`已永久删除项目：${project.title}`);
  };
  const rows = showDeleted ? deleted : visible;
  return <section className="panel project-management">
    <div className="panel-head"><div><span className="eyebrow">Project portfolio</span><h2>{showDeleted ? '已删除项目' : '项目管理'}</h2></div><button className="ghost-btn" onClick={() => setShowDeleted((value) => !value)}>{showDeleted ? '返回有效项目' : <><Trash2 size={16} />已删除项目</>}</button></div>
    {!showDeleted && <div className="project-filters"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、产品或制造商" /></label><select value={market} onChange={(event) => setMarket(event.target.value)}>{markets.map((item) => <option key={item}>{item}</option>)}</select></div>}
    <div className="management-list">{rows.map((project) => <article key={project.id}><div><strong>{project.title}</strong><span>{project.market} · {project.deviceClass} · {project.manufacturer}</span>{showDeleted && <small>关联文件 {project.fileCount || 0} 个 · 保留至 {new Date(project.purgeAt).toLocaleString()}</small>}</div><div className="button-row">{showDeleted ? <><button className="secondary-btn" onClick={() => restore(project)}><RotateCcw size={15} />恢复</button><button className="danger-btn" onClick={() => purge(project)}>永久删除</button></> : <button className="primary-btn" onClick={() => onEnter(project)}>进入项目</button>}</div></article>)}{!rows.length && <p className="empty-projects">没有符合条件的项目。</p>}</div>
  </section>;
}
