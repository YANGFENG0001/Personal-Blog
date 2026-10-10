import { useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import type { KnowledgeNode } from '../../server/services/knowledge';
import Modal from './Modal';

interface PostOpt {
  id: string;
  title: string;
  where: string;
  hidden: string | null;
}

type Edit = { id?: string; parentId: string | null; slug: string; title: string; description: string; visibility: 'public' | 'private' };

export default function KnowledgeManager({ initial, posts }: { initial: KnowledgeNode[]; posts: PostOpt[] }) {
  const [tree, setTree] = useState(initial);
  const [selected, setSelected] = useState<string | null>(initial[0]?.id ?? null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [filter, setFilter] = useState('');

  const flat: (KnowledgeNode & { depth: number })[] = [];
  const walk = (ns: KnowledgeNode[], depth: number) => ns.forEach((n) => { flat.push({ ...n, depth }); walk(n.children, depth + 1); });
  walk(tree, 0);
  const node = flat.find((n) => n.id === selected) ?? null;
  const postById = new Map(posts.map((p) => [p.id, p]));

  async function reload() {
    setTree(await api.get<KnowledgeNode[]>('/api/owner/knowledge'));
  }

  async function save(e: Event) {
    e.preventDefault();
    if (!edit) return;
    const { id, ...body } = edit;
    try {
      if (id) await api.put(`/api/owner/knowledge/${id}`, body);
      else {
        const n = await api.post<{ id: string }>('/api/owner/knowledge', body);
        setSelected(n.id);
      }
      setEdit(null);
      await reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function remove(n: KnowledgeNode) {
    if (!confirm(`删除节点「${n.title}」及其所有子节点？（文章本身不会被删除）`)) return;
    try {
      await api.del(`/api/owner/knowledge/${n.id}`);
      setSelected(null);
      await reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function setPosts(n: KnowledgeNode, ids: string[]) {
    try {
      await api.patch(`/api/owner/knowledge/${n.id}`, { postIds: ids });
      await reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  const candidates = node
    ? posts.filter((p) => !node.postIds.includes(p.id) && (!filter || p.title.toLowerCase().includes(filter.toLowerCase()))).slice(0, 12)
    : [];

  return (
    <div class="km">
      <aside class="panel km-tree">
        <div class="panel-head">
          <h2>知识树</h2>
          <button class="btn btn-sm btn-primary" type="button" onClick={() => setEdit({ parentId: null, slug: '', title: '', description: '', visibility: 'private' })}>+ 顶层节点</button>
        </div>
        {flat.length === 0 && <p class="empty-note">从一个方向开始，例如“机器学习”“Transformer”“RAG”。</p>}
        <ul class="list-plain">
          {flat.map((n) => (
            <li style={`padding-left:${n.depth * 16}px`} class={n.id === selected ? 'sel' : ''}>
              <button type="button" class="km-node" onClick={() => setSelected(n.id)}>
                {n.title}
                <span class="faint"> {n.postIds.length}</span>
                {n.visibility === 'private' && <span class="pill">私有</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section class="panel km-detail">
        {!node ? (
          <p class="empty-note">选择左侧的节点。</p>
        ) : (
          <>
            <div class="panel-head">
              <div>
                <h2>{node.title}</h2>
                <p class="panel-sub">/knowledge/{node.slug} · {node.visibility === 'public' ? '公开（其上级节点也须公开）' : '仅自己可见'}</p>
              </div>
              <div class="row">
                {node.visibility === 'public' && <a class="btn btn-sm" href={`/knowledge/${node.slug}`} target="_blank" rel="noopener">公开页 ↗</a>}
                <button class="btn btn-sm" type="button" onClick={() => setEdit({ parentId: node.id, slug: '', title: '', description: '', visibility: node.visibility })}>+ 子节点</button>
                <button class="btn btn-sm" type="button" onClick={() => setEdit({ id: node.id, parentId: node.parentId, slug: node.slug, title: node.title, description: node.description, visibility: node.visibility })}>编辑</button>
                <button class="btn btn-sm btn-danger" type="button" onClick={() => remove(node)}>删除</button>
              </div>
            </div>
            {node.description && <p class="muted">{node.description}</p>}
            <h3 class="km-h3">关联文章</h3>
            {node.postIds.length === 0 && <p class="empty-note">还没有关联文章。</p>}
            <ol class="list-plain">
              {node.postIds.map((id, i) => {
                const p = postById.get(id);
                if (!p) return null;
                return (
                  <li class="row-between">
                    <span>
                      <a href={`/owner/editor/${p.id}`}>{p.title}</a> <span class="faint small">{p.where}</span>
                      {p.hidden && <span class="pill">{p.hidden}</span>}
                    </span>
                    <span class="row">
                      <button class="btn btn-sm btn-ghost" type="button" disabled={i === 0} onClick={() => { const ids = node.postIds.slice(); [ids[i - 1], ids[i]] = [ids[i]!, ids[i - 1]!]; void setPosts(node, ids); }} aria-label="上移">↑</button>
                      <button class="btn btn-sm btn-ghost btn-danger" type="button" onClick={() => setPosts(node, node.postIds.filter((x) => x !== id))}>移除</button>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div class="km-add">
              <input class="input" placeholder="搜索文章并添加到此节点…" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} aria-label="搜索文章" />
              <ul class="list-plain">
                {candidates.map((p) => (
                  <li class="row-between">
                    <span>{p.title} <span class="faint small">{p.where}</span></span>
                    <button class="btn btn-sm" type="button" onClick={() => setPosts(node, [...node.postIds, p.id])}>添加</button>
                  </li>
                ))}
              </ul>
              <a class="btn btn-sm" href="/owner/editor">在编辑器中新建文章</a>
            </div>
          </>
        )}
      </section>

      {edit && (
        <Modal title={edit.id ? '编辑节点' : '新建节点'} onClose={() => setEdit(null)}>
          <form onSubmit={save}>
            <div class="grid-2">
              <div class="field"><label>标题</label><input required maxLength={80} value={edit.title} onInput={(e) => setEdit({ ...edit, title: e.currentTarget.value })} /></div>
              <div class="field"><label>URL 名称</label><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={edit.slug} onInput={(e) => setEdit({ ...edit, slug: e.currentTarget.value.toLowerCase() })} placeholder="transformer" /></div>
            </div>
            <div class="field">
              <label>上级节点</label>
              <select value={edit.parentId ?? ''} onChange={(e) => setEdit({ ...edit, parentId: e.currentTarget.value || null })}>
                <option value="">（顶层）</option>
                {flat.filter((n) => n.id !== edit.id).map((n) => <option value={n.id}>{'　'.repeat(n.depth)}{n.title}</option>)}
              </select>
            </div>
            <div class="field"><label>描述</label><textarea maxLength={1000} value={edit.description} onInput={(e) => setEdit({ ...edit, description: e.currentTarget.value })} /></div>
            <label class="switch"><input type="checkbox" checked={edit.visibility === 'public'} onChange={(e) => setEdit({ ...edit, visibility: e.currentTarget.checked ? 'public' : 'private' })} /><span class="track" /><span>在公开知识库中显示</span></label>
            <p class="hint">公开节点中只会列出本身已公开的文章。</p>
            <div class="modal-actions"><button class="btn" type="button" onClick={() => setEdit(null)}>取消</button><button class="btn btn-primary" type="submit">保存</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}
