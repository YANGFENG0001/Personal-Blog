import { useState } from 'preact/hooks';
import { api, errMsg, move, toast } from '../../lib/client';
import { showEncouragement } from '../../lib/ambient-ui';
import type { SiteModule } from '../../server/services/config';
import type { Quote } from '../../server/services/config';
import type { StatValue } from '../../server/services/stats';
import type { Settings } from '../../server/seed';

const ZONES: Record<string, string> = {
  'public-home': '公开首页',
  'public-sidebar': '公开侧栏',
  'public-article': '文章页',
  'owner-dashboard': '站主总览',
};

interface Props {
  modules: SiteModule[];
  stats: StatValue[];
  sites: { id: string; name: string }[];
  encourage: Settings['encourage'];
  easter: Settings['easter'];
  quotes: Quote[];
}

export default function DisplayManager(props: Props) {
  return (
    <div class="stack">
      <ModulesPanel initial={props.modules} />
      <StatsPanel initial={props.stats} sites={props.sites} />
      <EncouragePanel initial={props.encourage} easter={props.easter} quotes={props.quotes} />
      <QuotesPanel initial={props.quotes} />
    </div>
  );
}

function ModulesPanel({ initial }: { initial: SiteModule[] }) {
  const [mods, setMods] = useState(initial);

  async function update(m: SiteModule, patch: Partial<SiteModule>) {
    const next = { ...m, ...patch };
    try {
      await api.put(`/api/owner/modules/${m.id}`, { name: next.name, enabled: next.enabled, visibleTo: next.visibleTo, settings: next.settings });
      setMods((xs) => xs.map((x) => (x.id === m.id ? next : x)));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  async function reorderZone(zone: string, i: number, dir: -1 | 1) {
    const inZone = mods.filter((m) => m.zone === zone);
    const next = move(inZone, i, i + dir);
    if (next === inZone) return;
    setMods((xs) => [...xs.filter((m) => m.zone !== zone), ...next]);
    await api.post('/api/owner/modules/reorder', { ids: next.map((m) => m.id) }).catch((e) => toast(errMsg(e), 'error'));
  }

  return (
    <section class="panel" id="modules">
      <h2>模块</h2>
      <p class="panel-sub">启用、重命名、排序各区域的模块。公开区域的模块可单独设为“仅站主可见”。登录、权限检查与文章渲染安全不受此处影响。</p>
      <div class="grid-2">
        {Object.entries(ZONES).map(([zone, label]) => {
          const list = mods.filter((m) => m.zone === zone);
          if (!list.length) return null;
          return (
            <div class="dm-zone">
              <h3>{label}</h3>
              <ul class="list-plain">
                {list.map((m, i) => (
                  <li class="dm-mod">
                    <label class="switch">
                      <input type="checkbox" checked={m.enabled} onChange={(e) => update(m, { enabled: e.currentTarget.checked })} aria-label={`启用 ${m.name}`} />
                      <span class="track" />
                    </label>
                    <input
                      class="input dm-name"
                      value={m.name}
                      onChange={(e) => e.currentTarget.value.trim() && update(m, { name: e.currentTarget.value.trim() })}
                      aria-label="模块名称"
                    />
                    {zone.startsWith('public') && (
                      <select class="select dm-vis" value={m.visibleTo} onChange={(e) => update(m, { visibleTo: e.currentTarget.value as 'public' | 'owner' })} aria-label="可见范围">
                        <option value="public">游客可见</option>
                        <option value="owner">仅站主</option>
                      </select>
                    )}
                    <button class="btn btn-sm btn-ghost" type="button" disabled={i === 0} onClick={() => reorderZone(zone, i, -1)} aria-label="上移">↑</button>
                    <button class="btn btn-sm btn-ghost" type="button" disabled={i === list.length - 1} onClick={() => reorderZone(zone, i, 1)} aria-label="下移">↓</button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatsPanel({ initial, sites }: { initial: StatValue[]; sites: { id: string; name: string }[] }) {
  const [stats, setStats] = useState(initial);

  async function update(s: StatValue, patch: Partial<StatValue>) {
    const next = { ...s, ...patch };
    try {
      await api.put(`/api/owner/stats/${s.id}`, {
        label: next.label, enabled: next.enabled, public: next.public, siteIds: next.siteIds, startDate: next.startDate,
      });
      setStats((xs) => xs.map((x) => (x.id === s.id ? next : x)));
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  return (
    <section class="panel" id="stats">
      <h2>时间统计</h2>
      <p class="panel-sub">每项统计都可单独开启与公开。公开统计显示在公开侧栏的“公开统计”模块中；未勾选“公开”的统计不会在任何公开页面中计算或输出。</p>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>名称</th><th>当前值</th><th>定义</th><th>启用</th><th>公开</th><th>范围</th></tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr>
                <td>
                  <input class="input dm-name" value={s.label} onChange={(e) => e.currentTarget.value.trim() && update(s, { label: e.currentTarget.value.trim() })} aria-label="统计名称" />
                  {s.kind === 'site-days' && (
                    <input class="input dm-date" type="date" value={s.startDate ?? ''} onChange={(e) => update(s, { startDate: e.currentTarget.value || null })} aria-label="起始日期" title="留空则使用建站日期" />
                  )}
                </td>
                <td class="nowrap"><strong>{s.value}</strong> {s.unit}</td>
                <td class="faint small">{s.description}</td>
                <td><label class="switch"><input type="checkbox" checked={s.enabled} onChange={(e) => update(s, { enabled: e.currentTarget.checked })} /><span class="track" /></label></td>
                <td><label class="switch"><input type="checkbox" checked={s.public} disabled={!s.enabled} onChange={(e) => update(s, { public: e.currentTarget.checked })} /><span class="track" /></label></td>
                <td>
                  <select
                    class="select"
                    multiple
                    size={Math.min(4, sites.length + 1)}
                    onChange={(e) => {
                      const ids = [...e.currentTarget.selectedOptions].map((o) => o.value);
                      void update(s, { siteIds: ids.length ? ids : null });
                    }}
                    aria-label="只在这些分站显示"
                    title="不选 = 全站显示；选中则只在这些分站页面显示"
                  >
                    {sites.map((x) => <option value={x.id} selected={!!s.siteIds?.includes(x.id)}>{x.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p class="hint">“连续在线”来自服务每 5 分钟写入的心跳记录；如需代表真实可用性，可让外部监控（如 UptimeRobot）定时访问 <code>/api/heartbeat?token=…</code>（见部署文档）。</p>
    </section>
  );
}

function EncouragePanel({ initial, easter, quotes }: { initial: Settings['encourage']; easter: Settings['easter']; quotes: Quote[] }) {
  const [c, setC] = useState(initial);
  const [egg, setEgg] = useState(easter.enabled);
  const num = (k: keyof typeof c) => (e: Event) => setC({ ...c, [k]: Number((e.currentTarget as HTMLInputElement).value) });

  async function save(e: Event) {
    e.preventDefault();
    try {
      await api.put('/api/owner/settings/encourage', c);
      await api.put('/api/owner/settings/easter', { enabled: egg });
      toast('已保存');
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  function preview() {
    const pool = quotes.filter((q) => q.enabled);
    if (!pool.length) return toast('语录库为空', 'error');
    showEncouragement(pool[Math.floor(Math.random() * pool.length)]!, c.durationSeconds, c.animation);
  }

  // Expected rolls until first hit, to make the parameters tangible.
  let p = c.baseChance;
  let miss = 1;
  let expected = 0;
  for (let i = 1; i <= 200; i++) {
    expected += i * miss * (p / 100);
    miss *= 1 - p / 100;
    p = Math.min(p + c.increment, c.maxChance);
  }
  const minutes = Math.round(expected * c.intervalMinutes);

  return (
    <section class="panel" id="encourage">
      <form onSubmit={save}>
        <div class="panel-head">
          <div>
            <h2>鼓励提示与彩蛋</h2>
            <p class="panel-sub">每隔固定时间判定一次；未触发时概率逐轮增加，直到上限；触发后重置并进入冷却。</p>
          </div>
          <div class="row">
            <button class="btn" type="button" onClick={preview}>立即预览</button>
            <button class="btn btn-primary" type="submit">保存</button>
          </div>
        </div>
        <div class="row dm-switches">
          <label class="switch"><input type="checkbox" checked={c.enabled} onChange={(e) => setC({ ...c, enabled: e.currentTarget.checked })} /><span class="track" /><span>启用鼓励提示</span></label>
          <label class="switch"><input type="checkbox" checked={c.quietOnArticle} onChange={(e) => setC({ ...c, quietOnArticle: e.currentTarget.checked })} /><span class="track" /><span>阅读文章时降低打扰（概率减半）</span></label>
          <label class="switch"><input type="checkbox" checked={egg} onChange={(e) => setEgg(e.currentTarget.checked)} /><span class="track" /><span>启用随机彩蛋</span></label>
        </div>
        <div class="grid-3">
          <div class="field"><label>判定间隔（分钟）</label><input type="number" min={1} max={240} value={c.intervalMinutes} onInput={num('intervalMinutes')} /></div>
          <div class="field"><label>初始概率 a（%）</label><input type="number" min={0} max={100} step={0.5} value={c.baseChance} onInput={num('baseChance')} /></div>
          <div class="field"><label>每轮增加（%）</label><input type="number" min={0} max={100} step={0.5} value={c.increment} onInput={num('increment')} /></div>
          <div class="field"><label>最高概率（%）</label><input type="number" min={0} max={100} step={0.5} value={c.maxChance} onInput={num('maxChance')} /></div>
          <div class="field"><label>展示时长（秒）</label><input type="number" min={3} max={120} value={c.durationSeconds} onInput={num('durationSeconds')} /></div>
          <div class="field"><label>冷却时间（分钟）</label><input type="number" min={0} max={1440} value={c.cooldownMinutes} onInput={num('cooldownMinutes')} /></div>
          <div class="field">
            <label>出现动画</label>
            <select value={c.animation} onChange={(e) => setC({ ...c, animation: e.currentTarget.value as 'rise' | 'fade' })}>
              <option value="rise">上浮</option>
              <option value="fade">淡入</option>
            </select>
          </div>
        </div>
        <p class="hint">
          按当前设置，游客停留期间第一次看到提示的期望时间约为 <strong>{minutes}</strong> 分钟。
          {c.baseChance > c.maxChance && <span class="warn"> 初始概率不能大于最高概率。</span>}
        </p>
      </form>
    </section>
  );
}

function QuotesPanel({ initial }: { initial: Quote[] }) {
  const [quotes, setQuotes] = useState(initial);
  const blank = { text: '', author: '', source: '', followUp: '', category: '', enabled: true };
  const [draft, setDraft] = useState<typeof blank & { id?: string }>(blank);

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
    if (!confirm('删除这条语录？')) return;
    try {
      await api.del(`/api/owner/quotes/${q.id}`);
      setQuotes((xs) => xs.filter((x) => x.id !== q.id));
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  }

  return (
    <section class="panel" id="quotes">
      <h2>提示文案库</h2>
      <p class="panel-sub">先展示一句语录，再过渡到一段鼓励的话。请填写真实可考的作者与出处，不要伪造引用。</p>
      <ul class="list-plain dm-quotes">
        {quotes.map((q) => (
          <li class={q.enabled ? '' : 'off'}>
            <div class="row-between">
              <div>
                <blockquote class="serif">{q.text}</blockquote>
                <div class="faint small">— {q.author}{q.source && `，${q.source}`}{q.category && ` · ${q.category}`}</div>
                {q.followUp && <p class="muted small">{q.followUp}</p>}
              </div>
              <div class="row">
                <label class="switch"><input type="checkbox" checked={q.enabled} onChange={() => toggle(q)} aria-label="启用" /><span class="track" /></label>
                <button class="btn btn-sm btn-ghost" type="button" onClick={() => setDraft({ ...q })}>编辑</button>
                <button class="btn btn-sm btn-ghost btn-danger" type="button" onClick={() => remove(q)}>删除</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <form class="dm-qform" onSubmit={save}>
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
          {draft.id && <button class="btn" type="button" onClick={() => setDraft(blank)}>取消</button>}
        </div>
      </form>
    </section>
  );
}
