import { useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import { confirmDialog } from '../../lib/dialogs';
import { showEncouragement } from '../../lib/ambient-ui';
import { byIds, useSortable } from '../../lib/useSortable';
import type { SiteModule, Quote } from '../../server/services/config';
import type { StatValue } from '../../server/services/stats';
import type { Settings } from '../../server/seed';
import { ChipToggle, Icon, IconButton, InlineEdit, Segmented, Switch } from './ui';

const ZONES: [string, string, string][] = [
  ['public-home', '公开首页', 'grid'],
  ['public-sidebar', '公开侧栏', 'menu'],
  ['public-article', '文章页', 'book'],
  ['owner-dashboard', '站主总览', 'compass'],
];

interface Props {
  modules: SiteModule[];
  stats: StatValue[];
  sites: { id: string; name: string }[];
  encourage: Settings['encourage'];
  quotes: Quote[];
}

export default function DisplayManager(props: Props) {
  return (
    <div class="stack">
      <ModulesPanel initial={props.modules} />
      <StatsPanel initial={props.stats} sites={props.sites} />
      <EncouragePanel initial={props.encourage} quotes={props.quotes} />
      <QuotesPanel initial={props.quotes} />
    </div>
  );
}

/* ---------------- Modules ---------------- */

function ModulesPanel({ initial }: { initial: SiteModule[] }) {
  const [mods, setMods] = useState(initial);

  async function update(m: SiteModule, patch: Partial<SiteModule>) {
    const next = { ...m, ...patch };
    setMods((xs) => xs.map((x) => (x.id === m.id ? next : x)));
    try {
      await api.put(`/api/owner/modules/${m.id}`, { name: next.name, enabled: next.enabled, visibleTo: next.visibleTo, settings: next.settings });
    } catch (e) {
      setMods((xs) => xs.map((x) => (x.id === m.id ? m : x)));
      toast(errMsg(e), 'error');
    }
  }

  return (
    <section class="panel" id="modules">
      <div class="panel-head">
        <div>
          <h2>模块</h2>
          <p class="panel-sub">拖动排序、启用或重命名各区域的模块；公开区域的模块可以设为“仅站主可见”。登录、权限检查和文章渲染安全不受这里影响。</p>
        </div>
      </div>
      <div class="mod-zones">
        {ZONES.map(([zone, label, icon]) => {
          const list = mods.filter((m) => m.zone === zone);
          if (!list.length) return null;
          return (
            <ZoneList key={zone} zone={zone} label={label} icon={icon} list={list} onUpdate={update}
              onReorder={(ids) => setMods((xs) => [...xs.filter((m) => m.zone !== zone), ...byIds(list, ids)])} />
          );
        })}
      </div>
    </section>
  );
}

function ZoneList({ zone, label, icon, list, onUpdate, onReorder }: {
  zone: string; label: string; icon: string; list: SiteModule[];
  onUpdate: (m: SiteModule, p: Partial<SiteModule>) => void; onReorder: (ids: string[]) => void;
}) {
  const sortable = useSortable(list.map((m) => m.id), async (ids) => {
    onReorder(ids);
    await api.post('/api/owner/modules/reorder', { ids }).catch((e) => toast(errMsg(e), 'error'));
  });
  return (
    <div class="mod-zone">
      <h3><Icon name={icon} size={14} />{label}</h3>
      <ul class="mod-list" ref={sortable.ref as never} onPointerDown={sortable.onPointerDown} onKeyDown={sortable.onKeyDown}>
        {list.map((m) => (
          <li data-sort-id={m.id} class={`mod-item ${m.enabled ? '' : 'is-off'}`}>
            <button type="button" class="handle" data-sort-handle aria-label={`拖动排序：${m.name}`}><Icon name="grip" size={14} /></button>
            <span class="mod-name"><InlineEdit value={m.name} label="模块名称" onSave={(name) => onUpdate(m, { name })} /></span>
            {zone.startsWith('public') && (
              <IconButton
                icon={m.visibleTo === 'public' ? 'eye' : 'eye-off'}
                label={m.visibleTo === 'public' ? '游客可见（点击改为仅站主）' : '仅站主可见（点击改为游客可见）'}
                size="sm"
                active={m.visibleTo === 'public'}
                onClick={() => onUpdate(m, { visibleTo: m.visibleTo === 'public' ? 'owner' : 'public' })}
              />
            )}
            <Switch checked={m.enabled} onChange={(v) => onUpdate(m, { enabled: v })} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Stats ---------------- */

function StatsPanel({ initial, sites }: { initial: StatValue[]; sites: { id: string; name: string }[] }) {
  const [stats, setStats] = useState(initial);

  async function update(s: StatValue, patch: Partial<StatValue>) {
    const next = { ...s, ...patch };
    setStats((xs) => xs.map((x) => (x.id === s.id ? next : x)));
    try {
      await api.put(`/api/owner/stats/${s.id}`, { label: next.label, enabled: next.enabled, public: next.public, siteIds: next.siteIds, startDate: next.startDate });
    } catch (e) {
      setStats((xs) => xs.map((x) => (x.id === s.id ? s : x)));
      toast(errMsg(e), 'error');
    }
  }

  return (
    <section class="panel" id="stats">
      <div class="panel-head">
        <div>
          <h2>时间统计</h2>
          <p class="panel-sub">每项统计可以单独启用与公开。公开的统计显示在公开侧栏；“显示范围”选“全站”时所有页面都显示，也可以多选，只在指定分站显示。未公开的统计不会在任何公开页面计算或输出。</p>
        </div>
      </div>
      <div class="stat-cards">
        {stats.map((s) => (
          <article class={`stat-card ${s.enabled ? '' : 'is-off'} ${s.enabled && s.public ? 'is-public' : ''}`} data-stat={s.kind}>
            <div class="stat-top">
              <div class="stat-head">
                <div class="stat-name"><InlineEdit value={s.label} label="统计名称" onSave={(label) => update(s, { label })} /></div>
                <p class="stat-def">{s.description}</p>
              </div>
              <div class="stat-value">{s.value}<small>{s.unit}</small></div>
            </div>
            <div>
              <div class="stat-label">显示范围</div>
              <ChipToggle label={`${s.label} 的显示范围`} allLabel="全站" options={sites.map((x) => ({ id: x.id, label: x.name }))} value={s.siteIds} onChange={(v) => update(s, { siteIds: v })} />
            </div>
            {s.kind === 'site-days' && (
              <details class="adv">
                <summary><Icon name="chevron-right" size={12} />高级：起始日期</summary>
                <div class="row">
                  <input class="input" style="max-width:180px" type="date" value={s.startDate ?? ''} onChange={(e) => update(s, { startDate: e.currentTarget.value || null })} aria-label="起始日期" />
                  <span class="hint">留空则使用“设置 → 站点信息”中的建站日期。</span>
                </div>
              </details>
            )}
            <div class="stat-toggles">
              <Switch checked={s.enabled} onChange={(v) => update(s, { enabled: v, public: v ? s.public : false })} label="启用" />
              <Switch checked={s.public} disabled={!s.enabled} onChange={(v) => update(s, { public: v })} label="对游客公开" />
            </div>
          </article>
        ))}
      </div>
      <p class="hint" style="margin-top:14px">“连续在线”来自服务每 5 分钟写入的心跳；如果希望代表真实的可用性，可以让外部监控访问 <code>/api/heartbeat?token=…</code>（见部署文档）。</p>
    </section>
  );
}

/* ---------------- Encouragement ---------------- */

function EncouragePanel({ initial, quotes }: { initial: Settings['encourage']; quotes: Quote[] }) {
  const [c, setC] = useState(initial);
  const [saving, setSaving] = useState(false);
  const num = (k: keyof typeof c) => (e: Event) => setC({ ...c, [k]: Number((e.currentTarget as HTMLInputElement).value) });

  async function save(e: Event) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/owner/settings/encourage', c);
      toast('已保存');
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  function preview() {
    const pool = quotes.filter((q) => q.enabled);
    if (!pool.length) return toast('语录库为空', 'error');
    showEncouragement(pool[Math.floor(Math.random() * pool.length)]!, c.durationSeconds, c.animation);
  }

  const curve: number[] = [];
  for (let p = c.baseChance, i = 0; i < 12; i++, p = Math.min(p + c.increment, c.maxChance)) curve.push(p);
  let p = c.baseChance;
  let miss = 1;
  let expected = 0;
  for (let i = 1; i <= 300; i++) {
    expected += i * miss * (p / 100);
    miss *= 1 - p / 100;
    p = Math.min(p + c.increment, c.maxChance);
  }

  return (
    <section class="panel" id="encourage">
      <form onSubmit={save}>
        <div class="panel-head">
          <div>
            <h2>鼓励提示</h2>
            <p class="panel-sub">每隔固定时间判定一次；未触发时概率逐轮增加，直到上限；触发后重置并进入冷却。</p>
          </div>
          <div class="row">
            <button class="btn" type="button" onClick={preview}><Icon name="sparkle" size={14} />立即预览</button>
            <button class={`btn btn-primary ${saving ? 'is-loading' : ''}`} type="submit">保存</button>
          </div>
        </div>
        <div class="row" style="gap:20px;margin-bottom:16px">
          <Switch checked={c.enabled} onChange={(v) => setC({ ...c, enabled: v })} label="启用鼓励提示" />
          <Switch checked={c.quietOnArticle} onChange={(v) => setC({ ...c, quietOnArticle: v })} label="阅读文章时降低打扰（概率减半）" />
        </div>
        <div class="enc-grid">
          <div class="grid-3">
            <div class="field"><label>判定间隔（分钟）</label><input type="number" min={1} max={240} value={c.intervalMinutes} onInput={num('intervalMinutes')} /></div>
            <div class="field"><label>初始概率 a（%）</label><input type="number" min={0} max={100} step={0.5} value={c.baseChance} onInput={num('baseChance')} /></div>
            <div class="field"><label>每轮增加（%）</label><input type="number" min={0} max={100} step={0.5} value={c.increment} onInput={num('increment')} /></div>
            <div class="field"><label>最高概率（%）</label><input type="number" min={0} max={100} step={0.5} value={c.maxChance} onInput={num('maxChance')} /></div>
            <div class="field"><label>展示时长（秒）</label><input type="number" min={3} max={120} value={c.durationSeconds} onInput={num('durationSeconds')} /></div>
            <div class="field"><label>冷却时间（分钟）</label><input type="number" min={0} max={1440} value={c.cooldownMinutes} onInput={num('cooldownMinutes')} /></div>
          </div>
          <div>
            <div class="stat-label">每轮触发概率</div>
            <div class="enc-bars" role="img" aria-label="概率增长曲线">
              {curve.map((v, i) => <span style={`height:${Math.max(3, v)}%`} title={`第 ${i + 1} 轮：${v}%`} />)}
            </div>
            <p class="hint">首次出现的期望时间约 <strong>{Math.round(expected * c.intervalMinutes)}</strong> 分钟。</p>
          </div>
        </div>
        <div class="field" style="max-width:320px">
          <span class="label">出现动画</span>
          <Segmented label="出现动画" value={c.animation} onChange={(v) => setC({ ...c, animation: v })} options={[['rise', '上浮'], ['fade', '淡入']]} />
        </div>
        {c.baseChance > c.maxChance && <p class="hint" style="color:var(--danger)">初始概率不能大于最高概率。</p>}
      </form>
    </section>
  );
}

/* ---------------- Quotes ---------------- */

function QuotesPanel({ initial }: { initial: Quote[] }) {
  const [quotes, setQuotes] = useState(initial);
  const blank = { text: '', author: '', source: '', followUp: '', category: '', enabled: true };
  const [draft, setDraft] = useState<typeof blank & { id?: string }>(blank);
  const [open, setOpen] = useState(false);

  async function save(e: Event) {
    e.preventDefault();
    try {
      if (draft.id) {
        const { id, ...body } = draft;
        await api.put(`/api/owner/quotes/${id}`, body);
        setQuotes((xs) => xs.map((x) => (x.id === id ? { ...x, ...body } : x)));
      } else {
        const q = await api.post<Quote>('/api/owner/quotes', draft);
        setQuotes((xs) => [...xs, q]);
      }
      setDraft(blank);
      setOpen(false);
      toast('已保存');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function toggle(q: Quote) {
    const { id, sort: _s, ...rest } = q;
    try {
      await api.put(`/api/owner/quotes/${id}`, { ...rest, enabled: !q.enabled });
      setQuotes((xs) => xs.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  async function remove(q: Quote) {
    if (!(await confirmDialog('删除这条语录？', q.text, { danger: true, okLabel: '删除' }))) return;
    try {
      await api.del(`/api/owner/quotes/${q.id}`);
      setQuotes((xs) => xs.filter((x) => x.id !== q.id));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <section class="panel" id="quotes">
      <div class="panel-head">
        <div>
          <h2>提示文案库</h2>
          <p class="panel-sub">先展示一句语录，再过渡到一段鼓励的话。请填写真实可考的作者与出处，不要伪造引用。</p>
        </div>
        <button class="btn" type="button" onClick={() => { setDraft(blank); setOpen(true); }}><Icon name="plus" size={14} />新增语录</button>
      </div>
      {open && (
        <form class="quote-form" onSubmit={save}>
          <h3>{draft.id ? '编辑语录' : '新增语录'}</h3>
          <div class="field"><label>语录</label><textarea required rows={2} maxLength={500} value={draft.text} onInput={(e) => setDraft({ ...draft, text: e.currentTarget.value })} /></div>
          <div class="grid-3">
            <div class="field"><label>作者 / 人物</label><input required maxLength={100} value={draft.author} onInput={(e) => setDraft({ ...draft, author: e.currentTarget.value })} /></div>
            <div class="field"><label>出处</label><input maxLength={200} value={draft.source} onInput={(e) => setDraft({ ...draft, source: e.currentTarget.value })} /></div>
            <div class="field"><label>分类</label><input maxLength={20} value={draft.category} onInput={(e) => setDraft({ ...draft, category: e.currentTarget.value })} placeholder="古典 / 经典 / 动漫…" /></div>
          </div>
          <div class="field"><label>过渡与鼓励</label><textarea rows={2} maxLength={600} value={draft.followUp} onInput={(e) => setDraft({ ...draft, followUp: e.currentTarget.value })} /></div>
          <div class="row">
            <button class="btn btn-primary" type="submit">{draft.id ? '保存修改' : '添加'}</button>
            <button class="btn btn-ghost" type="button" onClick={() => setOpen(false)}>取消</button>
          </div>
        </form>
      )}
      <ul class="quote-grid">
        {quotes.map((q) => (
          <li class={`quote-card ${q.enabled ? '' : 'is-off'}`}>
            <blockquote>{q.text}</blockquote>
            <div class="quote-src">— {q.author}{q.source && `，${q.source}`}</div>
            {q.followUp && <p class="quote-follow">{q.followUp}</p>}
            <div class="quote-actions">
              {q.category && <span class="pill">{q.category}</span>}
              <span class="spacer" />
              <Switch checked={q.enabled} onChange={() => toggle(q)} />
              <IconButton icon="edit" label="编辑" size="sm" onClick={() => { setDraft({ ...q }); setOpen(true); }} />
              <IconButton icon="trash" label="删除" size="sm" variant="danger" onClick={() => remove(q)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
