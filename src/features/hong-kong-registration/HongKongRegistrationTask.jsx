import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download, FileCheck2, History, LoaderCircle, RefreshCw, Sparkles, Trash2, Upload
} from 'lucide-react';
import './hong-kong-registration.css';
import { buildDocumentTypeConfirmationPayload } from './confirmation-payload.js';
import {
  countOpenItems, isRevisionReady, latestRevisionFrom, revisionDownloadPath
} from './revision-ui.js';

const phases = ['上传文件', '文件识别', '文件类型与模板确认', '香港要求审查与修订', '待确认项', 'DOCX版本与下载'];
const statusLabels = {
  awaiting_upload: '等待上传',
  extracting_content: '文件识别中',
  awaiting_document_type_confirmation: '待确认类型',
  revising_sections: '可开始人工智能修订',
  awaiting_user_confirmation: '存在待确认项',
  ready_for_formal_version: '可生成正式版本',
  revision_completed: '修订稿已生成',
  completed: '已完成',
  processing_failed: '处理失败'
};
const errorMessages = {
  files_required: '请选择要上传的文件。',
  too_many_files: '一次最多上传 4 个文件。',
  file_too_large: '单个文件超过允许大小。',
  unsupported_file_type: '仅支持 DOCX、PDF、PNG、JPG 和 JPEG。',
  content_signature_mismatch: '文件内容与扩展名不一致。',
  damaged_file: '文件已损坏或无法读取。',
  encrypted_file: '文件已加密，请解密后重试。',
  project_market_not_mdacs: '当前项目不是香港 MDACS 项目。',
  new_template_requires_user_approval: '需要先批准或建立 Bioray 模板，当前不能进入正式修订。',
  invalid_template_identifier: '请选择系统登记的香港模板。',
  hong_kong_task_storage_not_found: '文件修订工作区尚未初始化。',
  revision_service_not_configured: '人工智能修订服务尚未配置，请联系管理员配置 DeepSeek。',
  revision_model_failed: '人工智能修订服务调用失败，请稍后重试。',
  revision_not_found: '尚未生成可下载的修订稿。'
};
const templateOptions = ['MDS-01', 'MDS-02', 'risk_management_report', 'clinical_evaluation_report', 'essential_principles_checklist'];
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8787/api';

async function requestJson(api, path, options) {
  try {
    return await api(path, options);
  } catch (error) {
    let code = '';
    try { code = JSON.parse(error.message)?.code || ''; } catch {}
    const friendly = new Error(errorMessages[code] || '操作失败，请稍后重试。');
    friendly.code = code;
    throw friendly;
  }
}

export function HongKongRegistrationTask({ project, api, notify }) {
  const inputRef = useRef(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [message, setMessage] = useState('');
  const [initializationRequired, setInitializationRequired] = useState(false);
  const [revisionErrors, setRevisionErrors] = useState({});
  const [historyByFile, setHistoryByFile] = useState({});
  const [historyVisible, setHistoryVisible] = useState({});
  const base = `/projects/${project.id}/hong-kong-registration`;

  const load = async () => {
    setLoading(true);
    try {
      setTask(await requestJson(api, `${base}/task`));
      setInitializationRequired(false);
    } catch (error) {
      setTask(null);
      setInitializationRequired(error.code === 'hong_kong_task_storage_not_found');
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [project.id]);

  const withBusy = async (fileId, operation) => {
    setBusyIds((current) => new Set(current).add(fileId));
    try {
      return await operation();
    } catch (error) {
      setMessage(error.message);
      notify?.(error.message);
      throw error;
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(fileId);
        return next;
      });
    }
  };

  const initializeWorkspace = async () => {
    setLoading(true);
    try {
      setTask(await requestJson(api, `${base}/task`, { method: 'POST' }));
      setInitializationRequired(false);
      setMessage('文件修订工作区已初始化。');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const editFile = (fileId, field, value) => setTask((current) => ({
    ...current,
    files: current.files.map((file) => file.fileId === fileId ? { ...file, [field]: value } : file)
  }));

  const replaceFile = (fileId, replacement) => setTask((current) => ({
    ...current,
    files: current.files.map((file) => file.fileId === fileId ? replacement : file)
  }));

  const extract = async (fileId) => withBusy(fileId, async () => {
    const result = await requestJson(api, `${base}/files/${fileId}/extract`, { method: 'POST' });
    replaceFile(fileId, result.file);
  });

  const upload = async (event) => {
    const selected = [...(event.target.files || [])];
    event.target.value = '';
    if (!selected.length) return;
    if (selected.length > 4) {
      setMessage(errorMessages.too_many_files);
      return;
    }
    const form = new FormData();
    selected.forEach((file) => form.append('files', file));
    try {
      const uploaded = await requestJson(api, `${base}/files`, { method: 'POST', body: form });
      setTask(uploaded);
      setMessage(`已上传 ${selected.length} 个文件，正在逐个识别。`);
      await Promise.allSettled(uploaded.files
        .filter((file) => file.status === 'extracting_content')
        .map((file) => extract(file.fileId)));
    } catch (error) {
      setMessage(error.message);
      notify?.(error.message);
    }
  };

  const retryExtraction = (fileId) => withBusy(fileId, async () => {
    await requestJson(api, `${base}/files/${fileId}/retry`, { method: 'POST' });
    await extract(fileId);
  }).catch(() => {});

  const confirmType = (file) => withBusy(file.fileId, async () => {
    const result = await requestJson(api, `${base}/files/${file.fileId}/confirm-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildDocumentTypeConfirmationPayload(file))
    });
    replaceFile(file.fileId, result.file);
    setMessage(`${file.originalName} 已确认，可开始人工智能修订。`);
  }).catch(() => {});

  const refreshRevisionState = async (fileId) => {
    const [latestResult, historyResult] = await Promise.all([
      requestJson(api, `${base}/files/${fileId}/revisions/latest`),
      requestJson(api, `${base}/files/${fileId}/revisions/history`)
    ]);
    setHistoryByFile((current) => ({ ...current, [fileId]: historyResult.revisions }));
    setTask((current) => ({
      ...current,
      files: current.files.map((file) => file.fileId === fileId
        ? {
            ...file,
            latestRevision: latestResult.revision,
            revisionHistory: historyResult.revisions,
            status: 'revision_completed'
          }
        : file)
    }));
  };

  const runRevision = (file, retry = false) => withBusy(file.fileId, async () => {
    setRevisionErrors((current) => ({ ...current, [file.fileId]: '' }));
    setMessage(`${file.originalName} 正在进行人工智能修订，请勿关闭页面。`);
    await requestJson(api, `${base}/files/${file.fileId}/revisions${retry ? '/retry' : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    await refreshRevisionState(file.fileId);
    setMessage(`${file.originalName} 的可编辑 DOCX 修订稿已生成。`);
  }).catch((error) => {
    setRevisionErrors((current) => ({ ...current, [file.fileId]: error.message }));
  });

  const toggleHistory = (fileId) => withBusy(fileId, async () => {
    if (!historyVisible[fileId]) {
      const result = await requestJson(api, `${base}/files/${fileId}/revisions/history`);
      setHistoryByFile((current) => ({ ...current, [fileId]: result.revisions }));
    }
    setHistoryVisible((current) => ({ ...current, [fileId]: !current[fileId] }));
  }).catch(() => {});

  const remove = (fileId) => withBusy(fileId, async () => {
    const result = await requestJson(api, `${base}/files/${fileId}`, { method: 'DELETE' });
    setTask(result.task);
    setConfirmDeleteId(null);
  }).catch(() => {});

  const files = task?.files || [];
  const completed = files.filter((file) => file.latestRevision || file.status === 'completed').length;
  const overall = files.length
    ? Math.round(files.reduce((sum, file) => sum + Number(file.extraction?.progressPercent || 0), 0) / files.length)
    : 0;
  const overallLabel = useMemo(() => `${completed}/${files.length} 个文件已生成修订稿`, [completed, files.length]);

  return <div className="hk-workspace">
    <header className="hk-hero">
      <div>
        <span className="eyebrow">MDACS document workbench</span>
        <h2>香港注册文件修订</h2>
        <p>{project.title} · 多文件独立处理，单文件失败不会阻塞其他文件。</p>
      </div>
      <div className="hk-overall">
        <strong>{overallLabel}</strong><span>{overall}% 文件识别进度</span>
        <progress max="100" value={overall} />
      </div>
    </header>

    <ol className="hk-phases">{phases.map((phase, index) => <li key={phase}><span>{index + 1}</span>{phase}</li>)}</ol>

    <section className="hk-upload">
      <input ref={inputRef} hidden type="file" multiple accept=".docx,.pdf,.png,.jpg,.jpeg" onChange={upload} />
      <button className="primary-btn" onClick={() => inputRef.current?.click()} disabled={loading}>
        <Upload size={16} />上传文件
      </button>
      <span>一次最多 4 个；支持 DOCX、PDF、PNG、JPG/JPEG。</span>
      {message && <p role="status">{message}</p>}
    </section>

    {loading
      ? <div className="hk-empty"><LoaderCircle className="spin" />正在加载香港任务……</div>
      : initializationRequired
        ? <div className="hk-empty">
            <FileCheck2 size={28} /><strong>文件修订工作区尚未初始化</strong>
            <span>业务任务已存在，可创建其独立文件存储。</span>
            <button className="primary-btn" onClick={initializeWorkspace}>初始化文件修订工作区</button>
          </div>
        : !files.length
          ? <div className="hk-empty"><FileCheck2 size={28} /><strong>工作区已就绪</strong><span>上传第一批注册资料即可开始识别。</span></div>
          : <div className="hk-file-grid">{files.map((file) => {
              const busy = busyIds.has(file.fileId);
              const needsBrowserOcr = file.extraction?.browserOcrRequired && file.extraction?.progressPercent < 100;
              const latestRevision = latestRevisionFrom(file);
              const history = historyByFile[file.fileId] || file.revisionHistory || [];
              const openItemCount = countOpenItems(latestRevision);
              const canRevise = isRevisionReady(file);
              return <article className={`hk-file-card ${file.status === 'processing_failed' ? 'failed' : ''}`} key={file.fileId}>
                <div className="hk-file-title">
                  <div><strong>{file.originalName}</strong><span>{busy && canRevise ? '人工智能正在修订……' : statusLabels[file.status] || file.status}</span></div>
                  <span className="hk-mode">{file.processingMode || 'revise'}</span>
                </div>
                <dl>
                  <div><dt>文件类型</dt><dd>{file.status === 'awaiting_document_type_confirmation'
                    ? <input value={file.confirmedDocumentType || file.recommendedDocumentType || ''} onChange={(event) => editFile(file.fileId, 'confirmedDocumentType', event.target.value)} />
                    : file.confirmedDocumentType || file.recommendedDocumentType || '识别中'}</dd></div>
                  <div><dt>GN02 项目</dt><dd>{file.status === 'awaiting_document_type_confirmation'
                    ? <input value={file.gn02ItemCode || ''} onChange={(event) => editFile(file.fileId, 'gn02ItemCode', event.target.value)} />
                    : file.gn02ItemCode || '待确认'}</dd></div>
                  <div><dt>模板</dt><dd>{file.status === 'awaiting_document_type_confirmation'
                    ? <select value={file.templateIdentifier || ''} onChange={(event) => editFile(file.fileId, 'templateIdentifier', event.target.value || null)}>
                        <option value="">无模板（仅审查文件）</option>
                        {templateOptions.map((identifier) => <option key={identifier} value={identifier}>{identifier}</option>)}
                      </select>
                    : file.templateIdentifier || '无需/待确认'}</dd></div>
                  <div><dt>待确认项</dt><dd className={openItemCount ? 'hk-pending-count' : ''}>{openItemCount}</dd></div>
                  <div><dt>最新版本</dt><dd>{latestRevision?.version ? `DRAFT ${latestRevision.version}` : '尚未生成'}</dd></div>
                  <div><dt>版本数量</dt><dd>{history.length}</dd></div>
                </dl>

                <div className="hk-progress">
                  <span>{busy && canRevise ? '人工智能修订与 DOCX 生成中' : `OCR/识别 ${file.extraction?.processedPageCount ?? 0}${file.extraction?.pageCount ? `/${file.extraction.pageCount} 页` : ''}`}</span>
                  <strong>{busy && canRevise ? '处理中' : `${file.extraction?.progressPercent || 0}%`}</strong>
                  <progress max="100" value={busy && canRevise ? undefined : file.extraction?.progressPercent || 0} />
                </div>

                {file.reasoningSummary && <p className="hk-reason">{file.reasoningSummary}</p>}
                {needsBrowserOcr && <p className="hk-ocr-note">等待浏览器文字识别；系统不会伪造识别结果。</p>}
                {file.failure && <p className="hk-error">{errorMessages[file.failure.code] || '该文件处理失败，可单独重试。'}</p>}
                {revisionErrors[file.fileId] && <p className="hk-error">人工智能修订失败：{revisionErrors[file.fileId]}</p>}

                {historyVisible[file.fileId] && <div className="hk-history">
                  <strong>DOCX 历史版本</strong>
                  {!history.length && <span>尚无历史版本</span>}
                  {[...history].reverse().map((revision) => {
                    const latest = revision.version === latestRevision?.version;
                    return <div className={latest ? 'latest' : ''} key={revision.version}>
                      <span>{latest ? '最新版 · ' : ''}DRAFT {revision.version}</span>
                      <small>{revision.createdAt ? new Date(revision.createdAt).toLocaleString('zh-CN') : ''}</small>
                      <a href={`${API_BASE}${revisionDownloadPath(base, file.fileId, revision.version)}`}><Download size={13} />下载</a>
                    </div>;
                  })}
                </div>}

                {confirmDeleteId === file.fileId && <div className="hk-delete-confirm">
                  <span>确认删除此文件及其版本？</span>
                  <button onClick={() => remove(file.fileId)}>确认删除</button>
                  <button onClick={() => setConfirmDeleteId(null)}>取消</button>
                </div>}

                <div className="hk-actions">
                  {file.status === 'awaiting_document_type_confirmation' && <button onClick={() => confirmType(file)} disabled={busy || !(file.confirmedDocumentType || file.recommendedDocumentType)}>确认类型与模板</button>}
                  {canRevise && !revisionErrors[file.fileId] && <button className="revision-btn" onClick={() => runRevision(file)} disabled={busy}><Sparkles size={14} />开始人工智能修订</button>}
                  {revisionErrors[file.fileId] && <button className="revision-btn" onClick={() => runRevision(file, true)} disabled={busy}><RefreshCw size={14} />重试人工智能修订</button>}
                  {(file.status === 'processing_failed' || needsBrowserOcr) && <button onClick={() => retryExtraction(file.fileId)} disabled={busy}><RefreshCw size={14} />重试识别</button>}
                  {(latestRevision || history.length) && <button onClick={() => toggleHistory(file.fileId)} disabled={busy}><History size={14} />{historyVisible[file.fileId] ? '收起历史' : '历史版本'}</button>}
                  <button onClick={() => setConfirmDeleteId(file.fileId)} disabled={busy}><Trash2 size={14} />删除</button>
                  {latestRevision?.version
                    ? <a className="latest-download" href={`${API_BASE}${revisionDownloadPath(base, file.fileId, latestRevision.version)}`}><Download size={14} />下载最新版 DOCX</a>
                    : <button disabled title="尚未生成可下载版本"><Download size={14} />下载最新版 DOCX</button>}
                </div>
              </article>;
            })}</div>}
  </div>;
}
