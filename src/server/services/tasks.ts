import { getDb, newId, now } from '../db';
import { notFound } from '../errors';
import { boardInput, taskInput } from '../validation';
import { recordActivity } from './activity';
import { reorder } from './sites';

export interface Task {
  id: string;
  boardId: string;
  title: string;
  note: string;
  priority: string | null;
  dueDate: string | null;
  status: 'todo' | 'done';
  completedAt: string | null;
  postId: string | null;
  postTitle: string | null;
  sort: number;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  showOnDashboard: boolean;
  sort: number;
  tasks: Task[];
}

const TASK_COLS = `t.id, t.board_id AS boardId, t.title, t.note, t.priority, t.due_date AS dueDate, t.status,
  t.completed_at AS completedAt, t.post_id AS postId, p.title AS postTitle, t.sort`;

export function listBoards(opts: { dashboardOnly?: boolean } = {}): Board[] {
  const db = getDb();
  const where = opts.dashboardOnly ? 'WHERE show_on_dashboard = 1' : '';
  const boards = db
    .prepare(`SELECT id, name, description, show_on_dashboard AS showOnDashboard, sort FROM task_boards ${where} ORDER BY sort, created_at`)
    .all() as (Omit<Board, 'tasks' | 'showOnDashboard'> & { showOnDashboard: number })[];
  const tasks = db
    .prepare(`SELECT ${TASK_COLS} FROM tasks t LEFT JOIN posts p ON p.id = t.post_id ORDER BY t.status = 'done', t.sort, t.created_at`)
    .all() as Task[];
  return boards.map((b) => ({ ...b, showOnDashboard: !!b.showOnDashboard, tasks: tasks.filter((t) => t.boardId === b.id) }));
}

function getBoardRow(id: string) {
  return getDb().prepare('SELECT id FROM task_boards WHERE id = ?').get(id);
}

export function createBoard(raw: unknown): Board {
  const input = boardInput.parse(raw);
  const db = getDb();
  const id = newId();
  const sort = (db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM task_boards').get() as { n: number }).n;
  db.prepare('INSERT INTO task_boards (id, name, description, show_on_dashboard, sort, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, input.name, input.description, input.showOnDashboard ? 1 : 0, sort, now(),
  );
  return listBoards().find((b) => b.id === id)!;
}

export function updateBoard(id: string, raw: unknown): void {
  const input = boardInput.parse(raw);
  if (!getBoardRow(id)) throw notFound('任务板');
  getDb()
    .prepare('UPDATE task_boards SET name = ?, description = ?, show_on_dashboard = ? WHERE id = ?')
    .run(input.name, input.description, input.showOnDashboard ? 1 : 0, id);
}

export function deleteBoard(id: string): void {
  if (!getBoardRow(id)) throw notFound('任务板');
  getDb().prepare('DELETE FROM task_boards WHERE id = ?').run(id);
}

export function getTask(id: string): Task | undefined {
  return getDb().prepare(`SELECT ${TASK_COLS} FROM tasks t LEFT JOIN posts p ON p.id = t.post_id WHERE t.id = ?`).get(id) as Task | undefined;
}

export function createTask(boardId: string, raw: unknown): Task {
  const input = taskInput.parse(raw);
  const db = getDb();
  if (!getBoardRow(boardId)) throw notFound('任务板');
  const id = newId();
  const sort = (db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM tasks WHERE board_id = ?').get(boardId) as { n: number }).n;
  db.prepare(
    `INSERT INTO tasks (id, board_id, title, note, priority, due_date, post_id, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, boardId, input.title, input.note, input.priority, input.dueDate, input.postId, sort, now());
  return getTask(id)!;
}

export function updateTask(id: string, raw: unknown): Task {
  const input = taskInput.parse(raw);
  if (!getTask(id)) throw notFound('任务');
  getDb()
    .prepare('UPDATE tasks SET title = ?, note = ?, priority = ?, due_date = ?, post_id = ? WHERE id = ?')
    .run(input.title, input.note, input.priority, input.dueDate, input.postId, id);
  return getTask(id)!;
}

export function setTaskDone(id: string, done: boolean): Task {
  const t = getTask(id);
  if (!t) throw notFound('任务');
  if (done && t.status !== 'done') recordActivity('task-done');
  getDb()
    .prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
    .run(done ? 'done' : 'todo', done ? (t.completedAt ?? now()) : null, id);
  return getTask(id)!;
}

export function moveTask(id: string, boardId: string): Task {
  if (!getTask(id)) throw notFound('任务');
  if (!getBoardRow(boardId)) throw notFound('任务板');
  getDb().prepare('UPDATE tasks SET board_id = ? WHERE id = ?').run(boardId, id);
  return getTask(id)!;
}

export function deleteTask(id: string): void {
  if (!getTask(id)) throw notFound('任务');
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

export function reorderBoards(ids: string[]) {
  reorder('task_boards', ids);
}
export function reorderTasks(ids: string[]) {
  reorder('tasks', ids);
}

export function taskCounts(): { open: number; done: number; overdue: number } {
  return getDb()
    .prepare(
      `SELECT SUM(status = 'todo') AS open, SUM(status = 'done') AS done,
        SUM(status = 'todo' AND due_date IS NOT NULL AND due_date < date('now', 'localtime')) AS overdue FROM tasks`,
    )
    .get() as { open: number; done: number; overdue: number };
}
