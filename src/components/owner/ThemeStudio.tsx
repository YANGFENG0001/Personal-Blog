import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import { confirmDialog, promptDialog } from '../../lib/dialogs';
import { BG_EFFECTS, EGG_SETS, PRESETS, contrast, getPreset, type Palette } from '../../lib/themes';
import { SCENES } from '../../lib/scenes';
import { MASCOTS } from '../../lib/mascot';
import { mergeCustom } from '../../lib/appearance';
import {
  BLEND_MODES, STICKER_SLOTS, STICKER_SLOT_LABELS, checkThemeCss, themeSchema,
  type CustomTheme, type StoredTheme, type ThemeLayer, type ThemeRotation,
} from '../../lib/custom-theme';
import { Icon, IconButton, Segmented, Switch } from './ui';

interface Props {
  themes: StoredTheme[];
  active: string;
  rotation: ThemeRotation;
  uploads: { filename: string; originalName: string }[];
  packs: { id: string; name: string }[];
  studioUrl: string;
}

type Upload = Props['uploads'][number];
const PALETTE_KEYS: [keyof Palette, string][] = [
  ['bg', '页面背景'], ['surface', '卡片表面'], ['ink', '正文'], ['muted', '次要文字'], ['faint', '弱化文字'],
  ['line', '分隔线'], ['pane', '面板'], ['accent', '强调色'], ['tint', '浅强调'],
];
const FONT_SITES: [string, string][] = [
  ['Google Fonts（含思源 / Noto 中文）', 'https://fonts.google.com/?subset=chinese-simplified'],
  ['字由 / 猫啃网（免费可商用中文字体合集）', 'https://www.maoken.com/'],
  ['思源宋体 Source Han Serif', 'https://github.com/adobe-fonts/source-han-serif/releases'],
  ['霞鹜文楷 LXGW WenKai', 'https://github.com/lxgw/LxgwWenKai/releases'],
  ['得意黑 Smiley Sans', 'https://github.com/atelier-anchor/smiley-sans/releases'],
  ['Fontsource（开源字体 woff2）', 'https://fontsource.org/'],
];

const themeLabel = (id: string, themes: StoredTheme[]) =>
  id.startsWith('custom:') ? themes.find((t) => `custom:${t.id}` === id)?.name ?? '（已删除）' : getPreset(id).name;

/* ======================================================================= */

export default function ThemeStudio(props: Props) {
  const [themes, setThemes] = useState(props.themes);
  const [editing, setEditing] = useState<StoredTheme | null>(null);
  const [tab, setTab] = useState<'library' | 'rotation'>('library');

  async function create(base: string) {
    const name = await promptDialog('新主题的名字', `${getPreset(base).name} · 我的版本`, { okLabel: '创建' });
    if (!name) return;
    try {
      const r = await api.post<{ theme: StoredTheme }>('/api/owner/themes', { name, base });
      setThemes([...themes, r.theme]);
      setEditing(r.theme);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  async function importFile(file: File) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      return toast('不是有效的 JSON 主题文件', 'error');
    }
    const check = await api.post<{ ok: boolean; errors: string[]; warnings: string[] }>('/api/owner/themes/check', { theme: data });
    if (!check.ok) return toast(check.errors.join('；'), 'error');
    try {
      const r = await api.post<{ theme: StoredTheme; warnings: string[] }>('/api/owner/themes', data);
      setThemes([...themes, r.theme]);
      toast(`已导入主题「${r.theme.name}」`);
      for (const w of r.warnings) toast(w, 'error');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  async function remove(t: StoredTheme) {
    if (!(await confirmDialog(`删除主题「${t.name}」？`, '历史版本也会一起删除。网站正在使用它时会退回默认主题。', { danger: true, okLabel: '删除' }))) return;
    try {
      await api.del(`/api/owner/themes/${t.id}`);
      setThemes(themes.filter((x) => x.id !== t.id));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  async function use(id: string) {
    try {
      const a = await api.get<Record<string, unknown>>('/api/owner/settings/appearance');
      await api.put('/api/owner/settings/appearance', { ...a, preset: id });
      toast(`公开网站已切换到「${themeLabel(id, themes)}」`);
      location.reload();
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  if (editing) {
    return <ThemeEditor initial={editing} uploads={props.uploads} packs={props.packs} studioUrl={props.studioUrl}
      onClose={(t) => { if (t) setThemes(themes.map((x) => (x.id === t.id ? t : x))); setEditing(null); }} />;
  }

  return (
    <div class="ts">
      <nav class="ap-tabs" role="tablist" aria-label="主题工作室">
        <button type="button" role="tab" aria-selected={tab === 'library'} class={`ap-tab ${tab === 'library' ? 'on' : ''}`} onClick={() => setTab('library')}><Icon name="palette" size={15} />主题库</button>
        <button type="button" role="tab" aria-selected={tab === 'rotation'} class={`ap-tab ${tab === 'rotation' ? 'on' : ''}`} onClick={() => setTab('rotation')}><Icon name="sparkle" size={15} />轮换与彩蛋</button>
      </nav>
      {tab === 'library' ? (
        <Library themes={themes} active={props.active} onCreate={create} onEdit={setEditing} onDelete={remove} onUse={use} onImport={importFile} />
      ) : (
        <RotationPanel initial={props.rotation} themes={themes} />
      )}
    </div>
  );
}

/* ---------------- library ---------------- */

function Library({ themes, active, onCreate, onEdit, onDelete, onUse, onImport }: {
  themes: StoredTheme[]; active: string;
  onCreate: (base: string) => void; onEdit: (t: StoredTheme) => void; onDelete: (t: StoredTheme) => void; onUse: (id: string) => void; onImport: (f: File) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div class="stack">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>我的主题（{themes.length}）</h2>
            <p class="panel-sub">基于任一内置主题复制一份再改：配色、字体、圆角阴影、多层背景、粒子、装饰贴纸、光标、彩蛋与看板娘。可导出为 <code>.theme.json</code> 分享给别人，或导入别人分享的主题。</p>
          </div>
          <div class="row">
            <input ref={file} type="file" accept=".json,application/json" hidden onChange={(e) => e.currentTarget.files?.[0] && onImport(e.currentTarget.files[0])} />
            <button type="button" class="btn" onClick={() => file.current?.click()}><Icon name="upload" size={14} />导入主题文件</button>
          </div>
        </div>
        {themes.length === 0 ? (
          <p class="hint">还没有自定义主题。从下面任一内置主题“复制并编辑”开始。</p>
        ) : (
          <div class="ts-grid">
            {themes.map((t) => {
              const p = mergeCustom(t);
              const id = `custom:${t.id}`;
              return (
                <article class={`ts-card ${active === id ? 'on' : ''}`} key={t.id}>
                  <ThemeSwatch p={p} />
                  <div class="ts-meta">
                    <strong>{t.name}{active === id && <span class="pill">使用中</span>}</strong>
                    <small>基于 {getPreset(t.base).name}{t.author ? ` · ${t.author}` : ''} · v{t.version}</small>
                  </div>
                  <div class="row ts-actions">
                    <button type="button" class="btn btn-sm btn-primary" onClick={() => onEdit(t)}><Icon name="edit" size={13} />编辑</button>
                    {active !== id && <button type="button" class="btn btn-sm" onClick={() => onUse(id)}>设为网站主题</button>}
                    <a class="btn btn-sm btn-ghost" href={`/api/owner/themes/${t.id}?export`} download><Icon name="download" size={13} />导出</a>
                    <IconButton icon="trash" label={`删除 ${t.name}`} size="sm" variant="danger" onClick={() => onDelete(t)} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <section class="panel">
        <h2>从内置主题开始</h2>
        <div class="ts-grid ts-grid-sm">
          {PRESETS.map((p) => (
            <article class={`ts-card ${active === p.id ? 'on' : ''}`} key={p.id}>
              <ThemeSwatch p={p} />
              <div class="ts-meta"><strong>{p.name}{active === p.id && <span class="pill">使用中</span>}</strong></div>
              <div class="row ts-actions">
                <button type="button" class="btn btn-sm" onClick={() => onCreate(p.id)}><Icon name="copy" size={13} />复制并编辑</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ThemeSwatch({ p }: { p: ReturnType<typeof getPreset> }) {
  return (
    <span class="ts-swatch">
      {(['light', 'dark'] as const).map((m) => (
        <span style={`background:${p[m].bg};color:${p[m].ink}`}>
          <i style={`background:${p[m].accent}`} />
          <b>Aa</b>
          <em style={`background:${p[m].surface};border-color:${p[m].line}`} />
        </span>
      ))}
    </span>
  );
}

/* ---------------- editor ---------------- */

type Section = 'basic' | 'palette' | 'type' | 'background' | 'particles' | 'stickers' | 'extras' | 'css';
const SECTIONS: [Section, string, string][] = [
  ['basic', '基本信息', 'edit'],
  ['palette', '配色', 'palette'],
  ['type', '字体与形状', 'pen'],
  ['background', '背景图层', 'image'],
  ['particles', '粒子', 'sparkle'],
  ['stickers', '装饰贴纸', 'star'],
  ['extras', '光标 · 彩蛋 · 看板娘', 'eye'],
  ['css', '自定义 CSS', 'code'],
];

function ThemeEditor({ initial, uploads, packs, studioUrl, onClose }: {
  initial: StoredTheme; uploads: Upload[]; packs: Props['packs']; studioUrl: string; onClose: (t: StoredTheme | null) => void;
}) {
  const strip = (t: StoredTheme): CustomTheme => { const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = t; return rest; };
  const [t, setT] = useState<CustomTheme>(strip(initial));
  const [saved, setSaved] = useState(JSON.stringify(strip(initial)));
  const [section, setSection] = useState<Section>('basic');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [page, setPage] = useState('/');
  const [nonce, setNonce] = useState(0);
  const [last, setLast] = useState<StoredTheme | null>(null);
  const dirty = JSON.stringify(t) !== saved;
  const merged = useMemo(() => mergeCustom(t), [t]);
  const issues = useMemo(() => qualityIssues(t, merged), [t, merged]);

  async function save(): Promise<StoredTheme | null> {
    setSaving(true);
    try {
      const r = await api.put<{ theme: StoredTheme; warnings: string[] }>(`/api/owner/themes/${initial.id}`, t);
      // The server fills in defaults; adopt its copy so "dirty" compares like with like.
      setT(strip(r.theme));
      setSaved(JSON.stringify(strip(r.theme)));
      setLast(r.theme);
      setNonce((n) => n + 1);
      toast('主题已保存（已记录历史版本）');
      for (const w of r.warnings) toast(w, 'error');
      return r.theme;
    } catch (e) {
      toast(errMsg(e), 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function close() {
    if (dirty && !(await confirmDialog('有未保存的修改', '离开会丢失这些修改。', { okLabel: '仍然离开', danger: true }))) return;
    onClose(last);
  }

  return (
    <div class="te">
      <div class="te-bar">
        <button type="button" class="btn btn-ghost btn-sm" onClick={close}><Icon name="chevron-left" size={14} />返回主题库</button>
        <strong class="te-title">{t.name}</strong>
        {dirty && <span class="ap-dirty"><span />未保存</span>}
        <span class="te-spacer" />
        <Versions themeId={initial.id} nonce={nonce} onRestore={(nt) => { setT(strip(nt)); setSaved(JSON.stringify(strip(nt))); setNonce((n) => n + 1); }} />
        <a class="btn btn-sm" href={`/api/owner/themes/${initial.id}?export`} download><Icon name="download" size={13} />导出</a>
        <button type="button" class={`btn btn-primary btn-sm ${saving ? 'is-loading' : ''}`} disabled={!dirty || saving} onClick={save}>保存</button>
      </div>
      <div class="te-cols">
        <nav class="te-nav" aria-label="编辑分区">
          {SECTIONS.map(([id, label, icon]) => (
            <button type="button" class={section === id ? 'on' : ''} onClick={() => setSection(id)}><Icon name={icon} size={14} />{label}</button>
          ))}
          <div class={`te-quality ${issues.some((i) => i.level === 'error') ? 'bad' : issues.length ? 'warn' : 'ok'}`}>
            <strong>{issues.length ? `检查：${issues.length} 项提示` : '检查通过'}</strong>
            <ul>{issues.map((i) => <li class={i.level}>{i.text}</li>)}</ul>
          </div>
        </nav>
        <div class="te-form">
          {section === 'basic' && <BasicSection t={t} setT={setT} />}
          {section === 'palette' && <PaletteSection t={t} setT={setT} merged={merged} />}
          {section === 'type' && <TypeSection t={t} setT={setT} uploads={uploads} />}
          {section === 'background' && <BackgroundSection t={t} setT={setT} uploads={uploads} studioUrl={studioUrl} />}
          {section === 'particles' && <ParticleSection t={t} setT={setT} uploads={uploads} />}
          {section === 'stickers' && <StickerSection t={t} setT={setT} uploads={uploads} studioUrl={studioUrl} />}
          {section === 'extras' && <ExtrasSection t={t} setT={setT} uploads={uploads} packs={packs} />}
          {section === 'css' && <CssSection t={t} setT={setT} themeId={initial.id} />}
        </div>
        <Preview themeId={initial.id} dirty={dirty} nonce={nonce} mode={mode} setMode={setMode} device={device} setDevice={setDevice} page={page} setPage={setPage} onSave={save} />
      </div>
    </div>
  );
}

function Preview({ themeId, dirty, nonce, mode, setMode, device, setDevice, page, setPage, onSave }: {
  themeId: string; dirty: boolean; nonce: number; mode: 'light' | 'dark'; setMode: (m: 'light' | 'dark') => void;
  device: 'desktop' | 'mobile'; setDevice: (d: 'desktop' | 'mobile') => void; page: string; setPage: (p: string) => void; onSave: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const src = `${page}${page.includes('?') ? '&' : '?'}theme-preview=custom:${themeId}&n=${nonce}`;
  // Light/dark is switched inside the frame without reloading.
  useEffect(() => {
    const f = frame.current;
    const apply = () => f?.contentDocument?.documentElement.setAttribute('data-theme', mode);
    apply();
    f?.addEventListener('load', apply);
    return () => f?.removeEventListener('load', apply);
  }, [mode, src]);
  return (
    <section class="te-preview">
      <div class="row te-preview-bar">
        <Segmented label="预览页面" value={page} onChange={setPage} options={[['/', '首页'], ['/learning', '分站'], ['/archive', '归档'], ['/does-not-exist', '404']]} />
        <Segmented label="明暗" value={mode} onChange={setMode} options={[['light', '日'], ['dark', '夜']]} />
        <Segmented label="设备" value={device} onChange={setDevice} options={[['desktop', '桌面'], ['mobile', '手机']]} />
      </div>
      <div class={`te-frame-wrap ${device}`}>
        <iframe ref={frame} src={src} title="主题预览" loading="lazy" />
        {dirty && (
          <div class="te-stale">
            <span>预览显示的是已保存的版本</span>
            <button type="button" class="btn btn-sm btn-primary" onClick={onSave}>保存并刷新预览</button>
          </div>
        )}
      </div>
    </section>
  );
}

function Versions({ themeId, nonce, onRestore }: { themeId: string; nonce: number; onRestore: (t: StoredTheme) => void }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<{ id: number; name: string; createdAt: string }[]>([]);
  useEffect(() => { if (open) api.get<typeof list>(`/api/owner/themes/${themeId}?versions`).then(setList).catch(() => setList([])); }, [open, nonce]);
  async function restore(v: number) {
    if (!(await confirmDialog('恢复到这个版本？', '当前版本会先存入历史，可以再恢复回来。', { okLabel: '恢复' }))) return;
    try {
      onRestore(await api.post<StoredTheme>(`/api/owner/themes/${themeId}`, { rollback: v }));
      setOpen(false);
      toast('已恢复');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }
  return (
    <div class="te-versions">
      <button type="button" class="btn btn-sm btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}><Icon name="calendar" size={13} />历史版本</button>
      {open && (
        <div class="te-versions-pop">
          {list.length === 0 ? <p class="hint">还没有历史版本（每次保存会记录上一个版本，保留最近 10 个）。</p> : list.map((v) => (
            <button type="button" onClick={() => restore(v.id)}><span>{new Date(v.createdAt).toLocaleString('zh-CN')}</span><small>{v.name}</small></button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- quality checks ---------------- */

function qualityIssues(t: CustomTheme, p: ReturnType<typeof getPreset>): { level: 'error' | 'warn'; text: string }[] {
  const out: { level: 'error' | 'warn'; text: string }[] = [];
  for (const m of ['light', 'dark'] as const) {
    const pal = p[m];
    const name = m === 'light' ? '日间' : '夜间';
    if (contrast(pal.ink, pal.bg) < 7) out.push({ level: contrast(pal.ink, pal.bg) < 4.5 ? 'error' : 'warn', text: `${name}正文对比度 ${contrast(pal.ink, pal.bg).toFixed(1)}（建议 ≥ 7）` });
    if (contrast(pal.muted, pal.bg) < 4.5) out.push({ level: 'warn', text: `${name}次要文字对比度 ${contrast(pal.muted, pal.bg).toFixed(1)}（需 ≥ 4.5）` });
    if (contrast(pal.accent, pal.bg) < 3) out.push({ level: 'warn', text: `${name}强调色太淡（对比度 ${contrast(pal.accent, pal.bg).toFixed(1)}，需 ≥ 3）` });
  }
  const imgLayers = t.background.layers.filter((l) => l.kind === 'image');
  if (t.background.use === 'layers' && imgLayers.some((l) => l.src && !l.srcDark && l.mode === 'both')) out.push({ level: 'warn', text: '有图片图层没有夜间版本，夜里可能太亮' });
  if (t.background.use === 'layers' && t.background.readingPanel < 0.8 && imgLayers.length) out.push({ level: 'warn', text: '正文底板透明度低于 80%，图片背景上的文字可能不好读' });
  if (t.particles.use === 'image' && !t.particles.images.length) out.push({ level: 'error', text: '粒子选择了“图片”，但还没有选图片' });
  if ((t.typography.display === 'custom' && !t.typography.displayFont) || (t.typography.body === 'custom' && !t.typography.bodyFont)) out.push({ level: 'error', text: '选择了自定义字体，但还没有上传字体文件' });
  if (t.css.trim()) {
    const c = checkThemeCss(t.css);
    if (!c.ok) out.push({ level: 'error', text: `自定义 CSS：${c.errors[0]}` });
  }
  return out;
}

/* ---------------- shared pickers ---------------- */

function AssetPicker({ value, onChange, uploads, filter = /\.(png|webp|gif|jpg|jpeg|avif)$/i, label, allowEmpty = true }: {
  value: string | undefined; onChange: (v: string | undefined) => void; uploads: Upload[]; filter?: RegExp; label: string; allowEmpty?: boolean;
}) {
  const list = uploads.filter((u) => filter.test(u.filename));
  const input = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState<Upload[]>([]);
  async function upload(file: File) {
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api.upload<{ url: string }>('/api/owner/uploads', form);
      setLocal([{ filename: r.url.replace('/uploads/', ''), originalName: file.name }, ...local]);
      onChange(r.url);
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }
  const all = [...local, ...list];
  return (
    <div class="field">
      <span class="label">{label}</span>
      <div class="ts-assets">
        {allowEmpty && <button type="button" class={`ts-asset none ${!value ? 'on' : ''}`} onClick={() => onChange(undefined)}>无</button>}
        {all.slice(0, 18).map((u) => (
          <button type="button" class={`ts-asset ${value === `/uploads/${u.filename}` ? 'on' : ''}`} title={u.originalName} onClick={() => onChange(`/uploads/${u.filename}`)}>
            {/\.(woff2?|ttf|otf)$/i.test(u.filename) ? <span>{u.originalName.slice(0, 10)}</span> : <img src={`/uploads/${u.filename}`} alt="" loading="lazy" />}
          </button>
        ))}
        <input ref={input} type="file" hidden accept={filter.source.includes('woff') ? '.woff2' : 'image/*'} onChange={(e) => e.currentTarget.files?.[0] && upload(e.currentTarget.files[0])} />
        <button type="button" class="ts-asset add" onClick={() => input.current?.click()}><Icon name="plus" size={16} /></button>
      </div>
    </div>
  );
}

type SetT = (t: CustomTheme) => void;

/* ---------------- sections ---------------- */

function BasicSection({ t, setT }: { t: CustomTheme; setT: SetT }) {
  return (
    <div class="stack">
      <label class="field"><span class="label">名称</span><input value={t.name} maxLength={40} onInput={(e) => setT({ ...t, name: e.currentTarget.value })} /></label>
      <label class="field"><span class="label">简介</span><textarea rows={3} maxLength={200} value={t.description} onInput={(e) => setT({ ...t, description: e.currentTarget.value })} /></label>
      <div class="grid-2">
        <label class="field"><span class="label">作者</span><input value={t.author} maxLength={60} onInput={(e) => setT({ ...t, author: e.currentTarget.value })} /></label>
        <label class="field"><span class="label">版本</span><input value={t.version} maxLength={20} onInput={(e) => setT({ ...t, version: e.currentTarget.value })} /></label>
      </div>
      <label class="field">
        <span class="label">基于内置主题（未设置的部分都继承它）</span>
        <select value={t.base} onChange={(e) => setT({ ...t, base: e.currentTarget.value as CustomTheme['base'] })}>
          {PRESETS.map((p) => <option value={p.id}>{p.name}</option>)}
        </select>
      </label>
    </div>
  );
}

function PaletteSection({ t, setT, merged }: { t: CustomTheme; setT: SetT; merged: ReturnType<typeof getPreset> }) {
  const set = (m: 'light' | 'dark', k: keyof Palette, v: string) => setT({ ...t, palette: { ...t.palette, [m]: { ...merged[m], ...(t.palette[m] ?? {}), [k]: v } } });
  const reset = (m: 'light' | 'dark') => { const p = { ...t.palette }; delete p[m]; setT({ ...t, palette: p }); };
  return (
    <div class="ts-palettes">
      {(['light', 'dark'] as const).map((m) => (
        <section>
          <div class="row" style="justify-content:space-between">
            <h3>{m === 'light' ? '日间' : '夜间'}</h3>
            {t.palette[m] && <button type="button" class="btn btn-ghost btn-sm" onClick={() => reset(m)}>恢复继承</button>}
          </div>
          <div class="ts-colors">
            {PALETTE_KEYS.map(([k, label]) => (
              <label class="ts-color">
                <input type="color" value={merged[m][k]} onInput={(e) => set(m, k, e.currentTarget.value)} />
                <span>{label}</span>
                <code>{merged[m][k]}</code>
              </label>
            ))}
          </div>
          <div class="ts-sample" style={`background:${merged[m].bg};color:${merged[m].ink};border-color:${merged[m].line}`}>
            <strong style={`color:${merged[m].ink}`}>示例标题</strong>
            <p style={`color:${merged[m].muted}`}>次要文字 · 正文对比度 {contrast(merged[m].ink, merged[m].bg).toFixed(1)}</p>
            <span style={`background:${merged[m].surface};border-color:${merged[m].line}`}>卡片 <b style={`color:${merged[m].accent}`}>强调色</b></span>
          </div>
        </section>
      ))}
    </div>
  );
}

function TypeSection({ t, setT, uploads }: { t: CustomTheme; setT: SetT; uploads: Upload[] }) {
  const ty = t.typography;
  const setTy = (p: Partial<CustomTheme['typography']>) => setT({ ...t, typography: { ...ty, ...p } });
  const sh = t.shape;
  const setSh = (p: Partial<CustomTheme['shape']>) => setT({ ...t, shape: { ...sh, ...p } });
  return (
    <div class="stack">
      <h3>字体</h3>
      <div class="grid-2">
        <div class="field"><span class="label">标题字体</span>
          <Segmented label="标题字体" value={ty.display ?? 'inherit'} onChange={(v) => setTy({ display: v === 'inherit' ? undefined : (v as 'serif') })} options={[['inherit', '继承'], ['serif', '衬线'], ['sans', '无衬线'], ['custom', '上传']]} />
        </div>
        <div class="field"><span class="label">正文字体</span>
          <Segmented label="正文字体" value={ty.body ?? 'inherit'} onChange={(v) => setTy({ body: v === 'inherit' ? undefined : (v as 'serif') })} options={[['inherit', '继承'], ['sans', '无衬线'], ['serif', '衬线'], ['custom', '上传']]} />
        </div>
      </div>
      {ty.display === 'custom' && <AssetPicker label="标题字体文件（.woff2）" value={ty.displayFont} onChange={(v) => setTy({ displayFont: v })} uploads={uploads} filter={/\.woff2$/i} />}
      {ty.body === 'custom' && <AssetPicker label="正文字体文件（.woff2）" value={ty.bodyFont} onChange={(v) => setTy({ bodyFont: v })} uploads={uploads} filter={/\.woff2$/i} />}
      {(ty.display === 'custom' || ty.body === 'custom') && (
        <div class="ts-fontsites">
          <p class="hint">字体授权需要你自己确认（尤其是商用）。中文字体通常有几 MB，建议用子集化的 woff2（例如用 <code>fonttools</code> 只保留常用字）。下载字体：</p>
          <ul>{FONT_SITES.map(([n, u]) => <li><a href={u} target="_blank" rel="noopener noreferrer">{n}<Icon name="external" size={11} /></a></li>)}</ul>
        </div>
      )}
      <div class="grid-2">
        <label class="field"><span class="label">整体字号 {Math.round(ty.scale * 100)}%</span><input type="range" min={0.85} max={1.25} step={0.01} value={ty.scale} onInput={(e) => setTy({ scale: Number(e.currentTarget.value) })} /></label>
        <label class="field"><span class="label">正文行高 {ty.lineHeight ?? '继承'}</span><input type="range" min={1.4} max={2.4} step={0.05} value={ty.lineHeight ?? 2} onInput={(e) => setTy({ lineHeight: Number(e.currentTarget.value) })} /></label>
        <label class="field"><span class="label">标题字重 {ty.headingWeight ?? '继承'}</span><input type="range" min={400} max={900} step={100} value={ty.headingWeight ?? 700} onInput={(e) => setTy({ headingWeight: Number(e.currentTarget.value) })} /></label>
        <label class="field"><span class="label">标题字距 {ty.letterSpacing}em</span><input type="range" min={-0.02} max={0.12} step={0.01} value={ty.letterSpacing} onInput={(e) => setTy({ letterSpacing: Number(e.currentTarget.value) })} /></label>
      </div>
      <h3>形状</h3>
      <div class="grid-2">
        <div class="field"><span class="label">圆角</span><Segmented label="圆角" value={sh.radius ?? 'inherit'} onChange={(v) => setSh({ radius: v === 'inherit' ? undefined : (v as 'soft') })} options={[['inherit', '继承'], ['sharp', '直角'], ['soft', '柔和'], ['round', '圆润']]} /></div>
        <div class="field"><span class="label">阴影</span><Segmented label="阴影" value={sh.shadow} onChange={(v) => setSh({ shadow: v })} options={[['none', '无'], ['soft', '柔和'], ['paper', '纸张'], ['lifted', '浮起']]} /></div>
        <div class="field"><span class="label">密度</span><Segmented label="密度" value={sh.density ?? 'inherit'} onChange={(v) => setSh({ density: v === 'inherit' ? undefined : (v as 'compact') })} options={[['inherit', '继承'], ['compact', '紧凑'], ['comfortable', '舒展'], ['spacious', '宽松']]} /></div>
        <label class="field"><span class="label">边框粗细 {sh.border}px</span><input type="range" min={0} max={3} step={0.5} value={sh.border} onInput={(e) => setSh({ border: Number(e.currentTarget.value) })} /></label>
      </div>
    </div>
  );
}

const NEW_LAYER: ThemeLayer = { kind: 'image', angle: 180, position: 'center', size: 'cover', repeat: false, opacity: 1, blend: 'normal', depth: 0, drift: 'none', mode: 'both' };

function BackgroundSection({ t, setT, uploads, studioUrl }: { t: CustomTheme; setT: SetT; uploads: Upload[]; studioUrl: string }) {
  const b = t.background;
  const setB = (p: Partial<CustomTheme['background']>) => setT({ ...t, background: { ...b, ...p } });
  const setL = (i: number, p: Partial<ThemeLayer>) => setB({ layers: b.layers.map((l, j) => (j === i ? { ...l, ...p } : l)) });
  const move = (i: number, d: number) => { const ls = [...b.layers]; const [x] = ls.splice(i, 1); ls.splice(i + d, 0, x!); setB({ layers: ls }); };
  return (
    <div class="stack">
      <div class="field"><span class="label">背景来源</span>
        <Segmented label="背景来源" value={b.use} onChange={(v) => setB({ use: v })} options={[['inherit', `继承「${getPreset(t.base).name}」的背景`], ['layers', '自定义图层']]} />
      </div>
      {b.use === 'layers' && (
        <>
          <p class="hint">最多 6 层，从下往上叠。图片建议 WebP、宽 1920、≤ 400KB；正文区域（左侧约 60%）保持低对比。可以用 <a href={studioUrl} target="_blank" rel="noopener">素材工作室</a> 压缩和裁剪。</p>
          {b.layers.map((l, i) => (
            <div class="ts-layer" key={i}>
              <div class="row ts-layer-head">
                <strong>图层 {i + 1}</strong>
                <Segmented label="类型" value={l.kind} onChange={(v) => setL(i, { kind: v })} options={[['image', '图片'], ['gradient', '渐变'], ['texture', '纹理'], ['scene', '内置场景']]} />
                <span class="te-spacer" />
                <IconButton icon="chevron-up" label="下移一层" size="sm" disabled={i === 0} onClick={() => move(i, -1)} />
                <IconButton icon="chevron-down" label="上移一层" size="sm" disabled={i === b.layers.length - 1} onClick={() => move(i, 1)} />
                <IconButton icon="trash" label="删除图层" size="sm" variant="danger" onClick={() => setB({ layers: b.layers.filter((_, j) => j !== i) })} />
              </div>
              {l.kind === 'image' && (
                <div class="grid-2">
                  <AssetPicker label="日间图片" value={l.src} onChange={(v) => setL(i, { src: v })} uploads={uploads} allowEmpty={false} />
                  <AssetPicker label="夜间图片（可选）" value={l.srcDark} onChange={(v) => setL(i, { srcDark: v })} uploads={uploads} />
                </div>
              )}
              {l.kind === 'gradient' && (
                <div class="row">
                  <label class="ts-color"><input type="color" value={l.from ?? '#ffffff'} onInput={(e) => setL(i, { from: e.currentTarget.value })} /><span>起始</span></label>
                  <label class="ts-color"><input type="color" value={l.to ?? '#dde8f0'} onInput={(e) => setL(i, { to: e.currentTarget.value })} /><span>结束</span></label>
                  <label class="field" style="flex:1"><span class="label">角度 {l.angle}°</span><input type="range" min={0} max={360} value={l.angle} onInput={(e) => setL(i, { angle: Number(e.currentTarget.value) })} /></label>
                </div>
              )}
              {l.kind === 'texture' && <Segmented label="纹理" value={l.texture ?? 'paper'} onChange={(v) => setL(i, { texture: v })} options={[['paper', '纸纹'], ['dots', '点阵'], ['grid', '网格']]} />}
              {l.kind === 'scene' && (
                <select value={l.scene ?? ''} onChange={(e) => setL(i, { scene: e.currentTarget.value })}>
                  <option value="">选择场景…</option>
                  {SCENES.map((s) => <option value={s.id}>{s.name}</option>)}
                </select>
              )}
              <div class="ts-layer-opts">
                {l.kind === 'image' && (
                  <>
                    <label>位置<select value={l.position} onChange={(e) => setL(i, { position: e.currentTarget.value as ThemeLayer['position'] })}>
                      {[['center', '居中'], ['top', '顶部'], ['bottom', '底部'], ['left', '左'], ['right', '右'], ['top-left', '左上'], ['top-right', '右上'], ['bottom-left', '左下'], ['bottom-right', '右下']].map(([v, n]) => <option value={v}>{n}</option>)}
                    </select></label>
                    <label>尺寸<select value={l.size} onChange={(e) => setL(i, { size: e.currentTarget.value as ThemeLayer['size'] })}>
                      <option value="cover">铺满</option><option value="contain">完整显示</option><option value="width">撑满宽度</option><option value="auto">原始大小</option>
                    </select></label>
                    <label class="row"><input type="checkbox" checked={l.repeat} onChange={(e) => setL(i, { repeat: e.currentTarget.checked })} />平铺</label>
                  </>
                )}
                <label>不透明度 {Math.round(l.opacity * 100)}%<input type="range" min={0} max={1} step={0.05} value={l.opacity} onInput={(e) => setL(i, { opacity: Number(e.currentTarget.value) })} /></label>
                <label>混合<select value={l.blend} onChange={(e) => setL(i, { blend: e.currentTarget.value as ThemeLayer['blend'] })}>{BLEND_MODES.map((m) => <option value={m}>{m}</option>)}</select></label>
                <label>视差 {Math.round(l.depth * 100)}%<input type="range" min={0} max={1} step={0.05} value={l.depth} onInput={(e) => setL(i, { depth: Number(e.currentTarget.value) })} /></label>
                <label>漂移<select value={l.drift} onChange={(e) => setL(i, { drift: e.currentTarget.value as ThemeLayer['drift'] })}><option value="none">无</option><option value="slow">缓慢</option><option value="medium">中等</option></select></label>
                <label>显示于<select value={l.mode} onChange={(e) => setL(i, { mode: e.currentTarget.value as ThemeLayer['mode'] })}><option value="both">日夜都显示</option><option value="light">仅日间</option><option value="dark">仅夜间</option></select></label>
              </div>
            </div>
          ))}
          {b.layers.length < 6 && <button type="button" class="btn" onClick={() => setB({ layers: [...b.layers, { ...NEW_LAYER }] })}><Icon name="plus" size={14} />添加图层</button>}
          <div class="grid-2">
            <label class="field"><span class="label">正文底板不透明度 {Math.round(b.readingPanel * 100)}%</span><input type="range" min={0.6} max={1} step={0.02} value={b.readingPanel} onInput={(e) => setB({ readingPanel: Number(e.currentTarget.value) })} /></label>
            <label class="field"><span class="label">底板模糊 {b.blur}px</span><input type="range" min={0} max={20} value={b.blur} onInput={(e) => setB({ blur: Number(e.currentTarget.value) })} /></label>
          </div>
        </>
      )}
    </div>
  );
}

function ParticleSection({ t, setT, uploads }: { t: CustomTheme; setT: SetT; uploads: Upload[] }) {
  const pt = t.particles;
  const set = (p: Partial<CustomTheme['particles']>) => setT({ ...t, particles: { ...pt, ...p } });
  return (
    <div class="stack">
      <div class="field"><span class="label">粒子</span>
        <Segmented label="粒子" value={pt.use} onChange={(v) => set({ use: v })} options={[['inherit', '继承'], ['none', '无'], ['builtin', '内置效果'], ['image', '我的图片']]} />
      </div>
      {pt.use === 'builtin' && (
        <select value={pt.effect ?? ''} onChange={(e) => set({ effect: e.currentTarget.value })}>
          <option value="">选择效果…</option>
          {BG_EFFECTS.map((x) => <option value={x.id}>{x.name}</option>)}
        </select>
      )}
      {pt.use === 'image' && (
        <>
          <p class="hint">上传 1–4 张透明小图（≤ 64px 的 PNG / WebP，例如花瓣、叶子、雪花），粒子会随机使用。</p>
          <div class="ts-assets">
            {pt.images.map((src, i) => (
              <button type="button" class="ts-asset on" title="移除" onClick={() => set({ images: pt.images.filter((_, j) => j !== i) })}><img src={src} alt="" /></button>
            ))}
          </div>
          {pt.images.length < 4 && <AssetPicker label="添加图片" value={undefined} onChange={(v) => v && set({ images: [...pt.images, v] })} uploads={uploads} allowEmpty={false} />}
          <div class="grid-2">
            <div class="field"><span class="label">运动方式</span><Segmented label="运动" value={pt.motion} onChange={(v) => set({ motion: v })} options={[['fall', '飘落'], ['rise', '上浮'], ['drift', '横飘'], ['twinkle', '闪烁']]} /></div>
            <Switch checked={pt.darkOnly} onChange={(v) => set({ darkOnly: v })} label="只在夜间显示" />
            <label class="field"><span class="label">数量 {pt.count}</span><input type="range" min={4} max={80} value={pt.count} onInput={(e) => set({ count: Number(e.currentTarget.value) })} /></label>
            <label class="field"><span class="label">速度 {pt.speed}×</span><input type="range" min={0.2} max={3} step={0.1} value={pt.speed} onInput={(e) => set({ speed: Number(e.currentTarget.value) })} /></label>
            <label class="field"><span class="label">大小 {pt.size}px</span><input type="range" min={6} max={64} value={pt.size} onInput={(e) => set({ size: Number(e.currentTarget.value) })} /></label>
          </div>
        </>
      )}
      <p class="hint">动效关闭、系统“减少动态”、手机窄屏时，粒子会自动停用或静止。</p>
    </div>
  );
}

function StickerSection({ t, setT, uploads, studioUrl }: { t: CustomTheme; setT: SetT; uploads: Upload[]; studioUrl: string }) {
  const set = (stickers: CustomTheme['stickers']) => setT({ ...t, stickers });
  const used = new Set(t.stickers.map((s) => s.slot));
  return (
    <div class="stack">
      <p class="hint">把透明小图放到页面的固定位置。贴纸合集图可以先用 <a href={studioUrl} target="_blank" rel="noopener">素材工作室</a> 的“自动切分合集”切成单张再上传。</p>
      {t.stickers.map((s, i) => (
        <div class="ts-layer" key={i}>
          <div class="row ts-layer-head">
            <select value={s.slot} onChange={(e) => set(t.stickers.map((x, j) => (j === i ? { ...x, slot: e.currentTarget.value as typeof s.slot } : x)))}>
              {STICKER_SLOTS.map((k) => <option value={k} disabled={k !== s.slot && used.has(k)}>{STICKER_SLOT_LABELS[k]}</option>)}
            </select>
            <span class="te-spacer" />
            <IconButton icon="trash" label="删除贴纸" size="sm" variant="danger" onClick={() => set(t.stickers.filter((_, j) => j !== i))} />
          </div>
          <AssetPicker label="图片" value={s.src} onChange={(v) => v && set(t.stickers.map((x, j) => (j === i ? { ...x, src: v } : x)))} uploads={uploads} allowEmpty={false} />
          <div class="ts-layer-opts">
            <label>大小 {s.size}px<input type="range" min={16} max={320} value={s.size} onInput={(e) => set(t.stickers.map((x, j) => (j === i ? { ...x, size: Number(e.currentTarget.value) } : x)))} /></label>
            <label>不透明度 {Math.round(s.opacity * 100)}%<input type="range" min={0.1} max={1} step={0.05} value={s.opacity} onInput={(e) => set(t.stickers.map((x, j) => (j === i ? { ...x, opacity: Number(e.currentTarget.value) } : x)))} /></label>
            <label>旋转 {s.rotate}°<input type="range" min={-45} max={45} value={s.rotate} onInput={(e) => set(t.stickers.map((x, j) => (j === i ? { ...x, rotate: Number(e.currentTarget.value) } : x)))} /></label>
          </div>
        </div>
      ))}
      {t.stickers.length < STICKER_SLOTS.length && (
        <AssetPicker label="添加贴纸（选择图片）" value={undefined} uploads={uploads} allowEmpty={false}
          onChange={(v) => { const slot = STICKER_SLOTS.find((k) => !used.has(k)); if (v && slot) set([...t.stickers, { slot, src: v, size: 64, opacity: 1, rotate: 0 }]); }} />
      )}
    </div>
  );
}

function ExtrasSection({ t, setT, uploads, packs }: { t: CustomTheme; setT: SetT; uploads: Upload[]; packs: Props['packs'] }) {
  return (
    <div class="stack">
      <h3>光标</h3>
      <AssetPicker label="光标图片（32×32 以内的透明 PNG；网站“鼠标指针”需设为“主题光标”才会生效）" value={t.cursor.src} onChange={(v) => setT({ ...t, cursor: { ...t.cursor, src: v } })} uploads={uploads} />
      {t.cursor.src && (
        <div class="grid-2">
          <label class="field"><span class="label">热点 X {t.cursor.hotspot[0]}</span><input type="range" min={0} max={31} value={t.cursor.hotspot[0]} onInput={(e) => setT({ ...t, cursor: { ...t.cursor, hotspot: [Number(e.currentTarget.value), t.cursor.hotspot[1]] } })} /></label>
          <label class="field"><span class="label">热点 Y {t.cursor.hotspot[1]}</span><input type="range" min={0} max={31} value={t.cursor.hotspot[1]} onInput={(e) => setT({ ...t, cursor: { ...t.cursor, hotspot: [t.cursor.hotspot[0], Number(e.currentTarget.value)] } })} /></label>
        </div>
      )}
      <h3>彩蛋组</h3>
      <select value={t.eggSet ?? ''} onChange={(e) => setT({ ...t, eggSet: e.currentTarget.value || undefined })}>
        <option value="">继承</option>
        {EGG_SETS.map((s) => <option value={s.id}>{s.name}</option>)}
      </select>
      <h3>看板娘</h3>
      <select value={t.mascot ?? ''} onChange={(e) => setT({ ...t, mascot: e.currentTarget.value || undefined })}>
        <option value="">继承</option>
        {MASCOTS.map((m) => <option value={m.id}>{m.name}</option>)}
        {packs.map((p) => <option value={`pack:${p.id}`}>{p.name}（角色包）</option>)}
      </select>
      <p class="hint">看板娘在“外观与主题 → 看板娘”里设为“跟随主题”时，会使用这里的角色。</p>
    </div>
  );
}

function CssSection({ t, setT, themeId }: { t: CustomTheme; setT: SetT; themeId: string }) {
  const result = useMemo(() => (t.css.trim() ? checkThemeCss(t.css) : null), [t.css]);
  const file = useRef<HTMLInputElement>(null);
  function download() {
    const blob = new Blob([t.css || TEMPLATE], { type: 'text/css' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${t.name}.css`;
    a.click();
  }
  return (
    <div class="stack">
      <p class="hint">
        优先用左侧的配置项。需要更细的调整时再写 CSS：<b>下载 → 用你喜欢的编辑器修改 → 导入回来</b>。所有规则会自动限定在本主题内生效；
        禁止 <code>@import</code>、外部链接、隐藏整个页面、遮挡点击的全屏层等，保存前会自动检查。
      </p>
      <div class="row">
        <button type="button" class="btn btn-sm" onClick={download}><Icon name="download" size={13} />下载 CSS{t.css ? '' : '（模板）'}</button>
        <input ref={file} type="file" accept=".css,text/css" hidden onChange={async (e) => { const f = e.currentTarget.files?.[0]; if (f) setT({ ...t, css: await f.text() }); }} />
        <button type="button" class="btn btn-sm" onClick={() => file.current?.click()}><Icon name="upload" size={13} />导入 CSS</button>
        {t.css && <button type="button" class="btn btn-sm btn-ghost" onClick={() => setT({ ...t, css: '' })}>清空</button>}
      </div>
      <textarea class="ts-css" spellcheck={false} rows={18} value={t.css} placeholder={TEMPLATE} onInput={(e) => setT({ ...t, css: e.currentTarget.value })} />
      {result && (
        <div class={`ts-css-result ${result.ok ? 'ok' : 'bad'}`}>
          <strong>{result.ok ? '✓ 检查通过' : '✗ 未通过，保存会被拒绝'}</strong>
          <ul>
            {result.errors.map((e) => <li class="error">{e}</li>)}
            {result.warnings.map((w) => <li class="warn">{w}</li>)}
          </ul>
        </div>
      )}
      <p class="hint">分享主题：在顶部点“导出”得到 <code>.theme.json</code>，其中已包含这段 CSS。图片素材需要对方另行上传（文件里记录的是 /uploads/ 路径）。ID：{themeId}</p>
    </div>
  );
}

const TEMPLATE = `/* 本主题的自定义样式 —— 只在使用本主题时生效。
   可用的颜色变量：--bg --surface --ink --muted --faint --line --pane --accent --tint
   常用选择器：.hero  .post  .post-title  .site-header  .site-footer  .sidebar  .prose  .tag */

.post-title {
  letter-spacing: 0.02em;
}

.prose blockquote {
  border-left-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
`;

/* ---------------- rotation & egg triggers ---------------- */

function RotationPanel({ initial, themes }: { initial: ThemeRotation; themes: StoredTheme[] }) {
  const [r, setR] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(r) !== JSON.stringify(initial);
  const options: [string, string][] = [...PRESETS.map((p) => [p.id, p.name] as [string, string]), ...themes.map((t) => [`custom:${t.id}`, `${t.name}（自定义）`] as [string, string])];
  const select = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.currentTarget.value)}>{options.map(([v, n]) => <option value={v}>{n}</option>)}</select>
  );
  async function save() {
    setSaving(true);
    try {
      await api.put('/api/owner/settings/themeRotation', r);
      toast('轮换与彩蛋设置已保存');
      Object.assign(initial, r);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  }
  const togglePool = (id: string) => setR({ ...r, pool: r.pool.includes(id) ? r.pool.filter((x) => x !== id) : [...r.pool, id] });
  return (
    <div class="stack">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>主题轮换</h2>
            <p class="panel-sub">访客不能自己切换主题；由你决定网站在什么时候换上哪个主题。随机和轮换按“天”变化，同一天内所有页面保持一致，不会闪烁。</p>
          </div>
          <button type="button" class={`btn btn-primary ${saving ? 'is-loading' : ''}`} disabled={!dirty || saving} onClick={save}>保存</button>
        </div>
        <Segmented label="轮换方式" value={r.mode} onChange={(v) => setR({ ...r, mode: v })} options={[['fixed', '固定（不轮换）'], ['random', '每天随机'], ['rotate', '按天轮换'], ['schedule', '按时间 / 日期规则']]} />
        {(r.mode === 'random' || r.mode === 'rotate') && (
          <>
            <p class="hint" style="margin-top:12px">参与{r.mode === 'random' ? '随机' : '轮换'}的主题（不选则保持当前主题）：</p>
            <div class="ts-pool">
              {options.map(([v, n]) => <button type="button" class={`chip ${r.pool.includes(v) ? 'on' : ''}`} aria-pressed={r.pool.includes(v)} onClick={() => togglePool(v)}>{n}</button>)}
            </div>
            {r.mode === 'rotate' && <label class="field" style="margin-top:12px"><span class="label">每 {r.everyDays} 天换一个</span><input type="range" min={1} max={60} value={r.everyDays} onInput={(e) => setR({ ...r, everyDays: Number(e.currentTarget.value) })} /></label>}
          </>
        )}
        {r.mode === 'schedule' && (
          <div class="stack" style="margin-top:12px">
            <p class="hint">从上到下匹配第一条符合的规则；都不符合时用“外观与主题”里选的主题。</p>
            {r.rules.map((rule, i) => (
              <div class="ts-rule" key={i}>
                {select(rule.theme, (v) => setR({ ...r, rules: r.rules.map((x, j) => (j === i ? { ...x, theme: v } : x)) }))}
                <label>时段<input placeholder="22:00-06:00" value={rule.time ?? ''} pattern="\d{2}:\d{2}-\d{2}:\d{2}" onInput={(e) => setR({ ...r, rules: r.rules.map((x, j) => (j === i ? { ...x, time: e.currentTarget.value || undefined } : x)) })} /></label>
                <label>日期<input placeholder="12-20..01-05" value={rule.dates ?? ''} pattern="\d{2}-\d{2}\.\.\d{2}-\d{2}" onInput={(e) => setR({ ...r, rules: r.rules.map((x, j) => (j === i ? { ...x, dates: e.currentTarget.value || undefined } : x)) })} /></label>
                <div class="ts-weekdays">
                  {['日', '一', '二', '三', '四', '五', '六'].map((d, k) => {
                    const on = rule.weekdays?.includes(k);
                    return <button type="button" class={on ? 'on' : ''} onClick={() => setR({ ...r, rules: r.rules.map((x, j) => (j === i ? { ...x, weekdays: on ? (x.weekdays ?? []).filter((y) => y !== k) : [...(x.weekdays ?? []), k] } : x)) })}>{d}</button>;
                  })}
                </div>
                <IconButton icon="trash" label="删除规则" size="sm" variant="danger" onClick={() => setR({ ...r, rules: r.rules.filter((_, j) => j !== i) })} />
              </div>
            ))}
            <div class="row">
              <button type="button" class="btn btn-sm" onClick={() => setR({ ...r, rules: [...r.rules, { theme: 'starry', time: '22:00-06:00', label: '' }] })}><Icon name="plus" size={13} />夜间规则</button>
              <button type="button" class="btn btn-sm" onClick={() => setR({ ...r, rules: [...r.rules, { theme: 'sakura', dates: '03-20..04-15', label: '' }] })}><Icon name="plus" size={13} />樱花季</button>
              <button type="button" class="btn btn-sm" onClick={() => setR({ ...r, rules: [...r.rules, { theme: 'summer', dates: '07-01..08-31', label: '' }] })}><Icon name="plus" size={13} />暑假</button>
              <button type="button" class="btn btn-sm" onClick={() => setR({ ...r, rules: [...r.rules, { theme: 'ink', weekdays: [0, 6], label: '' }] })}><Icon name="plus" size={13} />周末</button>
            </div>
          </div>
        )}
      </section>
      <section class="panel">
        <h2>彩蛋：触发隐藏主题</h2>
        <p class="panel-sub">访客触发后，本次浏览切换到指定主题（页面底部会出现“恢复”按钮）。只有列在这里的主题会被接受。</p>
        <div class="stack" style="margin-top:12px">
          {r.eggs.map((egg, i) => (
            <div class="ts-rule" key={i}>
              <select value={egg.trigger} onChange={(e) => setR({ ...r, eggs: r.eggs.map((x, j) => (j === i ? { ...x, trigger: e.currentTarget.value as typeof egg.trigger } : x)) })}>
                <option value="konami">输入 Konami 秘籍（↑↑↓↓←→←→BA）</option>
                <option value="logo-7">连点网站标识 7 次</option>
                <option value="typed-word">在页面上打出一个词</option>
                <option value="idle-night">深夜静止 2 分钟</option>
                <option value="read-3">读完第 3 篇文章</option>
              </select>
              {egg.trigger === 'typed-word' && <input placeholder="例如 sakura" maxLength={20} value={egg.word ?? ''} onInput={(e) => setR({ ...r, eggs: r.eggs.map((x, j) => (j === i ? { ...x, word: e.currentTarget.value } : x)) })} />}
              <span>→</span>
              {select(egg.theme, (v) => setR({ ...r, eggs: r.eggs.map((x, j) => (j === i ? { ...x, theme: v } : x)) }))}
              <label>持续<select value={egg.minutes} onChange={(e) => setR({ ...r, eggs: r.eggs.map((x, j) => (j === i ? { ...x, minutes: Number(e.currentTarget.value) } : x)) })}>
                <option value={0}>到关闭浏览器</option><option value={10}>10 分钟</option><option value={30}>30 分钟</option><option value={120}>2 小时</option>
              </select></label>
              <IconButton icon="trash" label="删除" size="sm" variant="danger" onClick={() => setR({ ...r, eggs: r.eggs.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button type="button" class="btn btn-sm" disabled={r.eggs.length >= 10} onClick={() => setR({ ...r, eggs: [...r.eggs, { trigger: 'konami', theme: 'tenki', minutes: 0 }] })}><Icon name="plus" size={13} />添加彩蛋</button>
        </div>
      </section>
    </div>
  );
}

// Keep the schema import used (tree-shaken in production) so editors get its types.
void themeSchema;
