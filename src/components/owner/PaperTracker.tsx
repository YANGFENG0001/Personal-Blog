import { useEffect, useRef, useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import type { Paper } from '../../server/services/knowledge';
import Modal from './Modal';
import { confirmDialog } from '../../lib/dialogs';
import { Icon, IconButton } from './ui';

type ReadStatus = Paper['readStatus'];
type Repro = Paper['reproduced'];

/** Ordered reading workflow; each status has its own hue, icon and step. */
export const READ_META: Record<ReadStatus, { label: string; icon: string; tone: string; step: number }> = {
  'to-read': { label: '待读', icon: 'bookmark', tone: 'slate', step: 0 },
  reading: { label: '阅读中', icon: 'book-open', tone: 'amber', step: 1 },
  read: { label: '已读', icon: 'check', tone: 'sky', step: 2 },
  'deep-read': { label: '已精读', icon: 'sparkle', tone: 'jade', step: 3 },
};
const REPRO_META: Record<Repro, { label: string; icon: string; tone: string }> = {
  no: { label: '未复现', icon: 'circle-dashed', tone: 'mute' },
  'in-progress': { label: '复现中', icon: 'loader', tone: 'violet' },
  done: { label: '已复现', icon: 'check-circle', tone: 'jade' },
};
const READ_ORDER = Object.keys(READ_META) as ReadStatus[];

type Form = Omit<Paper, 'id' | 'postTitle' | 'createdAt' | 'updatedAt' | 'year'> & { id?: string; year: string };
const blank: Form = {
  title: '', authors: '', year: '', venue: '', url: null, codeUrl: null, direction: '', readStatus: 'to-read', reproduced: 'no', abstract: '', postId: null,
};

/** A status pill that opens a small menu of the other states. */
function StatusPicker<K extends string>({ value, meta, onPick, label }: {
  value: K; meta: Record<K, { label: string; icon: string; tone: string }>; onPick: (v: K) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  const m = meta[value];
  return (
    <div class="sp" ref={root}>
      <button type="button" class={`st st-${m.tone}`} aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}：${m.label}（点击修改）`} onClick={() => setOpen(!open)}>
        <Icon name={m.icon} size={12} />{m.label}<Icon name="chevron-down" size={11} class="st-caret" />
      </button>
      {open && (
        <div class="sp-pop" role="listbox" aria-label={label}>
          {(Object.keys(meta) as K[]).map((k) => (
            <button type="button" role="option" aria-checked={k === value} class={`sp-opt ${k === value ? 'on' : ''}`} onClick={() => { setOpen(false); if (k !== value) onPick(k); }}>
              <span class={`st st-${meta[k].tone}`}><Icon name={meta[k].icon} size={12} />{meta[k].label}</span>
              {k === value && <Icon name="check" size={13} class="sp-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Steps({ status }: { status: ReadStatus }) {
  const step = READ_META[status].step;
  return (
    <div class={`steps tone-${READ_META[status].tone}`} role="img" aria-label={`阅读进度 ${step + 1}/4`}>
      {READ_ORDER.map((_, i) => <i class={i <= step ? 'on' : ''} />)}
    </div>
  );
}

export default function PaperTracker({ initial, posts }: { initial: Paper[]; posts: { id: string; title: string }[] }) {
  const [papers, setPapers] = useState(initial);
  const [edit, setEdit] = useState<Form | null>(null);
  const [status, setStatus] = useState<ReadStatus | ''>('');
  const [dir, setDir] = useState('');
  const [q, setQ] = useState('');
  const directions = [...new Set(papers.map((p) => p.direction).filter(Boolean))].sort();

  const shown = papers.filter(
    (p) => (!status || p.readStatus === status) && (!dir || p.direction === dir) && (!q || `${p.title} ${p.authors} ${p.venue}`.toLowerCase().includes(q.toLowerCase())),
  );
  const count = (s: ReadStatus) => papers.filter((p) => p.readStatus === s).length;
  const reproduced = papers.filter((p) => p.reproduced === 'done').length;

  async function save(e: Event) {
    e.preventDefault();
    if (!edit) return;
    const { id, ...f } = edit;
    const body = { ...f, year: f.year ? Number(f.year) : null, url: f.url || null, codeUrl: f.codeUrl || null };
    try {
      const saved = id ? await api.put<Paper>(`/api/owner/papers/${id}`, body) : await api.post<Paper>('/api/owner/papers', body);
      setPapers((xs) => (id ? xs.map((x) => (x.id === id ? saved : x)) : [saved, ...xs]));
      setEdit(null);
      toast(id ? '已保存' : '已添加论文');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function quick(p: Paper, patch: Partial<Paper>) {
    const next = { ...p, ...patch };
    setPapers((xs) => xs.map((x) => (x.id === p.id ? next : x)));
    const { id, postTitle: _t, createdAt: _c, updatedAt: _u, ...rest } = next;
    try {
      const saved = await api.put<Paper>(`/api/owner/papers/${id}`, rest);
      setPapers((xs) => xs.map((x) => (x.id === id ? saved : x)));
    } catch (err) {
      setPapers((xs) => xs.map((x) => (x.id === p.id ? p : x)));
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

  return (
    <div class="pt">
      <div class="pt-overview">
        <div class="pt-tabs" role="tablist" aria-label="按阅读状态筛选">
          <button type="button" role="tab" aria-selected={status === ''} class={`pt-tab ${status === '' ? 'on' : ''}`} onClick={() => setStatus('')}>
            <span class="pt-tab-label"><Icon name="atom" size={14} />全部</span><strong>{papers.length}</strong>
          </button>
          {READ_ORDER.map((s) => (
            <button type="button" role="tab" aria-selected={status === s} class={`pt-tab tone-${READ_META[s].tone} ${status === s ? 'on' : ''}`} onClick={() => setStatus(status === s ? '' : s)}>
              <span class="pt-tab-label"><Icon name={READ_META[s].icon} size={14} />{READ_META[s].label}</span><strong>{count(s)}</strong>
            </button>
          ))}
        </div>
        <div class="pt-flow" aria-hidden="true">
          {READ_ORDER.map((s) => (
            <span class={`tone-${READ_META[s].tone}`} style={`flex:${Math.max(count(s), 0.0001)}`} title={`${READ_META[s].label} ${count(s)}`} />
          ))}
        </div>
        <div class="pt-repro"><Icon name="check-circle" size={14} />已复现 <strong>{reproduced}</strong> / {papers.length}</div>
      </div>

      <div class="filters">
        <input class="input" type="search" placeholder="搜索标题 / 作者 / 会议" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="搜索论文" />
        <select class="select" value={dir} onChange={(e) => setDir(e.currentTarget.value)} aria-label="研究方向">
          <option value="">全部方向</option>
          {directions.map((d) => <option value={d}>{d}</option>)}
        </select>
        <button class="btn btn-primary" type="button" onClick={() => setEdit({ ...blank, readStatus: status || 'to-read' })}><Icon name="plus" size={14} />添加论文</button>
      </div>

      {shown.length === 0 ? (
        <div class="panel pt-empty">
          <Icon name="book-open" size={28} />
          <p>{papers.length ? '没有符合条件的论文。' : '论文库还是空的。把想读的论文加进来，按“待读 → 阅读中 → 已读 → 已精读”推进。'}</p>
          {!papers.length && <button class="btn btn-primary" type="button" onClick={() => setEdit({ ...blank })}><Icon name="plus" size={14} />添加第一篇</button>}
        </div>
      ) : (
        <ul class="pt-list" role="list">
          {shown.map((p) => (
            <li class={`pt-card tone-${READ_META[p.readStatus].tone}`} key={p.id}>
              <div class="pt-main">
                <div class="pt-title">
                  {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.title}<Icon name="external" size={12} class="ext" /></a> : <strong>{p.title}</strong>}
                </div>
                <div class="pt-meta">
                  {p.authors && <span>{p.authors}</span>}
                  {p.venue && <span class="pt-venue">{p.venue}{p.year ? ` ${p.year}` : ''}</span>}
                  {!p.venue && p.year && <span>{p.year}</span>}
                  {p.direction && <span class="pill">{p.direction}</span>}
                </div>
                {p.abstract && <p class="pt-abs">{p.abstract}</p>}
                <div class="pt-links">
                  {p.codeUrl && <a href={p.codeUrl} target="_blank" rel="noopener noreferrer"><Icon name="code" size={13} />代码</a>}
                  {p.postId
                    ? <a href={`/owner/editor/${p.postId}`}><Icon name="pen" size={13} />{p.postTitle}</a>
                    : <a class="pt-write" href="/owner/editor?template=paper"><Icon name="plus" size={13} />写精读笔记</a>}
                </div>
              </div>
              <div class="pt-side">
                <StatusPicker label="阅读状态" value={p.readStatus} meta={READ_META} onPick={(v) => quick(p, { readStatus: v })} />
                <Steps status={p.readStatus} />
                <StatusPicker label="复现状态" value={p.reproduced} meta={REPRO_META} onPick={(v) => quick(p, { reproduced: v })} />
                <div class="pt-actions">
                  <IconButton icon="edit" label={`编辑 ${p.title}`} size="sm" onClick={() => setEdit({ ...p, year: p.year ? String(p.year) : '' })} />
                  <IconButton icon="trash" label={`删除 ${p.title}`} size="sm" variant="danger" onClick={() => remove(p)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

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
            </div>
            <div class="field">
              <span class="label">阅读状态</span>
              <div class="pt-choose" role="radiogroup" aria-label="阅读状态">
                {READ_ORDER.map((k) => (
                  <button type="button" role="radio" aria-checked={edit.readStatus === k} class={`st st-${READ_META[k].tone} ${edit.readStatus === k ? 'is-on' : 'is-off'}`} onClick={() => setEdit({ ...edit, readStatus: k })}>
                    <Icon name={READ_META[k].icon} size={12} />{READ_META[k].label}
                  </button>
                ))}
              </div>
            </div>
            <div class="field">
              <span class="label">复现</span>
              <div class="pt-choose" role="radiogroup" aria-label="复现状态">
                {(Object.keys(REPRO_META) as Repro[]).map((k) => (
                  <button type="button" role="radio" aria-checked={edit.reproduced === k} class={`st st-${REPRO_META[k].tone} ${edit.reproduced === k ? 'is-on' : 'is-off'}`} onClick={() => setEdit({ ...edit, reproduced: k })}>
                    <Icon name={REPRO_META[k].icon} size={12} />{REPRO_META[k].label}
                  </button>
                ))}
              </div>
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
