import { getDb, newId, now } from '../db';
import { conflict, notFound } from '../errors';
import { knowledgeNodeInput, paperInput } from '../validation';
import { PUBLIC_POST_SQL, POST_JOIN_SQL } from '../visibility';
import { reorder } from './sites';

/* ---------------- Knowledge tree ---------------- */

export interface KnowledgeNode {
  id: string;
  parentId: string | null;
  slug: string;
  title: string;
  description: string;
  visibility: 'public' | 'private';
  sort: number;
  children: KnowledgeNode[];
  postIds: string[];
}

interface NodeRow extends Omit<KnowledgeNode, 'children' | 'postIds'> {}

function rows(): NodeRow[] {
  return getDb()
    .prepare('SELECT id, parent_id AS parentId, slug, title, description, visibility, sort FROM knowledge_nodes ORDER BY sort, created_at')
    .all() as NodeRow[];
}

function links(): { nodeId: string; postId: string }[] {
  return getDb().prepare('SELECT node_id AS nodeId, post_id AS postId FROM knowledge_node_posts ORDER BY sort').all() as {
    nodeId: string;
    postId: string;
  }[];
}

function build(all: NodeRow[], linkRows: { nodeId: string; postId: string }[], include: (n: NodeRow) => boolean): KnowledgeNode[] {
  const byParent = new Map<string | null, NodeRow[]>();
  for (const n of all) {
    const k = n.parentId ?? null;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(n);
  }
  const walk = (parent: string | null): KnowledgeNode[] =>
    (byParent.get(parent) ?? [])
      .filter(include)
      .map((n) => ({ ...n, children: walk(n.id), postIds: linkRows.filter((l) => l.nodeId === n.id).map((l) => l.postId) }));
  return walk(null);
}

export function knowledgeTree(): KnowledgeNode[] {
  return build(rows(), links(), () => true);
}

/** Public tree: a node is visible only if it AND all its ancestors are public; posts are filtered by the post gate. */
export function publicKnowledgeTree(): KnowledgeNode[] {
  const publicIds = new Set(
    (getDb().prepare(`SELECT p.id FROM ${POST_JOIN_SQL} WHERE ${PUBLIC_POST_SQL}`).all({ now: now() }) as { id: string }[]).map((r) => r.id),
  );
  const visibleLinks = links().filter((l) => publicIds.has(l.postId));
  return build(rows(), visibleLinks, (n) => n.visibility === 'public');
}

export function findNode(tree: KnowledgeNode[], slug: string, trail: KnowledgeNode[] = []): { node: KnowledgeNode; trail: KnowledgeNode[] } | null {
  for (const n of tree) {
    if (n.slug === slug) return { node: n, trail };
    const hit = findNode(n.children, slug, [...trail, n]);
    if (hit) return hit;
  }
  return null;
}

function assertNoCycle(id: string, parentId: string | null) {
  const db = getDb();
  let cur = parentId;
  while (cur) {
    if (cur === id) throw conflict('不能把节点移动到它自己的子节点下');
    cur = (db.prepare('SELECT parent_id AS p FROM knowledge_nodes WHERE id = ?').get(cur) as { p: string | null } | undefined)?.p ?? null;
  }
}

export function createNode(raw: unknown): NodeRow {
  const input = knowledgeNodeInput.parse(raw);
  const db = getDb();
  if (input.parentId && !db.prepare('SELECT 1 FROM knowledge_nodes WHERE id = ?').get(input.parentId)) throw notFound('父节点');
  if (db.prepare('SELECT 1 FROM knowledge_nodes WHERE slug = ?').get(input.slug)) throw conflict('URL 名称已被使用');
  const id = newId();
  const ts = now();
  const sort = (db.prepare('SELECT COALESCE(MAX(sort), -1) + 1 AS n FROM knowledge_nodes WHERE parent_id IS ?').get(input.parentId) as { n: number }).n;
  db.prepare(
    `INSERT INTO knowledge_nodes (id, parent_id, slug, title, description, visibility, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.parentId, input.slug, input.title, input.description, input.visibility, sort, ts, ts);
  return rows().find((r) => r.id === id)!;
}

export function updateNode(id: string, raw: unknown): void {
  const input = knowledgeNodeInput.parse(raw);
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM knowledge_nodes WHERE id = ?').get(id)) throw notFound('知识节点');
  assertNoCycle(id, input.parentId);
  const clash = db.prepare('SELECT id FROM knowledge_nodes WHERE slug = ? AND id != ?').get(input.slug, id);
  if (clash) throw conflict('URL 名称已被使用');
  db.prepare('UPDATE knowledge_nodes SET parent_id = ?, slug = ?, title = ?, description = ?, visibility = ?, updated_at = ? WHERE id = ?').run(
    input.parentId, input.slug, input.title, input.description, input.visibility, now(), id,
  );
}

export function deleteNode(id: string): void {
  const r = getDb().prepare('DELETE FROM knowledge_nodes WHERE id = ?').run(id);
  if (r.changes === 0) throw notFound('知识节点');
}

export function setNodePosts(id: string, postIds: string[]): void {
  const db = getDb();
  if (!db.prepare('SELECT 1 FROM knowledge_nodes WHERE id = ?').get(id)) throw notFound('知识节点');
  db.transaction(() => {
    db.prepare('DELETE FROM knowledge_node_posts WHERE node_id = ?').run(id);
    const ins = db.prepare('INSERT OR IGNORE INTO knowledge_node_posts (node_id, post_id, sort) SELECT ?, id, ? FROM posts WHERE id = ?');
    [...new Set(postIds)].forEach((pid, i) => ins.run(id, i, pid));
  })();
}

export function reorderNodes(ids: string[]) {
  reorder('knowledge_nodes', ids);
}

/* ---------------- Papers ---------------- */

export interface Paper {
  id: string;
  postId: string | null;
  postTitle: string | null;
  title: string;
  authors: string;
  year: number | null;
  venue: string;
  url: string | null;
  codeUrl: string | null;
  direction: string;
  readStatus: 'to-read' | 'reading' | 'read' | 'deep-read';
  reproduced: 'no' | 'in-progress' | 'done';
  abstract: string;
  createdAt: string;
  updatedAt: string;
}

export const READ_STATUS: Record<Paper['readStatus'], string> = { 'to-read': '待读', reading: '阅读中', read: '已读', 'deep-read': '已精读' };
export const REPRO_STATUS: Record<Paper['reproduced'], string> = { no: '未复现', 'in-progress': '复现中', done: '已复现' };

const PAPER_COLS = `pa.id, pa.post_id AS postId, p.title AS postTitle, pa.title, pa.authors, pa.year, pa.venue, pa.url, pa.code_url AS codeUrl,
  pa.direction, pa.read_status AS readStatus, pa.reproduced, pa.abstract, pa.created_at AS createdAt, pa.updated_at AS updatedAt`;

export function listPapers(filter: { readStatus?: string; direction?: string; q?: string } = {}): Paper[] {
  const conds = ['1 = 1'];
  const params: Record<string, unknown> = {};
  if (filter.readStatus) {
    conds.push('pa.read_status = @rs');
    params.rs = filter.readStatus;
  }
  if (filter.direction) {
    conds.push('pa.direction = @dir');
    params.dir = filter.direction;
  }
  if (filter.q) {
    conds.push('(pa.title LIKE @q OR pa.authors LIKE @q OR pa.venue LIKE @q)');
    params.q = `%${filter.q}%`;
  }
  return getDb()
    .prepare(`SELECT ${PAPER_COLS} FROM papers pa LEFT JOIN posts p ON p.id = pa.post_id WHERE ${conds.join(' AND ')} ORDER BY pa.updated_at DESC`)
    .all(params) as Paper[];
}

export function getPaper(id: string): Paper | undefined {
  return getDb().prepare(`SELECT ${PAPER_COLS} FROM papers pa LEFT JOIN posts p ON p.id = pa.post_id WHERE pa.id = ?`).get(id) as Paper | undefined;
}

export function savePaper(id: string | null, raw: unknown): Paper {
  const i = paperInput.parse(raw);
  const db = getDb();
  if (i.postId) {
    if (!db.prepare('SELECT 1 FROM posts WHERE id = ?').get(i.postId)) throw notFound('关联文章');
    const other = db.prepare('SELECT id FROM papers WHERE post_id = ? AND id != ?').get(i.postId, id ?? '');
    if (other) throw conflict('该文章已关联另一篇论文');
  }
  const ts = now();
  if (id) {
    const r = db
      .prepare(
        `UPDATE papers SET post_id=?, title=?, authors=?, year=?, venue=?, url=?, code_url=?, direction=?, read_status=?, reproduced=?, abstract=?, updated_at=? WHERE id=?`,
      )
      .run(i.postId, i.title, i.authors, i.year, i.venue, i.url, i.codeUrl, i.direction, i.readStatus, i.reproduced, i.abstract, ts, id);
    if (r.changes === 0) throw notFound('论文');
    return getPaper(id)!;
  }
  const nid = newId();
  db.prepare(
    `INSERT INTO papers (id, post_id, title, authors, year, venue, url, code_url, direction, read_status, reproduced, abstract, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(nid, i.postId, i.title, i.authors, i.year, i.venue, i.url, i.codeUrl, i.direction, i.readStatus, i.reproduced, i.abstract, ts, ts);
  return getPaper(nid)!;
}

export function deletePaper(id: string): void {
  const r = getDb().prepare('DELETE FROM papers WHERE id = ?').run(id);
  if (r.changes === 0) throw notFound('论文');
}

export function paperDirections(): string[] {
  return (getDb().prepare(`SELECT DISTINCT direction FROM papers WHERE direction != '' ORDER BY direction`).all() as { direction: string }[]).map(
    (r) => r.direction,
  );
}
