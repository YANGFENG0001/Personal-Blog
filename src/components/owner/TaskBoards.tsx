import { useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import { confirmDialog } from '../../lib/dialogs';
import { byIds, useSortable } from '../../lib/useSortable';
import type { Board, Task } from '../../server/services/tasks';
import { Icon, IconButton, InlineEdit, Menu, Ring } from './ui';
import '../../styles/tasks.css';

interface Props {
  initial: Board[];
  compact?: boolean;
}

/** Relative due-date label: "今天", "逾期 2 天", "3 天后"… */
export function dueInfo(due: string | null, done: boolean, today = new Date()): { text: string; cls: string } | null {
  if (!due) return null;
  const t0 = new Date(today);
  t0.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(`${due}T00:00:00`).getTime() - t0.getTime()) / 86_400_000);
  const short = due.slice(5).replace('-', '/');
  if (done) return { text: short, cls: '' };
  if (diff < 0) return { text: `逾期 ${-diff} 天`, cls: 'overdue' };
  if (diff === 0) return { text: '今天', cls: 'today' };
  if (diff === 1) return { text: '明天', cls: '' };
  if (diff < 7) return { text: `${diff} 天后`, cls: '' };
  return { text: short, cls: '' };
}

export default function TaskBoards({ initial, compact = false }: Props) {
  const [boards, setBoards] = useState<Board[]>(initial);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const patchBoard = (id: string, fn: (b: Board) => Board) => setBoards((bs) => bs.map((b) => (b.id === id ? fn(b) : b)));

  const sortable = useSortable(
    boards.map((b) => b.id),
    async (ids) => {
      setBoards((bs) => byIds(bs, ids));
      await api.post('/api/owner/boards/reorder', { ids }).catch((e) => toast(errMsg(e), 'error'));
    },
    { axis: 'xy' },
  );

  async function addBoard(e: Event) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const b = await api.post<Board>('/api/owner/boards', { name });
      setBoards((bs) => [...bs, b]);
      setNewName('');
      setCreating(false);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function saveBoard(b: Board, patch: Partial<Board>) {
    const next = { ...b, ...patch };
    patchBoard(b.id, () => next);
    try {
      await api.put(`/api/owner/boards/${b.id}`, { name: next.name, description: next.description, showOnDashboard: next.showOnDashboard });
    } catch (err) {
      patchBoard(b.id, () => b);
      toast(errMsg(err), 'error');
    }
  }

  async function deleteBoard(b: Board) {
    const ok = await confirmDialog(`删除任务板「${b.name}」？`, `其中的 ${b.tasks.length} 个任务也会一起删除，此操作不可撤销。`, { danger: true, okLabel: '删除' });
    if (!ok) return;
    try {
      await api.del(`/api/owner/boards/${b.id}`);
      setBoards((bs) => bs.filter((x) => x.id !== b.id));
      toast('任务板已删除');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <div class={`tb-grid ${compact ? 'tb-compact' : ''}`} ref={sortable.ref as never} onPointerDown={sortable.onPointerDown} onKeyDown={sortable.onKeyDown}>
      {boards.map((b) => (
        <BoardCard key={b.id} board={b} compact={compact} onChange={(fn) => patchBoard(b.id, fn)} onSave={(p) => saveBoard(b, p)} onDelete={() => deleteBoard(b)} />
      ))}
      {compact && boards.length === 0 && <p class="empty-note">没有设置为“显示在总览”的任务板。</p>}
      {!compact &&
        (creating ? (
          <div class="tb-new">
            <form onSubmit={addBoard}>
              <input
                class="input"
                autoFocus
                placeholder="任务板名称，如：论文精读"
                value={newName}
                onInput={(e) => setNewName(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Escape' && setCreating(false)}
                maxLength={60}
                aria-label="新任务板名称"
              />
              <div class="row">
                <button class="btn btn-primary" type="submit">新建任务板</button>
                <button class="btn btn-ghost" type="button" onClick={() => setCreating(false)}>取消</button>
              </div>
            </form>
          </div>
        ) : (
          <button type="button" class="tb-new" onClick={() => setCreating(true)}>
            <span class="tb-new-icon"><Icon name="plus" size={18} /></span>
            新建任务板
          </button>
        ))}
    </div>
  );
}

interface CardProps {
  board: Board;
  compact: boolean;
  onChange: (fn: (b: Board) => Board) => void;
  onSave: (p: Partial<Board>) => void;
  onDelete: () => void;
}

function BoardCard({ board, compact, onChange, onSave, onDelete }: CardProps) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [tag, setTag] = useState('');
  const [extra, setExtra] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const open = board.tasks.filter((t) => t.status === 'todo');
  const done = board.tasks.filter((t) => t.status === 'done');

  const sortable = useSortable(open.map((t) => t.id), async (ids) => {
    onChange((b) => ({ ...b, tasks: [...byIds(open, ids), ...done] }));
    await api.post('/api/owner/tasks/reorder', { ids }).catch((e) => toast(errMsg(e), 'error'));
  });

  const unmark = (id: string) => setLeaving((s) => { const n = new Set(s); n.delete(id); return n; });

  async function add(e: Event) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const t = await api.post<Task>(`/api/owner/boards/${board.id}/tasks`, { title: title.trim(), dueDate: due || null, priority: tag.trim() || null });
      onChange((b) => ({ ...b, tasks: [...b.tasks, t] }));
      setTitle('');
      setDue('');
      setTag('');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function toggle(t: Task) {
    const toDone = t.status !== 'done';
    // Play the strike-through in place first, then move the task to its section.
    if (toDone) setLeaving((s) => new Set(s).add(t.id));
    try {
      const u = await api.patch<Task>(`/api/owner/tasks/${t.id}`, { done: toDone });
      setTimeout(() => {
        onChange((b) => ({ ...b, tasks: b.tasks.map((x) => (x.id === t.id ? u : x)) }));
        unmark(t.id);
      }, toDone ? 420 : 0);
    } catch (err) {
      unmark(t.id);
      toast(errMsg(err), 'error');
    }
  }

  async function remove(t: Task) {
    try {
      await api.del(`/api/owner/tasks/${t.id}`);
      onChange((b) => ({ ...b, tasks: b.tasks.filter((x) => x.id !== t.id) }));
      toast('任务已删除');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function save(t: Task, patch: Partial<Task>) {
    const next = { ...t, ...patch };
    try {
      const u = await api.put<Task>(`/api/owner/tasks/${t.id}`, { title: next.title, note: next.note, priority: next.priority || null, dueDate: next.dueDate || null, postId: next.postId });
      onChange((b) => ({ ...b, tasks: b.tasks.map((x) => (x.id === t.id ? u : x)) }));
      setEditing(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  const renderTask = (t: Task, sortableRow: boolean) => {
    if (editing === t.id) return <TaskEditor key={t.id} task={t} onSave={(p) => save(t, p)} onCancel={() => setEditing(null)} />;
    const isDone = t.status === 'done' || leaving.has(t.id);
    const di = dueInfo(t.dueDate, t.status === 'done');
    return (
      <li key={t.id} data-sort-id={sortableRow ? t.id : undefined} class={`tb-task ${isDone ? 'is-done' : ''}`}>
        {sortableRow && !compact && (
          <button type="button" class="handle" data-sort-handle aria-label={`拖动排序：${t.title}（或按 Alt+方向键）`}>
            <Icon name="grip" size={14} />
          </button>
        )}
        <label class="tb-check">
          <input type="checkbox" checked={isDone} onChange={() => toggle(t)} aria-label={`完成：${t.title}`} />
        </label>
        <div class="tb-body">
          <button type="button" class="tb-title" onClick={() => setEditing(t.id)} title="点击编辑">{t.title}</button>
          <div class="tb-meta">
            {t.priority && <span class="pill">{t.priority}</span>}
            {di && <span class={`pill due-pill ${di.cls}`} title={`截止 ${t.dueDate}`}><Icon name="calendar" size={11} />{di.text}</span>}
            {t.postTitle && <a class="pill pill-accent" href={`/owner/editor/${t.postId}`}><Icon name="link" size={11} />{t.postTitle}</a>}
            {t.note && <span class="tb-note">{t.note}</span>}
          </div>
        </div>
        <IconButton icon="trash" label={`删除：${t.title}`} variant="danger" size="sm" class="tb-del" onClick={() => remove(t)} />
      </li>
    );
  };

  return (
    <section class="panel tb-board" data-sort-id={board.id} aria-label={board.name}>
      <header class="tb-head">
        {!compact && (
          <button type="button" class="handle" data-sort-handle aria-label={`拖动任务板：${board.name}（或按 Alt+方向键）`}>
            <Icon name="grip" size={15} />
          </button>
        )}
        <Ring value={done.length} total={board.tasks.length} />
        <div class="tb-title-wrap">
          <h3>
            {compact ? board.name : <InlineEdit value={board.name} label="任务板名称" editing={renaming} onDone={() => setRenaming(false)} onSave={(name) => onSave({ name })} />}
          </h3>
          <span class="tb-count">{open.length} 待办 · {done.length} 完成</span>
        </div>
        {!compact && !board.showOnDashboard && <span class="tb-flag" title="未显示在总览"><Icon name="eye-off" size={14} /></span>}
        {!compact && (
          <Menu
            label={`${board.name} 的操作`}
            items={[
              { label: '重命名', icon: 'edit', onSelect: () => setRenaming(true) },
              { label: '显示在总览', icon: 'eye', checked: board.showOnDashboard, onSelect: () => onSave({ showOnDashboard: !board.showOnDashboard }) },
              { label: '删除任务板', icon: 'trash', danger: true, onSelect: onDelete },
            ]}
          />
        )}
      </header>

      <ul class="tb-list" role="list" ref={sortable.ref as never} onPointerDown={sortable.onPointerDown} onKeyDown={sortable.onKeyDown}>
        {open.map((t) => renderTask(t, true))}
      </ul>
      {board.tasks.length === 0 && <p class="empty-note">还没有任务。</p>}
      {done.length > 0 && (
        <>
          <button type="button" class="tb-toggle-done" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            <Icon name="chevron-down" size={13} />已完成 {done.length}
          </button>
          {showDone && <ul class="tb-list" role="list">{done.map((t) => renderTask(t, false))}</ul>}
        </>
      )}
      <div class="spacer" />
      <form class="tb-add" onSubmit={add}>
        <div class="tb-add-row">
          <Icon name="plus" size={14} />
          <input class="tb-add-input" placeholder="添加任务，回车确认" value={title} onInput={(e) => setTitle(e.currentTarget.value)} maxLength={300} aria-label={`添加任务到 ${board.name}`} />
          {!compact && <IconButton icon="calendar" label="设置截止日期与标签" size="sm" active={extra} onClick={() => setExtra(!extra)} />}
          <button class="sr-only" type="submit">添加</button>
        </div>
        {extra && !compact && (
          <div class="tb-add-extra">
            <input class="input" type="date" value={due} onInput={(e) => setDue(e.currentTarget.value)} aria-label="截止日期" />
            <input class="input" placeholder="标签，如：本周" value={tag} onInput={(e) => setTag(e.currentTarget.value)} maxLength={30} aria-label="标签" />
          </div>
        )}
      </form>
    </section>
  );
}

function TaskEditor({ task, onSave, onCancel }: { task: Task; onSave: (p: Partial<Task>) => void; onCancel: () => void }) {
  const [t, setT] = useState({ title: task.title, note: task.note, priority: task.priority ?? '', dueDate: task.dueDate ?? '' });
  return (
    <li class="tb-edit">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ title: t.title, note: t.note, priority: t.priority || null, dueDate: t.dueDate || null });
        }}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <input class="input" autoFocus value={t.title} onInput={(e) => setT({ ...t, title: e.currentTarget.value })} aria-label="任务内容" required />
        <div class="tb-edit-row">
          <input class="input" placeholder="标签（可选）" value={t.priority} onInput={(e) => setT({ ...t, priority: e.currentTarget.value })} aria-label="标签" />
          <input class="input" type="date" value={t.dueDate} onInput={(e) => setT({ ...t, dueDate: e.currentTarget.value })} aria-label="截止日期" />
        </div>
        <textarea class="input" rows={2} placeholder="备注（可选）" value={t.note} onInput={(e) => setT({ ...t, note: e.currentTarget.value })} aria-label="备注" />
        <div class="row">
          <button class="btn btn-primary btn-sm" type="submit">保存</button>
          <button class="btn btn-sm btn-ghost" type="button" onClick={onCancel}>取消</button>
        </div>
      </form>
    </li>
  );
}
