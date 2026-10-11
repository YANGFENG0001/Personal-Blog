import { useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import type { Paper } from '../../server/services/knowledge';
import Modal from './Modal';
import { confirmDialog } from '../../lib/dialogs';
import { Icon, IconButton } from './ui';

const READ: Record<Paper['readStatus'], string> = { 'to-read': '待读', reading: '阅读中', read: '已读', 'deep-read': '已精读' };
const REPRO: Record<Paper['reproduced'], string> = { no: '未复现', 'in-progress': '复现中', done: '已复现' };

type Form = Omit<Paper, 'id' | 'postTitle' | 'createdAt' | 'updatedAt' | 'year'> & { id?: string; year: string };

const blank: Form = {
  title: '', authors: '', year: '', venue: '', url: null, codeUrl: null, direction: '', readStatus: 'to-read', reproduced: 'no', abstract: '', postId: null,
};

export default function PaperTracker({ initial, posts }: { initial: Paper[]; posts: { id: string; title: string }[] }) {
  const [papers, setPapers] = useState(initial);
  const [edit, setEdit] = useState<Form | null>(null);
  const [status, setStatus] = useState('');
  const [dir, setDir] = useState('');
  const [q, setQ] = useState('');
  const directions = [...new Set(papers.map((p) => p.direction).filter(Boolean))].sort();

  const shown = papers.filter(
    (p) => (!status || p.readStatus === status) && (!dir || p.direction === dir) && (!q || `${p.title} ${p.authors} ${p.venue}`.toLowerCase().includes(q.toLowerCase())),
  );

  async function save(e: Event) {
    e.preventDefault();
    if (!edit) return;
    const { id, ...f } = edit;
    const body = { ...f, year: f.year ? Number(f.year) : null, url: f.url || null, codeUrl: f.codeUrl || null };
    try {
      const saved = id ? await api.put<Paper>(`/api/owner/papers/${id}`, body) : await api.post<Paper>('/api/owner/papers', body);
      setPapers((xs) => (id ? xs.map((x) => (x.id === id ? saved : x)) : [saved, ...xs]));
      setEdit(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function quick(p: Paper, patch: Partial<Paper>) {
    const { id, postTitle: _t, createdAt: _c, updatedAt: _u, ...rest } = { ...p, ...patch };
    try {
      const saved = await api.put<Paper>(`/api/owner/papers/${id}`, rest);
      setPapers((xs) => xs.map((x) => (x.id === id ? saved : x)));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function remove(p: Paper) {
    if (!(await confirmDialog(`删除论文记录「${p.title}」？`, '关联的笔记文章不受影响。', { danger: true, okLabel: '删除' }))) return;
    try {
      await api.del(`/api/owner/papers/${p.id}`);
      setPapers((xs) => xs.filter((x) => x.id !== p.id));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  const counts = Object.fromEntries(Object.keys(READ).map((k) => [k, papers.filter((p) => p.readStatus === k).length]));

  return (
    <div>
      <div class="kpis pt-kpis">
        {Object.entries(READ).map(([k, l]) => (
          <div class="kpi"><div class="kpi-label">{l}</div><div class="kpi-value">{counts[k]}</div></div>
        ))}
        <div class="kpi"><div class="kpi-label">已复现</div><div class="kpi-value">{papers.filter((p) => p.reproduced === 'done').length}</div></div>
      </div>
      <div class="filters">
        <input class="input" type="search" placeholder="标题 / 作者 / 会议" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="搜索论文" />
        <select class="select" value={status} onChange={(e) => setStatus(e.currentTarget.value)} aria-label="阅读状态">
          <option value="">全部状态</option>
          {Object.entries(READ).map(([k, l]) => <option value={k}>{l}</option>)}
        </select>
        <select class="select" value={dir} onChange={(e) => setDir(e.currentTarget.value)} aria-label="研究方向">
          <option value="">全部方向</option>
          {directions.map((d) => <option value={d}>{d}</option>)}
        </select>
        <button class="btn btn-primary" type="button" onClick={() => setEdit({ ...blank })}><Icon name="plus" size={14} />添加论文</button>
      </div>
      <div class="panel table-wrap">
        {shown.length === 0 ? <p class="empty-note">还没有论文记录。</p> : (
          <table class="table">
            <thead><tr><th>论文</th><th>方向</th><th>阅读</th><th>复现</th><th>笔记</th><th /></tr></thead>
            <tbody>
              {shown.map((p) => (
                <tr>
                  <td class="title-cell">
                    {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}<Icon name="external" size={12} class="ext" /></a> : <strong>{p.title}</strong>}
                    <div class="faint small">{[p.authors, p.venue, p.year].filter(Boolean).join(' · ')}</div>
                    {p.codeUrl && <a class="small" href={p.codeUrl} target="_blank" rel="noopener noreferrer">代码<Icon name="external" size={11} class="ext" /></a>}
                  </td>
                  <td class="faint">{p.direction || '—'}</td>
                  <td>
                    <select class="select pt-sel" value={p.readStatus} onChange={(e) => quick(p, { readStatus: e.currentTarget.value as Paper['readStatus'] })} aria-label="阅读状态">
                      {Object.entries(READ).map(([k, l]) => <option value={k}>{l}</option>)}
                    </select>
                  </td>
                  <td>
                    <select class="select pt-sel" value={p.reproduced} onChange={(e) => quick(p, { reproduced: e.currentTarget.value as Paper['reproduced'] })} aria-label="复现状态">
                      {Object.entries(REPRO).map(([k, l]) => <option value={k}>{l}</option>)}
                    </select>
                  </td>
                  <td>
                    {p.postId ? <a href={`/owner/editor/${p.postId}`}>{p.postTitle}</a> : (
                      <a class="btn btn-sm" href={`/owner/editor?template=paper`}>写精读</a>
                    )}
                  </td>
                  <td class="nowrap">
                    <IconButton icon="edit" label={`编辑 ${p.title}`} size="sm" onClick={() => setEdit({ ...p, year: p.year ? String(p.year) : '' })} />
                    <IconButton icon="trash" label={`删除 ${p.title}`} size="sm" variant="danger" onClick={() => remove(p)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? '编辑论文' : '添加论文'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <div class="field"><label>标题</label><input required maxLength={300} value={edit.title} onInput={(e) => setEdit({ ...edit, title: e.currentTarget.value })} /></div>
            <div class="grid-2">
              <div class="field"><label>作者</label><input maxLength={500} value={edit.authors} onInput={(e) => setEdit({ ...edit, authors: e.currentTarget.value })} /></div>
              <div class="field"><label>会议 / 期刊</label><input maxLength={120} value={edit.venue} onInput={(e) => setEdit({ ...edit, venue: e.currentTarget.value })} /></div>
              <div class="field"><label>年份</label><input type="number" min={1900} max={2100} value={edit.year} onInput={(e) => setEdit({ ...edit, year: e.currentTarget.value })} /></div>
              <div class="field"><label>研究方向</label><input list="pt-dirs" maxLength={80} value={edit.direction} onInput={(e) => setEdit({ ...edit, direction: e.currentTarget.value })} /><datalist id="pt-dirs">{directions.map((d) => <option value={d} />)}</datalist></div>
              <div class="field"><label>原文链接</label><input type="url" placeholder="https://arxiv.org/abs/…" value={edit.url ?? ''} onInput={(e) => setEdit({ ...edit, url: e.currentTarget.value || null })} /></div>
              <div class="field"><label>代码链接</label><input type="url" placeholder="https://github.com/…" value={edit.codeUrl ?? ''} onInput={(e) => setEdit({ ...edit, codeUrl: e.currentTarget.value || null })} /></div>
              <div class="field"><label>阅读状态</label><select value={edit.readStatus} onChange={(e) => setEdit({ ...edit, readStatus: e.currentTarget.value as Paper['readStatus'] })}>{Object.entries(READ).map(([k, l]) => <option value={k}>{l}</option>)}</select></div>
              <div class="field"><label>复现</label><select value={edit.reproduced} onChange={(e) => setEdit({ ...edit, reproduced: e.currentTarget.value as Paper['reproduced'] })}>{Object.entries(REPRO).map(([k, l]) => <option value={k}>{l}</option>)}</select></div>
            </div>
            <div class="field">
              <label>关联精读笔记</label>
              <select value={edit.postId ?? ''} onChange={(e) => setEdit({ ...edit, postId: e.currentTarget.value || null })}>
                <option value="">（无）</option>
                {posts.map((p) => <option value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div class="field"><label>摘要 / 备注</label><textarea maxLength={5000} value={edit.abstract} onInput={(e) => setEdit({ ...edit, abstract: e.currentTarget.value })} /></div>
            <div class="modal-actions"><button class="btn" type="button" onClick={() => setEdit(null)}>取消</button><button class="btn btn-primary" type="submit">保存</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
