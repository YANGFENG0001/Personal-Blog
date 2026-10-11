import { useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import { confirmDialog } from '../../lib/dialogs';
import { byIds, useSortable } from '../../lib/useSortable';
import { Icon, IconButton } from './ui';
import type { Settings } from '../../server/seed';
import type { Template } from '../../server/services/config';

interface Upload {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  createdAt: string;
}

interface Props {
  settings: Pick<Settings, 'site' | 'profile'>;
  templates: Template[];
  progress: string[];
  uploads: Upload[];
  username: string;
}

async function put(key: string, value: unknown) {
  try {
    await api.put(`/api/owner/settings/${key}`, value);
    toast('已保存');
    return true;
  } catch (e) {
    toast(errMsg(e), 'error');
    return false;
  }
}

export default function SettingsManager(p: Props) {
  return (
    <div class="stack">
      <nav class="st-nav" aria-label="设置分区">
        {[['site', '站点'], ['profile', '个人资料'], ['templates', '模板与进度'], ['files', '文件'], ['account', '账号与备份']].map(([id, l]) => (
          <a class="btn btn-sm" href={`#${id}`}>{l}</a>
        ))}
      </nav>
      <SitePanel initial={p.settings.site} />
      <ProfilePanel initial={p.settings.profile} />
      <TemplatesPanel initial={p.templates} progress={p.progress} />
      <FilesPanel initial={p.uploads} />
      <AccountPanel username={p.username} />
    </div>
  );
}

function SitePanel({ initial }: { initial: Settings['site'] }) {
  const [s, setS] = useState(initial);
  const f = (k: keyof typeof s) => (e: Event) => setS({ ...s, [k]: (e.currentTarget as HTMLInputElement).value });
  return (
    <section class="panel" id="site">
      <form onSubmit={(e) => { e.preventDefault(); void put('site', s); }}>
        <div class="panel-head"><h2>站点信息</h2><button class="btn btn-primary" type="submit">保存</button></div>
        <div class="grid-2">
          <div class="field"><label>站点名称</label><input required maxLength={60} value={s.title} onInput={f('title')} /></div>
          <div class="field"><label>副标题</label><input maxLength={120} value={s.subtitle} onInput={f('subtitle')} /></div>
        </div>
        <div class="field"><label>首页引言</label><textarea maxLength={1000} value={s.intro} onInput={f('intro')} /></div>
        <div class="grid-3">
          <div class="field"><label>建站日期</label><input type="date" required value={s.launchDate} onInput={f('launchDate')} /></div>
          <div class="field"><label>语言</label><input maxLength={20} value={s.language} onInput={f('language')} /></div>
          <div class="field"><label>页脚文字</label><input maxLength={300} value={s.footer} onInput={f('footer')} /></div>
        </div>
      </form>
    </section>
  );
}

function ProfilePanel({ initial }: { initial: Settings['profile'] }) {
  const [s, setS] = useState(initial);
  const [interests, setInterests] = useState(initial.interests.join('，'));
  async function save(e: Event) {
    e.preventDefault();
    const links = s.links.filter((l) => l.label.trim() && l.url.trim());
    await put('profile', { ...s, links, interests: interests.split(/[,，]/).map((x) => x.trim()).filter(Boolean) });
  }
  return (
    <section class="panel" id="profile">
      <form onSubmit={save}>
        <div class="panel-head">
          <div><h2>个人资料与头像卡片</h2><p class="panel-sub">游客悬停（移动端点击）头像时看到的简介。</p></div>
          <button class="btn btn-primary" type="submit">保存</button>
        </div>
        <label class="switch"><input type="checkbox" checked={s.public} onChange={(e) => setS({ ...s, public: e.currentTarget.checked })} /><span class="track" /><span>公开显示头像与简介</span></label>
        <div class="grid-3" style="margin-top:14px">
          <div class="field"><label>昵称</label><input required maxLength={60} value={s.name} onInput={(e) => setS({ ...s, name: e.currentTarget.value })} /></div>
          <div class="field"><label>头像文字（1–2 字）</label><input maxLength={2} value={s.avatarText} onInput={(e) => setS({ ...s, avatarText: e.currentTarget.value })} /></div>
          <div class="field"><label>头像图片地址（可选）</label><input value={s.avatarUrl} placeholder="/uploads/… 或 https://…" onInput={(e) => setS({ ...s, avatarUrl: e.currentTarget.value })} /></div>
        </div>
        <div class="field"><label>简介</label><textarea maxLength={600} value={s.bio} onInput={(e) => setS({ ...s, bio: e.currentTarget.value })} /></div>
        <div class="field"><label>研究 / 技术兴趣（逗号分隔）</label><input value={interests} onInput={(e) => setInterests(e.currentTarget.value)} /></div>
        <div class="field">
          <span class="label">社交链接</span>
          <ul class="list-plain st-links">
            {s.links.map((l, i) => (
              <li>
                <input class="input" placeholder="名称" value={l.label} onInput={(e) => setS({ ...s, links: s.links.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)) })} aria-label="链接名称" />
                <input class="input" placeholder="https://" value={l.url} onInput={(e) => setS({ ...s, links: s.links.map((x, j) => (j === i ? { ...x, url: e.currentTarget.value } : x)) })} aria-label="链接地址" />
                <button class="btn btn-sm btn-ghost btn-danger" type="button" onClick={() => setS({ ...s, links: s.links.filter((_, j) => j !== i) })}>删除</button>
              </li>
            ))}
          </ul>
          <button class="btn btn-sm" type="button" onClick={() => setS({ ...s, links: [...s.links, { label: '', url: 'https://' }] })}>+ 添加链接</button>
        </div>
      </form>
    </section>
  );
}

function TemplatesPanel({ initial, progress }: { initial: Template[]; progress: string[] }) {
  const [tpls, setTpls] = useState(initial);
  const [editing, setEditing] = useState<(Template & { isNew?: boolean }) | null>(null);
  const [prog, setProg] = useState(progress.join('，'));

  async function saveTpl(e: Event) {
    e.preventDefault();
    if (!editing) return;
    const { isNew, sort: _s, ...body } = editing;
    try {
      if (isNew) await api.post('/api/owner/templates', body);
      else await api.put(`/api/owner/templates/${body.id}`, body);
      setTpls(await api.get<Template[]>('/api/owner/templates'));
      setEditing(null);
      toast('模板已保存');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }
  async function delTpl(t: Template) {
    if (!(await confirmDialog(`删除模板「${t.name}」？`, '已使用该模板的文章不受影响。', { danger: true, okLabel: '删除' }))) return;
    try {
      await api.del(`/api/owner/templates/${t.id}`);
      setTpls((x) => x.filter((y) => y.id !== t.id));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }
  const sortable = useSortable(tpls.map((t) => t.id), async (ids) => {
    setTpls((xs) => byIds(xs, ids));
    await api.post('/api/owner/templates/reorder', { ids }).catch((e) => toast(errMsg(e), 'error'));
  });
  async function saveProgress() {
    try {
      await api.put('/api/owner/progress', { labels: prog.split(/[,，\n]/).map((x) => x.trim()).filter(Boolean) });
      toast('进度词库已保存');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <section class="panel" id="templates">
      <div class="panel-head">
        <div><h2>文章模板</h2><p class="panel-sub">模板只用于快速起步，不限制写作结构。</p></div>
        <button class="btn" type="button" onClick={() => setEditing({ id: '', name: '', description: '', bodyMd: '', reflectionMd: '', defaultProgress: null, progressOptions: [], sort: 0, isNew: true })}>新建模板</button>
      </div>
      <ul class="list-plain st-tpls" ref={sortable.ref as never} onPointerDown={sortable.onPointerDown} onKeyDown={sortable.onKeyDown}>
        {tpls.map((t) => (
          <li data-sort-id={t.id}>
            <button type="button" class="handle" data-sort-handle aria-label={`拖动排序：${t.name}`}><Icon name="grip" size={14} /></button>
            <span class="st-tpl-name"><strong>{t.name}</strong> <span class="faint">· {t.description}</span></span>
            <span class="row-actions">
              <IconButton icon="edit" label={`编辑 ${t.name}`} size="sm" onClick={() => setEditing({ ...t })} />
              <IconButton icon="trash" label={`删除 ${t.name}`} size="sm" variant="danger" onClick={() => delTpl(t)} />
            </span>
          </li>
        ))}
      </ul>
      {editing && (
        <form class="st-tpl" onSubmit={saveTpl}>
          <div class="grid-3">
            <div class="field"><label>ID</label><input required disabled={!editing.isNew} pattern="[a-z0-9-]{1,40}" value={editing.id} onInput={(e) => setEditing({ ...editing, id: e.currentTarget.value })} /></div>
            <div class="field"><label>名称</label><input required maxLength={40} value={editing.name} onInput={(e) => setEditing({ ...editing, name: e.currentTarget.value })} /></div>
            <div class="field"><label>默认进度</label><input maxLength={40} value={editing.defaultProgress ?? ''} onInput={(e) => setEditing({ ...editing, defaultProgress: e.currentTarget.value || null })} /></div>
          </div>
          <div class="field"><label>说明</label><input maxLength={200} value={editing.description} onInput={(e) => setEditing({ ...editing, description: e.currentTarget.value })} /></div>
          <div class="field"><label>该模板可选的进度（逗号分隔，留空则使用全局词库）</label><input value={editing.progressOptions.join('，')} onInput={(e) => setEditing({ ...editing, progressOptions: e.currentTarget.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) })} /></div>
          <div class="field"><label>正文模板（Markdown）</label><textarea rows={10} value={editing.bodyMd} onInput={(e) => setEditing({ ...editing, bodyMd: e.currentTarget.value })} /></div>
          <div class="field"><label>心得模板</label><textarea rows={3} value={editing.reflectionMd} onInput={(e) => setEditing({ ...editing, reflectionMd: e.currentTarget.value })} /></div>
          <div class="row"><button class="btn btn-primary" type="submit">保存模板</button><button class="btn" type="button" onClick={() => setEditing(null)}>取消</button></div>
        </form>
      )}
      <div class="st-tpl">
        <div class="field">
          <label>全局进度词库（逗号分隔）</label>
          <input value={prog} onInput={(e) => setProg(e.currentTarget.value)} />
        </div>
        <button class="btn" type="button" onClick={saveProgress}>保存进度词库</button>
      </div>
    </section>
  );
}

function FilesPanel({ initial }: { initial: Upload[] }) {
  const [files, setFiles] = useState(initial);
  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    for (const f of [...(input.files ?? [])]) {
      const form = new FormData();
      form.append('file', f);
      try {
        await api.upload('/api/owner/uploads', form);
      } catch (err) {
        toast(`${f.name}：${errMsg(err)}`, 'error');
      }
    }
    input.value = '';
    setFiles(await api.get<Upload[]>('/api/owner/uploads'));
  }
  async function del(u: Upload) {
    if (!(await confirmDialog(`删除 ${u.originalName}？`, '引用它的文章将无法再显示这张图片。', { danger: true, okLabel: '删除' }))) return;
    try {
      await api.del(`/api/owner/uploads/${u.id}`);
      setFiles((x) => x.filter((y) => y.id !== u.id));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }
  return (
    <section class="panel" id="files">
      <div class="panel-head">
        <div><h2>图片文件</h2><p class="panel-sub">支持 PNG / JPEG / GIF / WebP / AVIF，单个不超过 8MB。服务端校验文件内容并使用随机文件名。</p></div>
        <label class="btn btn-primary">上传图片<input type="file" accept="image/*" multiple hidden onChange={upload} /></label>
      </div>
      {files.length === 0 ? <p class="empty-note">还没有上传文件。</p> : (
        <div class="st-uploads">
          {files.map((u) => (
            <figure>
              <img src={`/uploads/${u.filename}`} alt={u.originalName} loading="lazy" />
              <figcaption>
                <span class="faint">{u.originalName} · {Math.round(u.size / 1024)} KB</span>
                <code>/uploads/{u.filename}</code>
                <span class="row">
                  <button class="btn btn-sm" type="button" onClick={() => { void navigator.clipboard?.writeText(`![${u.originalName}](/uploads/${u.filename})`); toast('已复制 Markdown'); }}>复制</button>
                  <button class="btn btn-sm btn-danger" type="button" onClick={() => del(u)}>删除</button>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}

function AccountPanel({ username }: { username: string }) {
  const [a, setA] = useState({ username, currentPassword: '', newPassword: '', confirm: '' });
  async function save(e: Event) {
    e.preventDefault();
    if (a.newPassword !== a.confirm) return toast('两次输入的新密码不一致', 'error');
    try {
      await api.put('/api/owner/account', { username: a.username, currentPassword: a.currentPassword, newPassword: a.newPassword });
      toast('已更新，请重新登录');
      setTimeout(() => (location.href = '/owner/login'), 800);
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }
  return (
    <section class="panel" id="account">
      <div class="grid-2">
        <form onSubmit={save}>
          <h2>账号</h2>
          <p class="panel-sub">修改后所有设备都需要重新登录。</p>
          <div class="field"><label>用户名</label><input required autocomplete="username" value={a.username} onInput={(e) => setA({ ...a, username: e.currentTarget.value })} /></div>
          <div class="field"><label>当前密码</label><input required type="password" autocomplete="current-password" value={a.currentPassword} onInput={(e) => setA({ ...a, currentPassword: e.currentTarget.value })} /></div>
          <div class="field"><label>新密码（至少 10 位）</label><input required minLength={10} type="password" autocomplete="new-password" value={a.newPassword} onInput={(e) => setA({ ...a, newPassword: e.currentTarget.value })} /></div>
          <div class="field"><label>确认新密码</label><input required type="password" autocomplete="new-password" value={a.confirm} onInput={(e) => setA({ ...a, confirm: e.currentTarget.value })} /></div>
          <button class="btn btn-primary" type="submit">更新账号</button>
        </form>
        <div>
          <h2>备份与导出</h2>
          <p class="panel-sub">建议同时在服务器上配置定时备份（见部署文档）。</p>
          <div class="stack">
            <a class="btn" href="/api/owner/backup">下载完整数据备份（JSON）</a>
            <a class="btn" href="/api/owner/posts/export">导出全部文章（Markdown ZIP）</a>
          </div>
        </div>
      </div>
    </section>
  );
}
