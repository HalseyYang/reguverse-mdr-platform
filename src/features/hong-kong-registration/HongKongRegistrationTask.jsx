import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileCheck2, LoaderCircle, RefreshCw, Trash2, Upload } from 'lucide-react';
import './hong-kong-registration.css';

const phases = ['上传文件', '文件识别', '文件类型与模板确认', '香港要求审查与修订', '待确认项', 'DOCX版本与下载'];
const statusLabels = {
  awaiting_upload: '等待上传',
  extracting_content: '文件识别中',
  awaiting_document_type_confirmation: '待确认类型',
  revising_sections: '香港要求审查与修订',
  awaiting_user_confirmation: '待确认项',
  ready_for_formal_version: '可生成正式版本',
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
  project_market_not_mdacs: '当前项目不是香港 MDACS 项目。'
};

async function requestJson(api, path, options) {
  try { return await api(path, options); }
  catch (error) {
    let code = '';
    try { code = JSON.parse(error.message)?.code || ''; } catch {}
    throw new Error(errorMessages[code] || '操作失败，请稍后重试。');
  }
}

export function HongKongRegistrationTask({ project, api, notify }) {
  const inputRef = useRef(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [message, setMessage] = useState('');
  const base = `/projects/${project.id}/hong-kong-registration`;

  const load = async () => {
    setLoading(true);
    try { setTask(await requestJson(api, `${base}/task`)); }
    catch (error) { setTask({ projectId: project.id, status: 'awaiting_upload', files: [] }); setMessage(error.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [project.id]);

  const withBusy = async (fileId, operation) => {
    setBusyIds((current) => new Set(current).add(fileId));
    try { await operation(); }
    catch (error) { setMessage(error.message); notify?.(error.message); }
    finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(fileId);
        return next;
      });
    }
  };

  const extract = async (fileId) => withBusy(fileId, async () => {
    const result = await requestJson(api, `${base}/files/${fileId}/extract`, { method: 'POST' });
    setTask((current) => ({ ...current, files: current.files.map((file) => file.fileId === fileId ? result.file : file) }));
  });

  const upload = async (event) => {
    const selected = [...(event.target.files || [])];
    event.target.value = '';
    if (!selected.length) return;
    if (selected.length > 4) { setMessage(errorMessages.too_many_files); return; }
    const form = new FormData();
    selected.forEach((file) => form.append('files', file));
    try {
      const uploaded = await requestJson(api, `${base}/files`, { method: 'POST', body: form });
      setTask(uploaded);
      setMessage(`已上传 ${selected.length} 个文件，正在逐个识别。`);
      await Promise.allSettled(uploaded.files
        .filter((file) => file.status === 'extracting_content')
        .map((file) => extract(file.fileId)));
    } catch (error) { setMessage(error.message); notify?.(error.message); }
  };

  const retry = (fileId) => withBusy(fileId, async () => {
    await requestJson(api, `${base}/files/${fileId}/retry`, { method: 'POST' });
    await extract(fileId);
  });

  const confirmType = (file) => withBusy(file.fileId, async () => {
    const result = await requestJson(api, `${base}/files/${file.fileId}/confirm-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        confirmedDocumentType: file.recommendedDocumentType,
        recommendedDocumentType: file.recommendedDocumentType,
        gn02ItemCode: file.gn02ItemCode,
        templateIdentifier: file.templateIdentifier,
        reasoningSummary: file.reasoningSummary
      })
    });
    setTask((current) => ({ ...current, files: current.files.map((item) => item.fileId === file.fileId ? result.file : item) }));
  });

  const remove = (fileId) => withBusy(fileId, async () => {
    const result = await requestJson(api, `${base}/files/${fileId}`, { method: 'DELETE' });
    setTask(result.task);
    setConfirmDeleteId(null);
  });

  const files = task?.files || [];
  const completed = files.filter((file) => file.status === 'completed').length;
  const overall = files.length ? Math.round(files.reduce((sum, file) => sum + Number(file.extraction?.progressPercent || 0), 0) / files.length) : 0;
  const overallLabel = useMemo(() => `${completed}/${files.length} 个文件已完成`, [completed, files.length]);

  return <div className="hk-workspace">
    <header className="hk-hero">
      <div><span className="eyebrow">MDACS document workbench</span><h2>香港注册文件修订</h2><p>{project.title} · 多文件独立处理，单文件失败不会阻塞其他文件。</p></div>
      <div className="hk-overall"><strong>{overallLabel}</strong><span>{overall}% 识别进度</span><progress max="100" value={overall} /></div>
    </header>
    <ol className="hk-phases">{phases.map((phase, index) => <li key={phase}><span>{index + 1}</span>{phase}</li>)}</ol>
    <section className="hk-upload">
      <input ref={inputRef} hidden type="file" multiple accept=".docx,.pdf,.png,.jpg,.jpeg" onChange={upload} />
      <button className="primary-btn" onClick={() => inputRef.current?.click()} disabled={loading}><Upload size={16} />上传文件</button>
      <span>一次最多 4 个；支持 DOCX、PDF、PNG、JPG/JPEG。</span>
      {message && <p role="status">{message}</p>}
    </section>
    {loading ? <div className="hk-empty"><LoaderCircle className="spin" />正在加载香港任务…</div>
      : !files.length ? <div className="hk-empty"><FileCheck2 size={28} /><strong>工作区已就绪</strong><span>上传第一批注册资料即可开始识别。</span></div>
        : <div className="hk-file-grid">{files.map((file) => {
          const busy = busyIds.has(file.fileId);
          const needsBrowserOcr = file.extraction?.browserOcrRequired && file.extraction?.progressPercent < 100;
          const downloadUrl = file.latestVersion?.downloadUrl;
          return <article className={`hk-file-card ${file.status === 'processing_failed' ? 'failed' : ''}`} key={file.fileId}>
            <div className="hk-file-title"><div><strong>{file.originalName}</strong><span>{statusLabels[file.status] || file.status}</span></div><span className="hk-mode">{file.processingMode || 'revise'}</span></div>
            <dl>
              <div><dt>文件类型</dt><dd>{file.confirmedDocumentType || file.recommendedDocumentType || '识别中'}</dd></div>
              <div><dt>GN02 项目</dt><dd>{file.gn02ItemCode || '待确认'}</dd></div>
              <div><dt>模板</dt><dd>{file.templateIdentifier || '无需/待确认'}</dd></div>
              <div><dt>待确认数</dt><dd>{file.pendingConfirmationCount || 0}</dd></div>
              <div><dt>最新版本</dt><dd>{file.latestVersion?.label || '尚未生成'}</dd></div>
            </dl>
            <div className="hk-progress"><span>OCR/识别 {file.extraction?.processedPageCount ?? 0}{file.extraction?.pageCount ? `/${file.extraction.pageCount} 页` : ''}</span><strong>{file.extraction?.progressPercent || 0}%</strong><progress max="100" value={file.extraction?.progressPercent || 0} /></div>
            {file.reasoningSummary && <p className="hk-reason">{file.reasoningSummary}</p>}
            {needsBrowserOcr && <p className="hk-ocr-note">等待浏览器识别：当前未配置浏览器 OCR 引擎。识别页文本可通过 browser-ocr-pages 接口逐页保存，系统不会伪造识别结果。</p>}
            {file.failure && <p className="hk-error">{errorMessages[file.failure.code] || '该文件处理失败，可单独重试。'}</p>}
            {confirmDeleteId === file.fileId && <div className="hk-delete-confirm"><span>确认删除此文件及其版本？</span><button onClick={() => remove(file.fileId)}>确认删除</button><button onClick={() => setConfirmDeleteId(null)}>取消</button></div>}
            <div className="hk-actions">
              {file.status === 'awaiting_document_type_confirmation' && <button onClick={() => confirmType(file)} disabled={busy || !file.recommendedDocumentType}>确认类型与模板</button>}
              {(file.status === 'processing_failed' || needsBrowserOcr) && <button onClick={() => retry(file.fileId)} disabled={busy}><RefreshCw size={14} />重试</button>}
              <button onClick={() => setConfirmDeleteId(file.fileId)} disabled={busy}><Trash2 size={14} />删除</button>
              {downloadUrl ? <a href={downloadUrl}><Download size={14} />下载 DOCX</a> : <button disabled title="尚未生成可下载版本"><Download size={14} />下载 DOCX</button>}
            </div>
          </article>;
        })}</div>}
  </div>;
}
