import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const [selectedProjectIds, setSelectedProjectIds] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
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
  const toggleProjectSelection = (projectId) => {
    setSelectedProjectIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };
  const deleteSelectedProjects = async () => {
    const selectedProjects = projects.filter((project) => selectedProjectIds.has(project.id));
    if (!selectedProjects.length || deletingRef.current) return;
    deletingRef.current = true;
    const projectNames = selectedProjects.map((project) => `• ${project.title}`).join('\n');
    const impact = `${projectNames}\n\n共 ${selectedProjects.length} 个项目将移入“已删除项目”并保留 30 天；保留期内可以恢复。`;
    if (!window.confirm(`确认删除所选项目？\n\n${impact}`)) {
      deletingRef.current = false;
      return;
    }

    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        selectedProjects.map((project) => api(`/projects/${project.id}`, { method: 'DELETE' }))
      );
      const failedProjectIds = new Set(
        selectedProjects
          .filter((_, index) => results[index].status === 'rejected')
          .map((project) => project.id)
      );
      await onRefresh();
      setSelectedProjectIds(failedProjectIds);

      const deletedCount = selectedProjects.length - failedProjectIds.size;
      if (failedProjectIds.size) {
        notify(`已删除 ${deletedCount} 个项目，另有 ${failedProjectIds.size} 个项目删除失败，请重试。`);
        return;
      }
      notify(`已将 ${deletedCount} 个项目移入“已删除项目”。`);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };
  const toggleDeletedProjects = () => {
    setSelectedProjectIds(new Set());
    setShowDeleted((value) => !value);
  };
  const rows = showDeleted ? deleted : visible;
  return <section className="panel project-management">
    <div className="panel-head">
      <div><span className="eyebrow">Project portfolio</span><h2>{showDeleted ? '已删除项目' : '项目管理'}</h2></div>
      <div className="project-management-actions">
        {!showDeleted && <button className="danger-btn" disabled={!selectedProjectIds.size || deleting} onClick={deleteSelectedProjects}><Trash2 size={16} />{deleting ? '正在删除' : '删除项目'}</button>}
        <button className="ghost-btn" onClick={toggleDeletedProjects}>{showDeleted ? '返回有效项目' : <><Trash2 size={16} />已删除项目</>}</button>
      </div>
    </div>
    {!showDeleted && <div className="project-filters"><label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目、产品或制造商" /></label><select value={market} onChange={(event) => setMarket(event.target.value)}>{markets.map((item) => <option key={item}>{item}</option>)}</select></div>}
    <div className="management-list">{rows.map((project) => <article key={project.id} className={selectedProjectIds.has(project.id) ? 'selected' : ''}>
      {!showDeleted && <label className="project-selection"><input type="checkbox" checked={selectedProjectIds.has(project.id)} onChange={() => toggleProjectSelection(project.id)} aria-label={`选择项目：${project.title}`} /></label>}
      <div className="project-summary"><strong>{project.title}</strong><span>{project.market} · {project.deviceClass} · {project.manufacturer}</span>{showDeleted && <small>关联文件 {project.fileCount || 0} 个 · 保留至 {new Date(project.purgeAt).toLocaleString()}</small>}</div>
      <div className="button-row">{showDeleted ? <><button className="secondary-btn" onClick={() => restore(project)}><RotateCcw size={15} />恢复</button><button className="danger-btn" onClick={() => purge(project)}>永久删除</button></> : <button className="primary-btn" onClick={() => onEnter(project)}>进入项目</button>}</div>
    </article>)}{!rows.length && <p className="empty-projects">没有符合条件的项目。</p>}</div>
  </section>;
}
