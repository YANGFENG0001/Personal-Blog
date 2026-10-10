import { useState } from 'preact/hooks';
import { api, errMsg, move, toast } from '../../lib/client';
import type { Board, Task } from '../../server/services/tasks';

interface Props {
  initial: Board[];
  compact?: boolean;
}

export default function TaskBoards({ initial, compact = false }: Props) {
  const [boards, setBoards] = useState<Board[]>(initial);
  const [newBoard, setNewBoard] = useState('');

  const patchBoard = (id: string, fn: (b: Board) => Board) => setBoards((bs) => bs.map((b) => (b.id === id ? fn(b) : b)));

  async function addBoard(e: Event) {
    e.preventDefault();
    const name = newBoard.trim();
    if (!name) return;
    try {
      const b = await api.post<Board>('/api/owner/boards', { name });
      setBoards((bs) => [...bs, b]);
      setNewBoard('');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function renameBoard(b: Board) {
    const name = prompt('任务板名称', b.name)?.trim();
    if (!name || name === b.name) return;
    try {
      await api.put(`/api/owner/boards/${b.id}`, { name, description: b.description, showOnDashboard: b.showOnDashboard });
      patchBoard(b.id, (x) => ({ ...x, name }));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function toggleDashboard(b: Board) {
    try {
      await api.put(`/api/owner/boards/${b.id}`, { name: b.name, description: b.description, showOnDashboard: !b.showOnDashboard });
      patchBoard(b.id, (x) => ({ ...x, showOnDashboard: !x.showOnDashboard }));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function deleteBoard(b: Board) {
    if (!confirm(`删除任务板「${b.name}」及其 ${b.tasks.length} 个任务？此操作不可撤销。`)) return;
    try {
      await api.del(`/api/owner/boards/${b.id}`);
      setBoards((bs) => bs.filter((x) => x.id !== b.id));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function moveBoard(i: number, dir: -1 | 1) {
    const next = move(boards, i, i + dir);
    if (next === boards) return;
    setBoards(next);
    try {
      await api.post('/api/owner/boards/reorder', { ids: next.map((b) => b.id) });
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <div class="tb">
      <div class={`tb-grid ${compact ? 'tb-compact' : ''}`}>
        {boards.map((b, i) => (
          <BoardCard
            key={b.id}
            board={b}
            compact={compact}
            onChange={(fn) => patchBoard(b.id, fn)}
            onRename={() => renameBoard(b)}
            onDelete={() => deleteBoard(b)}
            onToggleDashboard={() => toggleDashboard(b)}
            onMove={(d) => moveBoard(i, d)}
            canUp={i > 0}
            canDown={i < boards.length - 1}
          />
        ))}
        {boards.length === 0 && <p class="empty-note">还没有任务板。</p>}
      </div>
      {!compact && (
        <form class="tb-new" onSubmit={addBoard}>
          <input class="input" placeholder="新任务板名称，例如：论文精读 / 本周计划" value={newBoard} onInput={(e) => setNewBoard(e.currentTarget.value)} maxLength={60} aria-label="新任务板名称" />
          <button class="btn btn-primary" type="submit">新建任务板</button>
        </form>
      )}
    </div>
  );
}

interface CardProps {
  board: Board;
  compact: boolean;
  onChange: (fn: (b: Board) => Board) => void;
  onRename: () => void;
  onDelete: () => void;
  onToggleDashboard: () => void;
  onMove: (dir: -1 | 1) => void;
  canUp: boolean;
  canDown: boolean;
}

function BoardCard({ board, compact, onChange, onRename, onDelete, onToggleDashboard, onMove, canUp, canDown }: CardProps) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(!compact);
  const open = board.tasks.filter((t) => t.status === 'todo');
  const done = board.tasks.filter((t) => t.status === 'done');
  const today = new Date().toISOString().slice(0, 10);

  async function add(e: Event) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const t = await api.post<Task>(`/api/owner/boards/${board.id}/tasks`, { title: title.trim(), dueDate: due || null });
      onChange((b) => ({ ...b, tasks: [...b.tasks, t] }));
      setTitle('');
      setDue('');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function toggle(t: Task) {
    try {
      const u = await api.patch<Task>(`/api/owner/tasks/${t.id}`, { done: t.status !== 'done' });
      onChange((b) => ({ ...b, tasks: b.tasks.map((x) => (x.id === t.id ? u : x)) }));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function remove(t: Task) {
    if (!confirm(`删除任务「${t.title}」？`)) return;
    try {
      await api.del(`/api/owner/tasks/${t.id}`);
      onChange((b) => ({ ...b, tasks: b.tasks.filter((x) => x.id !== t.id) }));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function save(t: Task, patch: Partial<Task>) {
    const next = { ...t, ...patch };
    try {
      const u = await api.put<Task>(`/api/owner/tasks/${t.id}`, {
        title: next.title, note: next.note, priority: next.priority || null, dueDate: next.dueDate || null, postId: next.postId,
      });
      onChange((b) => ({ ...b, tasks: b.tasks.map((x) => (x.id === t.id ? u : x)) }));
      setEditing(null);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function reorderTask(t: Task, dir: -1 | 1) {
    const i = open.findIndex((x) => x.id === t.id);
    const next = move(open, i, i + dir);
    if (next === open) return;
    onChange((b) => ({ ...b, tasks: [...next, ...done] }));
    try {
      await api.post('/api/owner/tasks/reorder', { ids: next.map((x) => x.id) });
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  const renderTask = (t: Task) =>
    editing === t.id ? (
      <TaskEditor key={t.id} task={t} onSave={(p) => save(t, p)} onCancel={() => setEditing(null)} />
    ) : (
      <li key={t.id} class={`tb-task ${t.status === 'done' ? 'is-done' : ''}`}>
        <label class="tb-check">
          <input type="checkbox" checked={t.status === 'done'} onChange={() => toggle(t)} aria-label={`完成：${t.title}`} />
        </label>
        <div class="tb-body">
          <button type="button" class="tb-title" onClick={() => setEditing(t.id)} title="点击编辑">
            {t.title}
          </button>
          <div class="tb-meta">
            {t.priority && <span class="pill">{t.priority}</span>}
            {t.dueDate && <span class={`pill ${t.status === 'todo' && t.dueDate < today ? 'pill-danger' : ''}`}>截止 {t.dueDate}</span>}
            {t.postTitle && <a class="pill pill-accent" href={`/owner/editor/${t.postId}`}>↗ {t.postTitle}</a>}
            {t.note && <span class="tb-note">{t.note}</span>}
          </div>
        </div>
        {!compact && t.status === 'todo' && (
          <span class="tb-actions">
            <button type="button" class="btn btn-sm btn-ghost" onClick={() => reorderTask(t, -1)} aria-label="上移">↑</button>
            <button type="button" class="btn btn-sm btn-ghost" onClick={() => reorderTask(t, 1)} aria-label="下移">↓</button>
          </span>
        )}
        <button type="button" class="btn btn-sm btn-ghost btn-danger tb-del" onClick={() => remove(t)} aria-label={`删除：${t.title}`}>×</button>
      </li>
    );

  return (
    <section class="panel tb-board" aria-label={board.name}>
      <header class="tb-head">
        <h3>{board.name}</h3>
        <span class="faint tb-count">{open.length} 待办 · {done.length} 完成</span>
        {!compact && (
          <span class="tb-board-actions">
            <button type="button" class="btn btn-sm btn-ghost" onClick={() => onMove(-1)} disabled={!canUp} aria-label="左移任务板">←</button>
            <button type="button" class="btn btn-sm btn-ghost" onClick={() => onMove(1)} disabled={!canDown} aria-label="右移任务板">→</button>
            <button type="button" class="btn btn-sm btn-ghost" onClick={onRename}>重命名</button>
            <label class="switch" title="显示在总览">
              <input type="checkbox" checked={board.showOnDashboard} onChange={onToggleDashboard} />
              <span class="track" />
              <span>总览</span>
            </label>
            <button type="button" class="btn btn-sm btn-ghost btn-danger" onClick={onDelete}>删除</button>
          </span>
        )}
      </header>
      <ul class="tb-list" role="list">
        {open.map(renderTask)}
      </ul>
      {done.length > 0 && (
        <>
          <button type="button" class="tb-toggle-done" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            {showDone ? '隐藏' : '显示'}已完成（{done.length}）
          </button>
          {showDone && <ul class="tb-list" role="list">{done.map(renderTask)}</ul>}
        </>
      )}
      <form class="tb-add" onSubmit={add}>
        <input class="input" placeholder="添加任务…" value={title} onInput={(e) => setTitle(e.currentTarget.value)} maxLength={300} aria-label={`添加任务到 ${board.name}`} />
        {!compact && <input class="input tb-due" type="date" value={due} onInput={(e) => setDue(e.currentTarget.value)} aria-label="截止日期" />}
        <button class="btn" type="submit">添加</button>
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
      >
        <input class="input" value={t.title} onInput={(e) => setT({ ...t, title: e.currentTarget.value })} aria-label="任务内容" required />
        <div class="tb-edit-row">
          <input class="input" placeholder="标签/优先级（可选）" value={t.priority} onInput={(e) => setT({ ...t, priority: e.currentTarget.value })} aria-label="优先级" />
          <input class="input" type="date" value={t.dueDate} onInput={(e) => setT({ ...t, dueDate: e.currentTarget.value })} aria-label="截止日期" />
        </div>
        <textarea class="input" rows={2} placeholder="备注（可选）" value={t.note} onInput={(e) => setT({ ...t, note: e.currentTarget.value })} aria-label="备注" />
        <div class="row">
          <button class="btn btn-primary btn-sm" type="submit">保存</button>
          <button class="btn btn-sm" type="button" onClick={onCancel}>取消</button>
        </div>
      </form>
    </li>
  );
}
