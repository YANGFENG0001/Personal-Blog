import { useState } from 'preact/hooks';
import { api, errMsg, move, toast } from '../../lib/client';
import { SITE_ICONS, iconSvg } from '../../lib/icons';
import Modal from './Modal';

interface Cat {
  id: string;
  siteId: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  layout: 'list' | 'cards' | 'compact';
  postCount: number;
}
interface SiteT {
  id: string;
  slug: string;
  name: string;
  enName: string;
  description: string;
  icon: string;
  accent: string | null;
  visibility: 'public' | 'private';
  categories: Cat[];
}

const blankSite = { slug: '', name: '', enName: '', description: '', icon: 'book', accent: null, visibility: 'public' as const };
const blankCat = { slug: '', name: '', description: '', visibility: 'public' as const, layout: 'list' as const };

export default function SitesManager({ initial }: { initial: SiteT[] }) {
  const [sites, setSites] = useState<SiteT[]>(initial);
  const [editingSite, setEditingSite] = useState<(Omit<SiteT, 'id' | 'categories'> & { id?: string }) | null>(null);
  const [editingCat, setEditingCat] = useState<(Omit<Cat, 'id' | 'postCount'> & { id?: string }) | null>(null);
  const [deletingCat, setDeletingCat] = useState<{ cat: Cat; moveTo: string } | null>(null);

  async function reload() {
    const tree = await api.get<SiteT[]>('/api/owner/sites');
    setSites((prev) =>
      tree.map((s) => ({
        ...s,
        categories: s.categories.map((c) => ({ ...c, postCount: prev.flatMap((p) => p.categories).find((x) => x.id === c.id)?.postCount ?? 0 })),
      })),
    );
  }

  async function saveSite(e: Event) {
    e.preventDefault();
    if (!editingSite) return;
    const { id, ...body } = editingSite;
    try {
      if (id) await api.put(`/api/owner/sites/${id}`, body);
      else await api.post('/api/owner/sites', body);
      setEditingSite(null);
      await reload();
      toast('分站已保存');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function deleteSite(s: SiteT) {
    if (!confirm(`删除分站「${s.name}」？`)) return;
    try {
      await api.del(`/api/owner/sites/${s.id}`);
      setSites((x) => x.filter((y) => y.id !== s.id));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function toggleSite(s: SiteT) {
    const { id, categories: _c, ...rest } = s;
    try {
      await api.put(`/api/owner/sites/${id}`, { ...rest, visibility: s.visibility === 'public' ? 'private' : 'public' });
      setSites((x) => x.map((y) => (y.id === id ? { ...y, visibility: y.visibility === 'public' ? 'private' : 'public' } : y)));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function moveSite(i: number, dir: -1 | 1) {
    const next = move(sites, i, i + dir);
    if (next === sites) return;
    setSites(next);
    await api.post('/api/owner/sites/reorder', { ids: next.map((s) => s.id) }).catch((e) => toast(errMsg(e), 'error'));
  }

  async function saveCat(e: Event) {
    e.preventDefault();
    if (!editingCat) return;
    const { id, ...body } = editingCat;
    try {
      if (id) await api.put(`/api/owner/categories/${id}`, body);
      else await api.post('/api/owner/categories', body);
      setEditingCat(null);
      await reload();
      toast('栏目已保存');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function deleteCat(c: Cat) {
    if (c.postCount > 0) {
      setDeletingCat({ cat: c, moveTo: '' });
      return;
    }
    if (!confirm(`删除栏目「${c.name}」？`)) return;
    await doDeleteCat(c, '');
  }

  async function doDeleteCat(c: Cat, moveTo: string) {
    try {
      await api.del(`/api/owner/categories/${c.id}${moveTo ? `?moveTo=${encodeURIComponent(moveTo)}` : ''}`);
      setDeletingCat(null);
      if (moveTo) location.reload();
      else await reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function toggleCat(c: Cat) {
    const { id, postCount: _p, ...rest } = c;
    try {
      await api.put(`/api/owner/categories/${id}`, { ...rest, visibility: c.visibility === 'public' ? 'private' : 'public' });
      await reload();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function moveCat(s: SiteT, i: number, dir: -1 | 1) {
    const next = move(s.categories, i, i + dir);
    if (next === s.categories) return;
    setSites((x) => x.map((y) => (y.id === s.id ? { ...y, categories: next } : y)));
    await api.post('/api/owner/categories/reorder', { ids: next.map((c) => c.id) }).catch((e) => toast(errMsg(e), 'error'));
  }

  return (
    <div class="sm">
      <div class="row-between sm-top">
        <p class="hint">分站与栏目的“公开”开关会立即影响游客导航、列表、文章直链、搜索、RSS 和站点地图。</p>
        <button class="btn btn-primary" type="button" onClick={() => setEditingSite({ ...blankSite })}>新建分站</button>
      </div>

      {sites.map((s, i) => (
        <section class="panel sm-site" key={s.id}>
          <div class="sm-site-head">
            <span class="sm-icon" dangerouslySetInnerHTML={{ __html: iconSvg(s.icon) }} />
            <div class="sm-site-title">
              <h2>
                {s.name} <small class="faint">{s.enName}</small>
              </h2>
              <div class="faint small">/{s.slug} · {s.description || '（无简介）'}</div>
            </div>
            <div class="row">
              <label class="switch">
                <input type="checkbox" checked={s.visibility === 'public'} onChange={() => toggleSite(s)} />
                <span class="track" />
                <span>{s.visibility === 'public' ? '公开' : '隐藏'}</span>
              </label>
              <button class="btn btn-sm btn-ghost" type="button" disabled={i === 0} onClick={() => moveSite(i, -1)} aria-label="上移">↑</button>
              <button class="btn btn-sm btn-ghost" type="button" disabled={i === sites.length - 1} onClick={() => moveSite(i, 1)} aria-label="下移">↓</button>
              <button class="btn btn-sm" type="button" onClick={() => setEditingSite({ ...s })}>编辑</button>
              <button class="btn btn-sm btn-danger" type="button" onClick={() => deleteSite(s)}>删除</button>
            </div>
          </div>
          <table class="table sm-cats">
            <tbody>
              {s.categories.map((c, j) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong> <span class="faint small">/{s.slug}/{c.slug}</span>
                    {c.description && <div class="faint small">{c.description}</div>}
                  </td>
                  <td class="faint small nowrap">{c.postCount} 篇 · {{ list: '列表', cards: '卡片', compact: '紧凑' }[c.layout]}</td>
                  <td class="nowrap">
                    <label class="switch">
                      <input type="checkbox" checked={c.visibility === 'public'} onChange={() => toggleCat(c)} />
                      <span class="track" />
                      <span>{c.visibility === 'public' ? '公开' : '隐藏'}</span>
                    </label>
                  </td>
                  <td class="nowrap right">
                    <button class="btn btn-sm btn-ghost" type="button" disabled={j === 0} onClick={() => moveCat(s, j, -1)} aria-label="上移">↑</button>
                    <button class="btn btn-sm btn-ghost" type="button" disabled={j === s.categories.length - 1} onClick={() => moveCat(s, j, 1)} aria-label="下移">↓</button>
                    <a class="btn btn-sm btn-ghost" href={`/owner/posts?category=${c.id}`}>文章</a>
                    <button class="btn btn-sm btn-ghost" type="button" onClick={() => setEditingCat({ ...c })}>编辑</button>
                    <button class="btn btn-sm btn-ghost btn-danger" type="button" onClick={() => deleteCat(c)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button class="btn btn-sm sm-addcat" type="button" onClick={() => setEditingCat({ ...blankCat, siteId: s.id })}>+ 新建栏目</button>
        </section>
      ))}

      {editingSite && (
        <Modal title={editingSite.id ? '编辑分站' : '新建分站'} onClose={() => setEditingSite(null)}>
          <form onSubmit={saveSite}>
            <div class="grid-2">
              <div class="field"><label>名称</label><input required maxLength={40} value={editingSite.name} onInput={(e) => setEditingSite({ ...editingSite, name: e.currentTarget.value })} /></div>
              <div class="field"><label>英文副名</label><input maxLength={40} value={editingSite.enName} onInput={(e) => setEditingSite({ ...editingSite, enName: e.currentTarget.value })} /></div>
            </div>
            <div class="field"><label>URL 名称</label><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={editingSite.slug} onInput={(e) => setEditingSite({ ...editingSite, slug: e.currentTarget.value.toLowerCase() })} /><p class="hint">小写字母、数字和连字符，例如 research。</p></div>
            <div class="field"><label>简介</label><textarea maxLength={400} value={editingSite.description} onInput={(e) => setEditingSite({ ...editingSite, description: e.currentTarget.value })} /></div>
            <div class="field">
              <span class="label">图标</span>
              <div class="row sm-icons">
                {SITE_ICONS.map((ic) => (
                  <button type="button" class={`icon-btn ${editingSite.icon === ic ? 'sel' : ''}`} aria-pressed={editingSite.icon === ic} aria-label={ic} onClick={() => setEditingSite({ ...editingSite, icon: ic })} dangerouslySetInnerHTML={{ __html: iconSvg(ic) }} />
                ))}
              </div>
            </div>
            <label class="switch"><input type="checkbox" checked={editingSite.visibility === 'public'} onChange={(e) => setEditingSite({ ...editingSite, visibility: e.currentTarget.checked ? 'public' : 'private' })} /><span class="track" /><span>对游客公开</span></label>
            <div class="modal-actions"><button class="btn" type="button" onClick={() => setEditingSite(null)}>取消</button><button class="btn btn-primary" type="submit">保存</button></div>
          </form>
        </Modal>
      )}

      {deletingCat && (
        <Modal title={`删除栏目「${deletingCat.cat.name}」`} onClose={() => setDeletingCat(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (deletingCat.moveTo) void doDeleteCat(deletingCat.cat, deletingCat.moveTo);
            }}
          >
            <p class="muted">该栏目下有 {deletingCat.cat.postCount} 篇文章。删除前需要把它们迁移到其他栏目（文章的公开状态保持不变，但会受新栏目的公开设置影响）。</p>
            <div class="field">
              <label>迁移到</label>
              <select required value={deletingCat.moveTo} onChange={(e) => setDeletingCat({ ...deletingCat, moveTo: e.currentTarget.value })}>
                <option value="">请选择栏目…</option>
                {sites.map((s) => (
                  <optgroup label={s.name}>
                    {s.categories.filter((x) => x.id !== deletingCat.cat.id).map((x) => <option value={x.id}>{x.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div class="modal-actions">
              <button class="btn" type="button" onClick={() => setDeletingCat(null)}>取消</button>
              <button class="btn btn-danger" type="submit" disabled={!deletingCat.moveTo}>迁移并删除</button>
            </div>
          </form>
        </Modal>
      )}

      {editingCat && (
        <Modal title={editingCat.id ? '编辑栏目' : '新建栏目'} onClose={() => setEditingCat(null)}>
          <form onSubmit={saveCat}>
            <div class="grid-2">
              <div class="field"><label>名称</label><input required maxLength={40} value={editingCat.name} onInput={(e) => setEditingCat({ ...editingCat, name: e.currentTarget.value })} /></div>
              <div class="field"><label>URL 名称</label><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={editingCat.slug} onInput={(e) => setEditingCat({ ...editingCat, slug: e.currentTarget.value.toLowerCase() })} /></div>
            </div>
            <div class="field">
              <label>所属分站</label>
              <select value={editingCat.siteId} onChange={(e) => setEditingCat({ ...editingCat, siteId: e.currentTarget.value })}>
                {sites.map((s) => <option value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div class="field"><label>简介</label><textarea maxLength={400} value={editingCat.description} onInput={(e) => setEditingCat({ ...editingCat, description: e.currentTarget.value })} /></div>
            <div class="field">
              <label>展示形式</label>
              <select value={editingCat.layout} onChange={(e) => setEditingCat({ ...editingCat, layout: e.currentTarget.value as Cat['layout'] })}>
                <option value="list">列表（标题 + 摘要）</option>
                <option value="cards">卡片</option>
                <option value="compact">紧凑（仅标题）</option>
              </select>
            </div>
            <label class="switch"><input type="checkbox" checked={editingCat.visibility === 'public'} onChange={(e) => setEditingCat({ ...editingCat, visibility: e.currentTarget.checked ? 'public' : 'private' })} /><span class="track" /><span>对游客公开</span></label>
            <div class="modal-actions"><button class="btn" type="button" onClick={() => setEditingCat(null)}>取消</button><button class="btn btn-primary" type="submit">保存</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

