import { useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import { confirmDialog } from '../../lib/dialogs';
import { SITE_ICONS, iconSvg } from '../../lib/icons';
import { byIds, useSortable } from '../../lib/useSortable';
import Modal from './Modal';
import { Icon, IconButton, Switch } from './ui';

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
const LAYOUT: Record<Cat['layout'], string> = { list: '列表', cards: '卡片', compact: '紧凑' };

export default function SitesManager({ initial }: { initial: SiteT[] }) {
  const [sites, setSites] = useState<SiteT[]>(initial);
  const [editingSite, setEditingSite] = useState<(Omit<SiteT, 'id' | 'categories'> & { id?: string }) | null>(null);
  const [editingCat, setEditingCat] = useState<(Omit<Cat, 'id' | 'postCount'> & { id?: string }) | null>(null);
  const [deletingCat, setDeletingCat] = useState<{ cat: Cat; moveTo: string } | null>(null);

  async function reload() {
    const tree = await api.get<SiteT[]>('/api/owner/sites');
    setSites((prev) => {
      const counts = new Map(prev.flatMap((p) => p.categories).map((c) => [c.id, c.postCount]));
      return tree.map((s) => ({ ...s, categories: s.categories.map((c) => ({ ...c, postCount: counts.get(c.id) ?? 0 })) }));
    });
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
    const ok = await confirmDialog(`删除分站「${s.name}」？`, s.categories.length ? '它还有栏目，需要先删除或迁移这些栏目。' : null, { danger: true, okLabel: '删除' });
    if (!ok) return;
    try {
      await api.del(`/api/owner/sites/${s.id}`);
      setSites((x) => x.filter((y) => y.id !== s.id));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function toggleSite(s: SiteT) {
    const { id, categories: _c, ...rest } = s;
    const visibility = s.visibility === 'public' ? 'private' : 'public';
    try {
      await api.put(`/api/owner/sites/${id}`, { ...rest, visibility });
      setSites((x) => x.map((y) => (y.id === id ? { ...y, visibility } : y)));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  const siteSort = useSortable(sites.map((s) => s.id), async (ids) => {
    setSites((x) => byIds(x, ids));
    await api.post('/api/owner/sites/reorder', { ids }).catch((e) => toast(errMsg(e), 'error'));
  });

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
    if (c.postCount > 0) return setDeletingCat({ cat: c, moveTo: '' });
    if (!(await confirmDialog(`删除栏目「${c.name}」？`, null, { danger: true, okLabel: '删除' }))) return;
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

  return (
    <div class="sm">
      <div class="row-between sm-top">
        <p class="hint">拖动左侧手柄排序（或聚焦手柄后按 Alt+↑/↓）。分站与栏目的“公开”开关会立即影响游客导航、列表、文章直链、搜索、RSS 和站点地图。</p>
        <button class="btn btn-primary" type="button" onClick={() => setEditingSite({ ...blankSite })}><Icon name="plus" size={14} />新建分站</button>
      </div>

      <div class="stack" ref={siteSort.ref as never} onPointerDown={siteSort.onPointerDown} onKeyDown={siteSort.onKeyDown}>
        {sites.map((s) => (
          <SiteCard
            key={s.id}
            site={s}
            onToggle={() => toggleSite(s)}
            onEdit={() => setEditingSite({ ...s })}
            onDelete={() => deleteSite(s)}
            onToggleCat={toggleCat}
            onEditCat={(c) => setEditingCat({ ...c })}
            onDeleteCat={deleteCat}
            onAddCat={() => setEditingCat({ ...blankCat, siteId: s.id })}
            onReorderCats={(ids) => setSites((x) => x.map((y) => (y.id === s.id ? { ...y, categories: byIds(y.categories, ids) } : y)))}
          />
        ))}
      </div>

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
              <div class="sm-icons" role="radiogroup" aria-label="图标">
                {SITE_ICONS.map((ic) => (
                  <button type="button" role="radio" class={`sm-icon-opt ${editingSite.icon === ic ? 'sel' : ''}`} aria-checked={editingSite.icon === ic} aria-label={ic} onClick={() => setEditingSite({ ...editingSite, icon: ic })} dangerouslySetInnerHTML={{ __html: iconSvg(ic) }} />
                ))}
              </div>
            </div>
            <Switch checked={editingSite.visibility === 'public'} onChange={(v) => setEditingSite({ ...editingSite, visibility: v ? 'public' : 'private' })} label="对游客公开" />
            <div class="modal-actions"><button class="btn" type="button" onClick={() => setEditingSite(null)}>取消</button><button class="btn btn-primary" type="submit">保存</button></div>
          </form>
        </Modal>
      )}

      {deletingCat && (
        <Modal title={`删除栏目「${deletingCat.cat.name}」`} onClose={() => setDeletingCat(null)}>
          <form onSubmit={(e) => { e.preventDefault(); if (deletingCat.moveTo) void doDeleteCat(deletingCat.cat, deletingCat.moveTo); }}>
            <p class="muted modal-body">该栏目下有 {deletingCat.cat.postCount} 篇文章。删除前需要把它们迁移到其他栏目；文章本身的公开设置不变，但会受新栏目公开与否的影响。</p>
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
              <button class="btn btn-danger-solid" type="submit" disabled={!deletingCat.moveTo}>迁移并删除</button>
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
            <Switch checked={editingCat.visibility === 'public'} onChange={(v) => setEditingCat({ ...editingCat, visibility: v ? 'public' : 'private' })} label="对游客公开" />
            <div class="modal-actions"><button class="btn" type="button" onClick={() => setEditingCat(null)}>取消</button><button class="btn btn-primary" type="submit">保存</button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function SiteCard({ site: s, onToggle, onEdit, onDelete, onToggleCat, onEditCat, onDeleteCat, onAddCat, onReorderCats }: {
  site: SiteT;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleCat: (c: Cat) => void;
  onEditCat: (c: Cat) => void;
  onDeleteCat: (c: Cat) => void;
  onAddCat: () => void;
  onReorderCats: (ids: string[]) => void;
}) {
  const catSort = useSortable(s.categories.map((c) => c.id), async (ids) => {
    onReorderCats(ids);
    await api.post('/api/owner/categories/reorder', { ids }).catch((e) => toast(errMsg(e), 'error'));
  });
  return (
    <section class={`panel sm-site ${s.visibility === 'public' ? '' : 'is-hidden'}`} data-sort-id={s.id}>
      <div class="sm-site-head">
        <button type="button" class="handle" data-sort-handle aria-label={`拖动排序：${s.name}`}><Icon name="grip" size={15} /></button>
        <span class="sm-icon anim-icon" dangerouslySetInnerHTML={{ __html: iconSvg(s.icon) }} />
        <div class="sm-site-title">
          <h2>{s.name} <small class="faint">{s.enName}</small></h2>
          <div class="faint small">/{s.slug} · {s.description || '（无简介）'}</div>
        </div>
        <Switch checked={s.visibility === 'public'} onChange={onToggle} label={s.visibility === 'public' ? '公开' : '隐藏'} />
        <IconButton icon="edit" label={`编辑分站 ${s.name}`} onClick={onEdit} />
        <IconButton icon="trash" label={`删除分站 ${s.name}`} variant="danger" onClick={onDelete} />
      </div>
      <ul class="sm-cats" ref={catSort.ref as never} onPointerDown={catSort.onPointerDown} onKeyDown={catSort.onKeyDown}>
        {s.categories.map((c) => (
          <li data-sort-id={c.id} class={`sm-cat ${c.visibility === 'public' ? '' : 'is-hidden'}`}>
            <button type="button" class="handle" data-sort-handle aria-label={`拖动排序：${c.name}`}><Icon name="grip" size={14} /></button>
            <div class="sm-cat-main">
              <strong>{c.name}</strong> <span class="faint small">/{s.slug}/{c.slug}</span>
              {c.description && <div class="faint small">{c.description}</div>}
            </div>
            <span class="pill">{c.postCount} 篇 · {LAYOUT[c.layout]}</span>
            <Switch checked={c.visibility === 'public'} onChange={() => onToggleCat(c)} label={c.visibility === 'public' ? '公开' : '隐藏'} />
            <span class="row-actions">
              <a class="ibtn ibtn-sm" href={`/owner/posts?category=${c.id}`} title="查看文章" aria-label={`查看 ${c.name} 的文章`}><Icon name="archive" size={14} /></a>
              <IconButton icon="edit" label={`编辑栏目 ${c.name}`} size="sm" onClick={() => onEditCat(c)} />
              <IconButton icon="trash" label={`删除栏目 ${c.name}`} size="sm" variant="danger" onClick={() => onDeleteCat(c)} />
            </span>
          </li>
        ))}
      </ul>
      <button class="sm-addcat" type="button" onClick={onAddCat}><Icon name="plus" size={13} />新建栏目</button>
    </section>
  );
}
