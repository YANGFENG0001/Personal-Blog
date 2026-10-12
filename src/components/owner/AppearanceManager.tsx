import { useEffect, useRef, useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import { BG_EFFECTS, EGG_SETS, PRESETS, getPreset, paletteVars, type ThemePreset } from '../../lib/themes';
import { resolveAppearance, cursorCss } from '../../lib/appearance';
import { SHAPE_LAYOUTS, dialHtml, effectiveLayout } from '../../lib/dial';
import { SCENES, sceneHtml, type SceneId } from '../../lib/scenes';
import { MASCOTS, mascotSvg } from '../../lib/mascot';
import '../../styles/scenes.css';
import '../../styles/scenes-anime.css';
import '../../styles/mascot.css';

/** Start either a scene effect or a generic particle effect on a preview canvas. */
async function startPreviewEffect(effect: string, canvas: HTMLCanvasElement, intensity: 'low' | 'medium' | 'high', animate: boolean) {
  const scene = await import('../../lib/scene-effects');
  if (scene.isSceneEffect(effect)) return scene.startSceneEffect(effect, { intensity, animate, canvas });
  const m = await import('../../lib/bg-effects');
  return m.startBackground(effect, { intensity, animate, canvas });
}
import '../../styles/dial.css';
type AS = Settings['appearance'];
import type { Settings } from '../../server/seed';
import { Icon, Segmented, Switch } from './ui';

interface Props {
  appearance: Settings['appearance'];
  dial: Settings['dial'];
  previewBall: Settings['previewBall'];
  easter: Settings['easter'];
  defaults: { appearance: Settings['appearance']; dial: Settings['dial']; previewBall: Settings['previewBall']; easter: Settings['easter'] };
  uploads: { filename: string; originalName: string }[];
}

type Tab = 'theme' | 'background' | 'motion' | 'dial' | 'ball' | 'eggs';
const TABS: [Tab, string, string][] = [
  ['theme', '主题与配色', 'palette'],
  ['background', '背景与光标', 'image'],
  ['motion', '动效与排版', 'sparkle'],
  ['dial', '分站切换器', 'compass'],
  ['ball', '预览悬浮球', 'eye'],
  ['eggs', '彩蛋', 'star'],
];

/** Apply appearance to the current page root so changes preview instantly. */
function applyLive(a: AS) {
  const root = document.documentElement;
  const look = resolveAppearance(a, (root.dataset.theme as 'light' | 'dark' | 'auto') ?? 'auto');
  for (const [k, v] of Object.entries(look.attrs)) if (k !== 'data-theme' && k !== 'data-bg' && k !== 'data-cursor') root.setAttribute(k, v);
  // The workspace keeps its plain background; only palette variables are previewed here.
  root.setAttribute('style', look.style.split(';').filter((d) => d.startsWith('--l-') || d.startsWith('--d-')).join(';'));
}

export default function AppearanceManager(props: Props) {
  const [tab, setTab] = useState<Tab>('theme');
  const [a, setA] = useState(props.appearance);
  const [dial, setDial] = useState(props.dial);
  const [ball, setBall] = useState(props.previewBall);
  const [egg, setEgg] = useState(props.easter);
  const [saving, setSaving] = useState(false);
  const initial = useRef(JSON.stringify([props.appearance, props.dial, props.previewBall, props.easter]));
  const dirty = JSON.stringify([a, dial, ball, egg]) !== initial.current;

  useEffect(() => applyLive(a), [a]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    addEventListener('beforeunload', h);
    return () => removeEventListener('beforeunload', h);
  }, [dirty]);

  const setBg = (patch: Partial<Settings['appearance']['background']>) => setA({ ...a, background: { ...a.background, ...patch } });

  async function save() {
    setSaving(true);
    try {
      await api.put('/api/owner/settings/appearance', a);
      await api.put('/api/owner/settings/dial', dial);
      await api.put('/api/owner/settings/previewBall', ball);
      await api.put('/api/owner/settings/easter', egg);
      initial.current = JSON.stringify([a, dial, ball, egg]);
      toast('外观已保存，公开网站已更新');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    const d = props.defaults;
    setA({ ...d.appearance, preset: a.preset });
    setDial(d.dial);
    setBall(d.previewBall);
    setEgg(d.easter);
    toast('已恢复默认值（尚未保存）');
  }

  return (
    <div class="ap">
      <div class="ap-bar">
        <nav class="ap-tabs" role="tablist" aria-label="外观设置分组">
          {TABS.map(([id, label, icon]) => (
            <button type="button" role="tab" aria-selected={tab === id} class={`ap-tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>
              <Icon name={icon} size={15} />{label}
            </button>
          ))}
        </nav>
        <div class="row">
          {dirty && <span class="ap-dirty"><span />未保存</span>}
          <button class="btn btn-ghost" type="button" onClick={reset}>恢复默认</button>
          <a class="btn" href="/" target="_blank" rel="noopener">查看网站<Icon name="external" size={13} /></a>
          <button class={`btn btn-primary ${saving ? 'is-loading' : ''}`} type="button" disabled={!dirty} onClick={save}>保存</button>
        </div>
      </div>

      {tab === 'theme' && <ThemeTab a={a} setA={setA} uploads={props.uploads} />}
      {tab === 'background' && <BackgroundTab a={a} setA={setA} setBg={setBg} uploads={props.uploads} />}
      {tab === 'motion' && <MotionTab a={a} setA={setA} />}
      {tab === 'dial' && <DialTab dial={dial} setDial={setDial} />}
      {tab === 'ball' && <BallTab ball={ball} setBall={setBall} />}
      {tab === 'eggs' && <EggsTab egg={egg} setEgg={setEgg} preset={getPreset(a.preset)} />}
    </div>
  );
}

/* ---------------- Theme ---------------- */

function PresetCard({ p, active, onPick }: { p: ThemePreset; active: boolean; onPick: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!p.background.effect || !canvas.current) return;
    let stop: (() => void) | undefined;
    let dead = false;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    void startPreviewEffect(p.background.effect, canvas.current, 'low', !reduced).then((h) => (dead ? h.stop() : (stop = h.stop)));
    return () => { dead = true; stop?.(); };
  }, [p.id]);
  const style = (pal: ThemePreset['light']) => Object.entries(paletteVars(pal, null)).map(([k, v]) => `${k}:${v}`).join(';');
  return (
    <button type="button" class={`preset ${active ? 'on' : ''}`} aria-pressed={active} onClick={onPick} data-preset-id={p.id}>
      <span class="preset-thumbs">
        {(['light', 'dark'] as const).map((mode) => (
          <span class={`mini mini-${mode} bg-${p.background.type}`} style={`${style(p[mode])};color-scheme:${mode}`}>
            {p.background.scene && <span class="mini-scene" dangerouslySetInnerHTML={{ __html: sceneHtml(p.background.scene as SceneId) }} />}
            {mode === 'light' && p.background.effect && <canvas ref={canvas} class="mini-canvas" aria-hidden="true" />}
            {p.mascot && <span class="mini-mascot" dangerouslySetInnerHTML={{ __html: mascotSvg(p.mascot) }} />}
            <span class="mini-head"><i /><b /></span>
            <span class="mini-title" style={`font-family:var(${p.font === 'sans' ? '--sans' : '--serif'})`}>Aa 标题</span>
            <span class="mini-line" /><span class="mini-line short" />
            <span class="mini-btn" style={`border-radius:${p.radius === 'sharp' ? 0 : p.radius === 'round' ? 8 : 3}px`} />
          </span>
        ))}
      </span>
      <span class="preset-meta">
        <span class="preset-name">{p.name}{active && <Icon name="check" size={13} />}</span>
        <span class="preset-desc">{p.description}</span>
        <span class="preset-swatches">{[p.light.accent, p.light.bg, p.dark.accent, p.dark.bg].map((c) => <i style={`background:${c}`} />)}</span>
      </span>
    </button>
  );
}

const ACCENTS = ['#315b50', '#4f6b2f', '#1f6e8c', '#496c96', '#4450a8', '#6b4fa0', '#b23c6f', '#a23b30', '#99694b', '#8a6a1f', '#1c1c1c'];

function ThemeTab({ a, setA, uploads }: { a: AS; setA: (a: AS) => void; uploads: { filename: string; originalName: string }[] }) {
  return (
    <div class="stack">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>主题预设</h2>
            <p class="panel-sub">每套预设包含日间与夜间配色、字体、圆角、默认背景、主题光标和配套彩蛋。选择后整个页面会立即预览。</p>
          </div>
        </div>
        <div class="presets">
          {PRESETS.map((p) => <PresetCard key={p.id} p={p} active={a.preset === p.id} onPick={() => setA({ ...a, preset: p.id })} />)}
        </div>
      </section>
      <section class="panel">
        <h2>配色</h2>
        <div class="grid-2" style="margin-top:12px">
          <div class="field">
            <span class="label">默认明暗（游客可以自行切换）</span>
            <Segmented label="默认明暗" value={a.theme} onChange={(v) => setA({ ...a, theme: v })} options={[['system', '跟随系统'], ['light', '日间'], ['dark', '夜间']]} />
          </div>
          <div class="field">
            <span class="label">强调色</span>
            <div class="accents" role="radiogroup" aria-label="强调色">
              <button type="button" role="radio" aria-checked={!a.customAccent} class={`accent-opt auto ${!a.customAccent ? 'on' : ''}`} onClick={() => setA({ ...a, customAccent: '' })} title="使用主题自带">
                <span>主题</span>
              </button>
              {ACCENTS.map((c) => (
                <button type="button" role="radio" aria-checked={a.customAccent === c} aria-label={c} class={`accent-opt ${a.customAccent === c ? 'on' : ''}`} style={`--c:${c}`} onClick={() => setA({ ...a, customAccent: c })} />
              ))}
              <label class="accent-custom" title="自定义颜色">
                <input type="color" value={a.customAccent || getPreset(a.preset).light.accent} onInput={(e) => setA({ ...a, customAccent: e.currentTarget.value })} aria-label="自定义强调色" />
              </label>
            </div>
            <p class="hint">夜间模式会自动使用同色系的浅色变体以保证对比度；自定义颜色在两种模式下保持一致。</p>
          </div>
        </div>
      </section>
      <MascotPanel a={a} setA={setA} uploads={uploads} />
    </div>
  );
}

function MascotPanel({ a, setA, uploads }: { a: AS; setA: (a: AS) => void; uploads: { filename: string; originalName: string }[] }) {
  const m = a.mascot;
  const set = (patch: Partial<AS['mascot']>) => setA({ ...a, mascot: { ...m, ...patch } });
  const preset = getPreset(a.preset);
  const shown = m.mode === 'on' || (m.mode === 'preset' && !!preset.mascot);
  const character = m.character === 'preset' ? (preset.mascot ?? 'haru') : m.character;
  const withMascot = PRESETS.filter((p) => p.mascot).map((p) => `“${p.name}”`).join('、');
  const images = uploads.filter((u) => /\.(png|webp|gif|svg)$/i.test(u.filename));
  return (
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>看板娘</h2>
          <p class="panel-sub">页面角落的小角色：点击打招呼，眼睛会跟着鼠标，可以拖到屏幕任意位置（访客各自记住位置，双击回到角落）。全部为本站原创形象；也可以换成你自己的角色立绘（建议透明背景 PNG / WebP）。宽度小于 900px 的屏幕和打印时自动隐藏。</p>
        </div>
      </div>
      <div class="mascot-cfg">
        <div class={`mascot-stage ${shown ? '' : 'is-off'}`} data-pos={m.position}>
          <div class="mascot-demo" data-size={m.size} data-kind={m.imageUrl ? 'image' : character === 'chibi' ? 'chibi' : 'anime'}>
            {m.imageUrl ? <img src={m.imageUrl} alt="" /> : <span dangerouslySetInnerHTML={{ __html: mascotSvg(character) }} />}
          </div>
          {!shown && <span class="mascot-off">当前主题下不显示</span>}
        </div>
        <div class="stack" style="gap:14px">
          <div class="field">
            <span class="label">显示</span>
            <Segmented label="看板娘显示" value={m.mode} onChange={(v) => set({ mode: v })} options={[['preset', '跟随主题'], ['on', '始终显示'], ['off', '关闭']]} />
            {m.mode === 'preset' && <p class="hint">自带看板娘的主题：{withMascot}。</p>}
          </div>
          <div class="field">
            <span class="label">角色</span>
            <div class="mascot-picks" role="radiogroup" aria-label="角色">
              <button type="button" role="radio" aria-checked={m.character === 'preset'} class={`mascot-pick ${m.character === 'preset' ? 'on' : ''}`} onClick={() => set({ character: 'preset' })}>
                <span class="mascot-pick-art is-auto"><Icon name="palette" size={18} /></span>
                <strong>跟随主题</strong><small>由当前主题决定</small>
              </button>
              {MASCOTS.map((c) => (
                <button type="button" role="radio" aria-checked={m.character === c.id} class={`mascot-pick ${m.character === c.id ? 'on' : ''}`} onClick={() => set({ character: c.id })}>
                  <span class="mascot-pick-art" dangerouslySetInnerHTML={{ __html: mascotSvg(c.id) }} />
                  <strong>{c.name}</strong><small>{c.desc}</small>
                </button>
              ))}
            </div>
          </div>
          <div class="grid-2">
            <div class="field">
              <span class="label">默认位置</span>
              <Segmented label="位置" value={m.position} onChange={(v) => set({ position: v })} options={[['right', '右下'], ['left', '左下']]} />
            </div>
            <div class="field">
              <span class="label">大小</span>
              <Segmented label="大小" value={m.size} onChange={(v) => set({ size: v })} options={[['sm', '小'], ['md', '中'], ['lg', '大']]} />
            </div>
          </div>
          <Switch checked={m.draggable} onChange={(v) => set({ draggable: v })} label="允许访客拖动看板娘（键盘：聚焦后 Alt + 方向键；双击回到角落）" />
          <div class="field">
            <span class="label">自定义立绘（可选，会替换上面的角色）</span>
            <div class="row">
              <input value={m.imageUrl} placeholder="留空使用原创角色；/uploads/… 或 https://…" onInput={(e) => set({ imageUrl: e.currentTarget.value.trim() })} />
              {m.imageUrl && <button type="button" class="btn btn-ghost" onClick={() => set({ imageUrl: '' })}>恢复原创</button>}
            </div>
            {images.length > 0 && (
              <div class="bg-uploads">
                {images.slice(0, 12).map((u) => (
                  <button type="button" class={`bg-up ${m.imageUrl === `/uploads/${u.filename}` ? 'on' : ''}`} onClick={() => set({ imageUrl: `/uploads/${u.filename}` })} title={u.originalName}>
                    <img src={`/uploads/${u.filename}`} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            <p class="hint">在“文件”页上传图片后可在此选择。使用动漫角色等他人作品时，请确认你拥有相应授权。</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Background & cursor ---------------- */

const BG_TYPES: [Settings['appearance']['background']['type'], string][] = [
  ['preset', '跟随主题'], ['scene', '意境场景'], ['none', '纯净'], ['solid', '纯色'], ['gradient', '渐变'], ['paper', '纸纹'], ['dots', '点阵'], ['grid', '网格'], ['animated', '动态'], ['image', '自定义图片'],
];

function BackgroundTab({ a, setA, setBg, uploads }: {
  a: AS; setA: (a: AS) => void; setBg: (p: Partial<AS['background']>) => void;
  uploads: { filename: string; originalName: string }[];
}) {
  const b = a.background;
  const preview = useRef<HTMLCanvasElement>(null);
  const look = resolveAppearance(a, 'light');
  const effect = look.bg.effect;
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (!effect || !preview.current) return;
    let stop: (() => void) | undefined;
    let dead = false;
    void startPreviewEffect(effect, preview.current, b.intensity, true).then((h) => (dead ? h.stop() : (stop = h.stop)));
    return () => { dead = true; stop?.(); };
  }, [effect, b.intensity, look.bg.scene]);

  return (
    <div class="stack">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>页面背景</h2>
            <p class="panel-sub">只作用于公开网站。正文区域始终保留不透明底色，保证长时间阅读的对比度。</p>
          </div>
        </div>
        <div class="bg-layout">
          <div>
            <div class="bg-types" role="radiogroup" aria-label="背景类型">
              {BG_TYPES.map(([v, l]) => (
                <button type="button" role="radio" aria-checked={b.type === v} class={`bg-type ${b.type === v ? 'on' : ''}`} data-bg={v} onClick={() => setBg({ type: v })}>
                  <span class="bg-swatch" data-kind={v} />{l}
                </button>
              ))}
            </div>
            {b.type === 'solid' && (
              <div class="field row" style="margin-top:16px"><label>背景颜色</label><input type="color" value={b.color} onInput={(e) => setBg({ color: e.currentTarget.value })} /></div>
            )}
            {b.type === 'gradient' && (
              <div class="row" style="margin-top:16px;gap:16px">
                <label class="row small">起始 <input type="color" value={b.gradientFrom} onInput={(e) => setBg({ gradientFrom: e.currentTarget.value })} /></label>
                <label class="row small">结束 <input type="color" value={b.gradientTo} onInput={(e) => setBg({ gradientTo: e.currentTarget.value })} /></label>
              </div>
            )}
            {(b.type === 'solid' || b.type === 'gradient') && <p class="hint" style="margin-top:8px">纯色与渐变用于日间模式；夜间模式使用主题的深色背景。</p>}
            {b.type === 'scene' && (
              <div class="field" style="margin-top:16px">
                <span class="label">场景</span>
                <div class="scene-picks" role="radiogroup" aria-label="场景">
                  {SCENES.map((sc) => (
                    <button type="button" role="radio" aria-checked={b.scene === sc.id} class={`scene-pick ${b.scene === sc.id ? 'on' : ''}`} onClick={() => setBg({ scene: sc.id })}>
                      <span class="scene-thumb" dangerouslySetInnerHTML={{ __html: sceneHtml(sc.id) }} />
                      <strong>{sc.name}</strong>
                      <small>{sc.desc}</small>
                    </button>
                  ))}
                </div>
                <p class="hint" style="margin-top:8px">场景由静态矢量分层绘制，只对少量图层做轻微位移动画；“动效关闭”或系统减少动态时保持静止。手机端不加载粒子效果。</p>
              </div>
            )}
            {b.type === 'animated' && (
              <div class="field" style="margin-top:16px">
                <span class="label">动态效果</span>
                <div class="chips">
                  {BG_EFFECTS.map((e) => (
                    <button type="button" class={`chip ${b.effect === e.id ? 'on' : ''}`} aria-pressed={b.effect === e.id} onClick={() => setBg({ effect: e.id })}>{e.name}</button>
                  ))}
                </div>
              </div>
            )}
            {(b.type === 'animated' || b.type === 'scene' || (b.type === 'preset' && effect)) && (
              <div class="field" style="margin-top:12px;max-width:320px">
                <span class="label">粒子密度</span>
                <Segmented label="粒子密度" value={b.intensity} onChange={(v) => setBg({ intensity: v })} options={[['low', '稀疏'], ['medium', '适中'], ['high', '丰富']]} />
              </div>
            )}
            {b.type === 'image' && (
              <div style="margin-top:16px" class="stack-sm">
                <div class="field">
                  <label>图片地址</label>
                  <input value={b.imageUrl} placeholder="/uploads/… 或 https://…" onInput={(e) => setBg({ imageUrl: e.currentTarget.value })} />
                </div>
                {uploads.length > 0 && (
                  <div class="bg-uploads">
                    {uploads.slice(0, 12).map((u) => (
                      <button type="button" class={`bg-up ${b.imageUrl === `/uploads/${u.filename}` ? 'on' : ''}`} onClick={() => setBg({ imageUrl: `/uploads/${u.filename}` })} title={u.originalName}>
                        <img src={`/uploads/${u.filename}`} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
                <p class="hint">也可以在“设置 → 图片文件”中上传新图片。</p>
                <div class="grid-2">
                  <div class="field"><label>遮罩浓度 {Math.round(b.overlay * 100)}%</label><input type="range" min={0} max={1} step={0.02} value={b.overlay} onInput={(e) => setBg({ overlay: Number(e.currentTarget.value) })} /></div>
                  <div class="field"><label>模糊 {b.blur}px</label><input type="range" min={0} max={20} step={1} value={b.blur} onInput={(e) => setBg({ blur: Number(e.currentTarget.value) })} /></div>
                </div>
                <Switch checked={b.fixed} onChange={(v) => setBg({ fixed: v })} label="固定背景（滚动时不移动）" />
              </div>
            )}
          </div>
          <div class={`bg-preview ${look.bg.scene ? 'has-scene' : ''}`} data-bg={look.attrs['data-bg']} style={`${look.style.split(';').filter((d) => d.startsWith('--page')).join(';')};color-scheme:${dark ? 'dark' : 'light'}`}>
            <div class="page-bg" />
            {look.bg.scene && <div class="bgp-scene" dangerouslySetInnerHTML={{ __html: sceneHtml(look.bg.scene as SceneId) }} />}
            <button type="button" class="bg-mode" onClick={() => setDark(!dark)} aria-label="切换预览的日夜">{dark ? '夜' : '日'}</button>
            {effect && <canvas ref={preview} class="mini-canvas" aria-hidden="true" />}
            <div class="bg-preview-card">
              <strong>阅读区域</strong>
              <span />
              <span />
              <span class="short" />
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <h2>鼠标指针</h2>
        <p class="panel-sub">只在公开网站和带鼠标的设备上生效，触屏设备不受影响。</p>
        <div class="cursors" role="radiogroup" aria-label="鼠标指针">
          {([['system', '系统默认'], ['dot', '圆点'], ['ring', '圆环'], ['theme', '主题光标']] as const).map(([v, l]) => {
            const demo = cursorCss({ ...a, cursor: v });
            return (
              <button type="button" role="radio" aria-checked={a.cursor === v} class={`cursor-opt ${a.cursor === v ? 'on' : ''}`} onClick={() => setA({ ...a, cursor: v })} style={demo ? `cursor:${demo}` : undefined}>
                <span class="cursor-demo" data-c={v}>
                  {v === 'theme' ? <svg viewBox="0 0 24 24" width="22" height="22" dangerouslySetInnerHTML={{ __html: getPreset(a.preset).cursorGlyph }} /> : v === 'system' ? <svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 3l14 8-6 1.5L10 19z" fill="currentColor" /></svg> : <i />}
                </span>
                {l}
              </button>
            );
          })}
        </div>
        <div style="margin-top:14px">
          <Switch checked={a.cursorTrail} onChange={(v) => setA({ ...a, cursorTrail: v })} label="鼠标拖尾光点（动效为“关闭”时不显示）" />
        </div>
        <p class="hint" style="margin-top:8px">将鼠标移到上方选项上可以直接试用对应指针。</p>
      </section>
    </div>
  );
}

/* ---------------- Motion & typography ---------------- */

function MotionTab({ a, setA }: { a: AS; setA: (a: AS) => void }) {
  const levels: [AS['motion'], string, string][] = [
    ['off', '关闭', '没有任何过渡动画，适合偏好静态界面。'],
    ['minimal', '轻微', '保留必要的状态反馈，动画更短更轻。'],
    ['normal', '标准', '页面转场、悬停反馈、轮盘展开等常规动效。'],
    ['rich', '丰富', '在标准之上增加滚动渐显、卡片 3D 微倾与光泽、按钮涟漪和更强的分站转场。'],
  ];
  return (
    <div class="stack">
      <section class="panel">
        <h2>动效强度</h2>
        <p class="panel-sub">访客系统开启“减少动态效果”时，始终以“关闭”处理。</p>
        <div class="levels" role="radiogroup" aria-label="动效强度">
          {levels.map(([v, l, d], i) => (
            <button type="button" role="radio" aria-checked={a.motion === v} class={`level ${a.motion === v ? 'on' : ''}`} onClick={() => setA({ ...a, motion: v })}>
              <span class="level-bars" aria-hidden="true">{[0, 1, 2].map((k) => <i class={k < i ? 'f' : ''} />)}</span>
              <strong>{l}</strong>
              <span>{d}</span>
            </button>
          ))}
        </div>
        <div class="row" style="gap:20px;margin-top:16px">
          <Switch checked={a.iconMotion} onChange={(v) => setA({ ...a, iconMotion: v })} label="动效图标（悬停时描边重绘）" />
          <Switch checked={a.cardMotion} onChange={(v) => setA({ ...a, cardMotion: v })} label="卡片动效（悬停抬升；“丰富”档下 3D 微倾）" />
        </div>
      </section>
      <section class="panel">
        <h2>排版</h2>
        <div class="grid-3" style="margin-top:12px">
          <div class="field">
            <span class="label">密度</span>
            <Segmented label="密度" value={a.density} onChange={(v) => setA({ ...a, density: v })} options={[['compact', '紧凑'], ['comfortable', '舒展'], ['spacious', '宽松']]} />
            <p class="hint">影响正文字号、行高、列表间距、卡片内边距和顶栏高度。</p>
          </div>
          <div class="field">
            <span class="label">字体搭配</span>
            <Segmented label="字体搭配" value={a.font} onChange={(v) => setA({ ...a, font: v })} options={[['preset', '跟随主题'], ['serif-sans', '衬线标题'], ['sans', '全无衬线'], ['serif', '全衬线']]} />
          </div>
          <div class="field">
            <span class="label">圆角</span>
            <Segmented label="圆角" value={a.radius} onChange={(v) => setA({ ...a, radius: v })} options={[['preset', '跟随主题'], ['sharp', '直角'], ['soft', '柔和'], ['round', '圆润']]} />
          </div>
        </div>
        <div class="type-sample">
          <h3>样张 · 一处安静的写作空间</h3>
          <p>记录理解的过程，也保留尚未得到答案的问题。The quick brown fox jumps over the lazy dog. <code>attention(Q, K, V)</code></p>
          <div class="row"><button type="button" class="btn btn-primary btn-sm">主要按钮</button><button type="button" class="btn btn-sm">次要按钮</button><span class="pill pill-accent">标签</span></div>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Dial ---------------- */

const SHAPES: { id: Settings['dial']['shape']; name: string; desc: string }[] = [
  { id: 'card', name: '圆角卡片', desc: '贴边展开的面板，适合任何布局' },
  { id: 'capsule', name: '胶囊', desc: '整体悬浮的竖向胶囊，内部条目同为胶囊' },
  { id: 'half', name: '半圆', desc: '贴边半圆，分站沿弧线扇形展开' },
  { id: 'leaf', name: '叶形', desc: '对角圆角，柔和自然' },
  { id: 'glass', name: '磨砂玻璃', desc: '半透明毛玻璃，透出背景' },
];
const LAYOUT_NAMES: Record<Settings['dial']['layout'], string> = { orbit: '环形轮盘', arc: '弧形', list: '纯列表', rail: '图标条' };

function DialTab({ dial, setDial }: { dial: Settings['dial']; setDial: (d: Settings['dial']) => void }) {
  const set = (p: Partial<Settings['dial']>) => setDial({ ...dial, ...p });
  const layouts = SHAPE_LAYOUTS[dial.shape];
  const eff = effectiveLayout(dial);
  const graphic = eff === 'orbit' || eff === 'arc';
  const pickShape = (shape: Settings['dial']['shape']) => {
    const allowed = SHAPE_LAYOUTS[shape];
    set({ shape, layout: allowed.length && !allowed.includes(dial.layout) ? allowed[0]! : dial.layout });
  };
  return (
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>分站切换器</h2>
          <p class="panel-sub">先选整体造型，再选该造型下的布局。造型决定整个切换器的结构，而不只是圆角；移动端统一显示为底部抽屉。</p>
        </div>
      </div>
      <div class="dial-cfg">
        <div class="stack-sm">
          <div class="field">
            <span class="label">整体造型</span>
            <div class="shape-cards" role="radiogroup" aria-label="整体造型">
              {SHAPES.map((s) => (
                <button type="button" role="radio" aria-checked={dial.shape === s.id} class={`shape-card ${dial.shape === s.id ? 'on' : ''}`} onClick={() => pickShape(s.id)}>
                  <span class={`shape-glyph g-${s.id}`} aria-hidden="true"><i /></span>
                  <strong>{s.name}</strong>
                  <small>{s.desc}</small>
                </button>
              ))}
            </div>
          </div>
          {layouts.length > 0 ? (
            <div class="field"><span class="label">布局</span>
              <Segmented label="布局" value={eff as Settings['dial']['layout']} onChange={(v) => set({ layout: v })} options={layouts.map((l) => [l, LAYOUT_NAMES[l]] as [Settings['dial']['layout'], string])} />
            </div>
          ) : (
            <p class="hint">{dial.shape === 'capsule' ? '胶囊造型自带竖向布局：顶部是首页标识，下面是一列胶囊形分站。' : '半圆造型自带扇形布局：分站沿弧线排列，悬停时圆心显示分站名称。'}</p>
          )}
          {(dial.shape === 'card' || dial.shape === 'leaf' || dial.shape === 'glass') && (
            <div class="field"><span class="label">收起时的把手</span>
              <Segmented label="把手" value={dial.handle} onChange={(v) => set({ handle: v })} options={[['tab', '标签'], ['dot', '圆点'], ['line', '细线']]} />
            </div>
          )}
          <div class="field"><label>垂直位置 {dial.offsetY}%</label>
            <input type="range" min={15} max={85} value={dial.offsetY} onInput={(e) => set({ offsetY: Number(e.currentTarget.value) })} />
          </div>
          <div class="field"><span class="label">显示内容</span>
            <div class="dial-toggles">
              {eff !== 'fan' && <Switch checked={dial.showTitle} onChange={(v) => set({ showTitle: v })} label={eff === 'rail' || eff === 'capsule' ? '分站名称' : '“SITES · 分站”标题'} />}
              {graphic && <Switch checked={dial.showOrbit} onChange={(v) => set({ showOrbit: v, showList: v ? dial.showList : true })} label="图形（轮盘/弧形）" />}
              {graphic && <Switch checked={dial.showList} onChange={(v) => set({ showList: v, showOrbit: v ? dial.showOrbit : true })} label="名称列表" />}
              {(eff === 'orbit' || eff === 'arc' || eff === 'list' || eff === 'capsule') && <Switch checked={dial.showEnglish} onChange={(v) => set({ showEnglish: v })} label="英文副名" />}
              {(eff === 'orbit' || eff === 'arc' || eff === 'list') && <Switch checked={dial.showHint} onChange={(v) => set({ showHint: v })} label="键盘提示" />}
            </div>
          </div>
        </div>
        <DialPreview dial={dial} />
      </div>
    </section>
  );
}

const DEMO_SITES = [
  { id: 'a', slug: 'learning', name: '学习', enName: 'LEARNING', icon: 'book' },
  { id: 'b', slug: 'research', name: '研究', enName: 'RESEARCH', icon: 'atom' },
  { id: 'c', slug: 'tech', name: '技术', enName: 'ENGINEERING', icon: 'code' },
  { id: 'd', slug: 'life', name: '日常', enName: 'JOURNAL', icon: 'pen' },
  { id: 'e', slug: 'resources', name: '资源', enName: 'RESOURCES', icon: 'archive' },
];

/** Renders the exact public markup (shared dialHtml) in open and closed states. */
function DialPreview({ dial }: { dial: Settings['dial'] }) {
  return (
    <div class="dial-previews">
      <div class="dial-stage">
        <span class="stage-cap">展开</span>
        <div dangerouslySetInnerHTML={{ __html: dialHtml(dial, DEMO_SITES, 'b', 'F', { preview: 'open' }) }} />
      </div>
      <div class="dial-stage dial-stage-sm">
        <span class="stage-cap">收起</span>
        <div dangerouslySetInnerHTML={{ __html: dialHtml(dial, DEMO_SITES, 'b', 'F', { preview: 'closed' }) }} />
      </div>
    </div>
  );
}

/* ---------------- Preview ball ---------------- */

function BallTab({ ball, setBall }: { ball: Settings['previewBall']; setBall: (b: Settings['previewBall']) => void }) {
  const set = (p: Partial<Settings['previewBall']>) => setBall({ ...ball, ...p });
  return (
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>游客预览悬浮球</h2>
          <p class="panel-sub">只有已登录的站主能看到。在工作台点击它会打开游客视角的网站，在网站上点击则返回工作台。</p>
        </div>
        <Switch checked={ball.enabled} onChange={(v) => set({ enabled: v })} label="启用" />
      </div>
      <div class="ball-cfg">
        <div class="stack-sm">
          <div class="field"><span class="label">形状</span>
            <Segmented label="形状" value={ball.shape} onChange={(v) => set({ shape: v })} options={[['circle', '圆形'], ['squircle', '圆角方形'], ['pill', '胶囊'], ['hexagon', '六边形'], ['leaf', '叶形']]} />
          </div>
          <div class="field"><span class="label">样式</span>
            <Segmented label="样式" value={ball.style} onChange={(v) => set({ style: v })} options={[['solid', '实心'], ['accent', '强调色'], ['glass', '磨砂玻璃'], ['outline', '描边']]} />
          </div>
          <div class="field"><span class="label">大小</span>
            <Segmented label="大小" value={ball.size} onChange={(v) => set({ size: v })} options={[['sm', '小'], ['md', '中'], ['lg', '大']]} />
          </div>
          <div class="field"><span class="label">位置</span>
            <Segmented label="位置" value={ball.position} onChange={(v) => set({ position: v })} options={[['right', '右下'], ['left', '左下']]} />
          </div>
          <div class="dial-toggles">
            <Switch checked={ball.showLabel} onChange={(v) => set({ showLabel: v })} label="悬停时展开文字" />
            <Switch checked={ball.pulse} onChange={(v) => set({ pulse: v })} label="脉冲光圈" />
          </div>
          {ball.shape === 'hexagon' && <p class="hint">六边形不展开文字，也不显示光圈。</p>}
        </div>
        <div class="ball-stage">
          <span class="ball-hint">把鼠标移到悬浮球上试试</span>
          {(['owner', 'visitor'] as const).map((mode, i) => (
            <a
              class="pball"
              href="#"
              onClick={(e) => e.preventDefault()}
              data-pos={ball.position}
              data-mode={mode}
              data-shape={ball.shape}
              data-style={ball.style}
              data-size={ball.size}
              data-label={ball.showLabel ? 'on' : 'off'}
              data-pulse={ball.pulse ? 'on' : 'off'}
              style={`position:absolute;bottom:${i === 0 ? 96 : 24}px;opacity:${ball.enabled ? 1 : 0.35}`}
              aria-label={mode === 'owner' ? '工作台中的样子' : '网站上的样子'}
            >
              <span class="pball-core"><Icon name={mode === 'owner' ? 'eye' : 'edit'} size={20} /></span>
              <span class="pball-label">{mode === 'owner' ? '游客预览' : '预览中 · 返回工作台'}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Eggs ---------------- */

const TRIGGERS: [keyof Settings['easter']['triggers'], string, string][] = [
  ['logo', '三击标识', '连续点击页面左上角的品牌标识三次，绽放一组主题粒子。'],
  ['konami', 'Konami 秘籍', '依次按下 ↑↑↓↓←→←→BA，主题粒子从天而降。'],
  ['hello', '打招呼', '在页面任意处键入 hello，头像会挥手问好。'],
  ['avatar', '头像翻转', '快速点击头像 5 次，头像翻转并绽放粒子。'],
  ['readEnd', '读完文章', '滚动到文章末尾时放一朵小烟花。'],
  ['lateNight', '深夜提醒', '23:00 至 5:00 访问时，每晚提醒一次早点休息。'],
  ['festival', '节日彩蛋', '新年、π 日、程序员节等日子出现节日问候与主题粒子雨。'],
  ['notFound', '404 小游戏', '在 404 页点击数字，它们会散开再复原。'],
  ['console', '控制台签名', '打开浏览器开发者工具时，控制台里留一行问候。'],
];

function EggsTab({ egg, setEgg, preset }: { egg: Settings['easter']; setEgg: (e: Settings['easter']) => void; preset: ThemePreset }) {
  const [busy, setBusy] = useState(false);
  const effective = egg.set === 'follow-theme' ? preset.eggSet : egg.set;
  async function demo(kind: 'burst' | 'rain' | 'firework', e?: MouseEvent) {
    if (busy) return;
    setBusy(true);
    const m = await import('../../lib/eggs');
    // The workspace uses this preset's particle colors for the preview.
    document.body.dataset.fx = preset.fx.join(',');
    const r = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect();
    m.play(kind, effective as never, r ? { x: r.left + r.width / 2, y: r.top } : undefined);
    setTimeout(() => setBusy(false), 600);
  }
  return (
    <div class="stack">
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2>彩蛋</h2>
            <p class="panel-sub">一些克制的小惊喜，不会打断阅读。动效为“关闭”或访客开启“减少动态效果”时，只保留文字提示。</p>
          </div>
          <Switch checked={egg.enabled} onChange={(v) => setEgg({ ...egg, enabled: v })} label="启用彩蛋" />
        </div>
        <div class="field">
          <span class="label">粒子效果组</span>
          <div class="egg-sets" role="radiogroup" aria-label="彩蛋效果组">
            <button type="button" role="radio" aria-checked={egg.set === 'follow-theme'} class={`egg-set ${egg.set === 'follow-theme' ? 'on' : ''}`} onClick={() => setEgg({ ...egg, set: 'follow-theme' })}>
              <strong>跟随主题</strong><span>当前：{EGG_SETS.find((s) => s.id === preset.eggSet)?.name}</span>
            </button>
            {EGG_SETS.map((s) => (
              <button type="button" role="radio" aria-checked={egg.set === s.id} class={`egg-set ${egg.set === s.id ? 'on' : ''}`} onClick={() => setEgg({ ...egg, set: s.id })}>
                <strong>{s.name}</strong><span>{PRESETS.find((p) => p.eggSet === s.id)?.name}主题</span>
              </button>
            ))}
          </div>
        </div>
        <div class="row">
          <span class="faint small">预览效果：</span>
          <button class="btn btn-sm" type="button" onClick={(e) => demo('burst', e as unknown as MouseEvent)}><Icon name="sparkle" size={13} />粒子绽放</button>
          <button class="btn btn-sm" type="button" onClick={() => demo('rain')}>粒子雨</button>
          <button class="btn btn-sm" type="button" onClick={() => demo('firework')}>小烟花</button>
        </div>
      </section>
      <section class="panel">
        <h2>触发方式</h2>
        <ul class="triggers">
          {TRIGGERS.map(([k, name, desc]) => (
            <li class={egg.enabled && egg.triggers[k] ? '' : 'is-off'}>
              <div><strong>{name}</strong><p>{desc}</p></div>
              <Switch checked={egg.triggers[k]} disabled={!egg.enabled} onChange={(v) => setEgg({ ...egg, triggers: { ...egg.triggers, [k]: v } })} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
