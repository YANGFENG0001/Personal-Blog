import { useRef, useState } from 'preact/hooks';
import { api, errMsg, toast } from '../../lib/client';
import { confirmDialog } from '../../lib/dialogs';
import { LINE_GROUPS, LINE_GROUP_LABELS, MASCOT_STATES, STATE_LABELS, type StoredMascotPack } from '../../lib/mascot-pack';
import { Icon, IconButton, Segmented, Switch } from './ui';

/**
 * Mascot packs: import (.zip from the local asset studio), preview each state,
 * tune display / motion / lines, pick one as the site mascot, delete.
 */
export function MascotPacks({ packs, setPacks, selected, onSelect, studioUrl }: {
  studioUrl: string;
  packs: StoredMascotPack[];
  setPacks: (p: StoredMascotPack[]) => void;
  selected: string;
  onSelect: (character: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  async function importZip(file: File) {
    const form = new FormData();
    form.append('file', file);
    setBusy(true);
    try {
      const r = await api.upload<{ pack: StoredMascotPack; warnings: string[] }>('/api/owner/mascots', form);
      setPacks([r.pack, ...packs]);
      setOpen(r.pack.id);
      toast(`已导入角色包「${r.pack.name}」`);
      for (const w of r.warnings) toast(w, 'error');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(p: StoredMascotPack) {
    if (!(await confirmDialog(`删除角色包「${p.name}」？`, '图片会一并删除；如果网站正在使用它，会退回内置角色。', { danger: true, okLabel: '删除' }))) return;
    try {
      await api.del(`/api/owner/mascots/${p.id}`);
      setPacks(packs.filter((x) => x.id !== p.id));
      if (selected === `pack:${p.id}`) onSelect('preset');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  }

  return (
    <div class="mp">
      <div class="mp-studio">
        <Icon name="sparkle" size={18} />
        <div>
          <strong>用「素材工作室」制作角色包</strong>
          <p>
            直接上传的图片常带着<b>假的棋盘格背景</b>，会显示成方块。请先下载本地工具：自动去掉棋盘格 / 纯色背景（复杂背景可选 AI 模型）、画笔修补、设置表情状态和台词，然后导出 <code>.zip</code> 角色包导入到这里。
          </p>
          <div class="row">
            <a class="btn btn-sm" href={studioUrl} target="_blank" rel="noopener"><Icon name="external" size={13} />下载素材工作室</a>
            <code class="mp-cmd">cd tools/asset-studio && npm install && npm start</code>
          </div>
        </div>
      </div>

      <div class="mp-head">
        <span class="label">我的角色包（{packs.length}）</span>
        <input ref={input} type="file" accept=".zip,application/zip" hidden onChange={(e) => e.currentTarget.files?.[0] && importZip(e.currentTarget.files[0])} />
        <button type="button" class={`btn btn-sm ${busy ? 'is-loading' : ''}`} onClick={() => input.current?.click()} disabled={busy}><Icon name="plus" size={13} />导入角色包</button>
      </div>

      {packs.length === 0 && <p class="hint">还没有角色包。导入后可以在上面的“角色”里选择它。</p>}
      <ul class="mp-list">
        {packs.map((p) => (
          <li class={`mp-item ${selected === `pack:${p.id}` ? 'on' : ''}`} key={p.id}>
            <button type="button" class="mp-thumb" onClick={() => onSelect(`pack:${p.id}`)} title="设为看板娘">
              {p.urls.idle && <img src={p.urls.idle} alt="" loading="lazy" />}
            </button>
            <div class="mp-meta">
              <strong>{p.name}</strong>
              <small>{Object.keys(p.urls).length} 个状态 · {p.width}×{p.height}{p.author ? ` · ${p.author}` : ''}</small>
              <div class="row">
                <button type="button" class="btn btn-sm btn-ghost" onClick={() => onSelect(`pack:${p.id}`)}>{selected === `pack:${p.id}` ? '使用中' : '使用'}</button>
                <button type="button" class="btn btn-sm btn-ghost" onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? '收起' : '编辑'}</button>
                <IconButton icon="trash" label={`删除 ${p.name}`} size="sm" variant="danger" onClick={() => remove(p)} />
              </div>
            </div>
            {open === p.id && <PackEditor pack={p} onSaved={(np) => setPacks(packs.map((x) => (x.id === np.id ? np : x)))} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PackEditor({ pack, onSaved }: { pack: StoredMascotPack; onSaved: (p: StoredMascotPack) => void }) {
  const [p, setP] = useState(pack);
  const [state, setState] = useState<(typeof MASCOT_STATES)[number]>('idle');
  const [saving, setSaving] = useState(false);
  const d = p.display;
  const setD = (patch: Partial<StoredMascotPack['display']>) => setP({ ...p, display: { ...d, ...patch } });
  const setM = (patch: Partial<StoredMascotPack['motion']>) => setP({ ...p, motion: { ...p.motion, ...patch } });

  async function save() {
    setSaving(true);
    try {
      const saved = await api.put<StoredMascotPack>(`/api/owner/mascots/${p.id}`, { name: p.name, anchors: p.anchors, display: p.display, motion: p.motion, lines: p.lines });
      onSaved(saved);
      toast('角色包已保存');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  /** Click on the preview to move the speech-bubble anchor (stored in whole-image coords). */
  function setBubble(e: MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000;
    const y = Math.round((((e.clientY - r.top) / r.height) * d.crop) * 1000) / 1000;
    setP({ ...p, anchors: { ...p.anchors, bubble: [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))] } });
  }

  return (
    <div class="mp-edit">
      <div class="mp-preview">
        <div class="seg-mini" role="tablist">
          {MASCOT_STATES.filter((s) => p.urls[s]).map((s) => (
            <button type="button" class={state === s ? 'on' : ''} onClick={() => setState(s)} title={STATE_LABELS[s]}>{STATE_LABELS[s].replace(/（.*）/, '')}</button>
          ))}
        </div>
        <div class={`mp-stage mode-${d.mode} ${d.flip ? 'flip' : ''}`}>
          <span class="mp-fig" onClick={setBubble} title="点击设置对话气泡的位置" style={`aspect-ratio:${p.width}/${p.height * d.crop};height:${d.crop * 100}%`}>
            <img src={p.urls[state] ?? p.urls.idle} alt="" />
            <span class="mp-bubble-dot" style={`left:${p.anchors.bubble[0] * 100}%;top:${(p.anchors.bubble[1] / d.crop) * 100}%`}>💬</span>
          </span>
        </div>
        <p class="hint">点击图片设置对话气泡位置。缺少的状态会自动用“默认”。</p>
      </div>
      <div class="stack" style="gap:12px">
        <label class="field"><span class="label">名字</span><input value={p.name} maxLength={40} onInput={(e) => setP({ ...p, name: e.currentTarget.value })} /></label>
        <div class="field"><span class="label">显示方式</span>
          <Segmented label="显示方式" value={d.mode} onChange={(v) => setD({ mode: v })} options={[['full', '全身'], ['bust', '半身渐隐'], ['peek', '探头']]} />
        </div>
        <label class="field"><span class="label">显示高度 {d.height}px（“中”尺寸时）</span>
          <input type="range" min={120} max={420} step={10} value={d.height} onInput={(e) => setD({ height: Number(e.currentTarget.value) })} />
        </label>
        <label class="field"><span class="label">显示范围 {Math.round(d.crop * 100)}%（从头顶向下露出到哪一段，100% = 全身）</span>
          <input type="range" min={20} max={100} step={5} value={Math.round(d.crop * 100)} onInput={(e) => setD({ crop: Number(e.currentTarget.value) / 100 })} />
        </label>
        <div class="field"><span class="label">描边</span>
          <Segmented label="描边" value={d.outline} onChange={(v) => setD({ outline: v })} options={[['soft', '柔和'], ['white', '白描边'], ['none', '无']]} />
        </div>
        <div class="grid-2">
          <Switch checked={d.flip} onChange={(v) => setD({ flip: v })} label="水平翻转" />
          <Switch checked={d.shadow} onChange={(v) => setD({ shadow: v })} label="脚下阴影" />
          <Switch checked={p.motion.breathe} onChange={(v) => setM({ breathe: v })} label="呼吸" />
          <Switch checked={p.motion.sway} onChange={(v) => setM({ sway: v })} label="轻微摇摆" />
          <Switch checked={p.motion.swing} onChange={(v) => setM({ swing: v })} label="拖动时摆动" />
        </div>
        <details class="mp-lines">
          <summary>台词（每行一句，最多 60 字）</summary>
          {LINE_GROUPS.map((g) => (
            <label class="field" key={g}>
              <span class="label">{LINE_GROUP_LABELS[g]}</span>
              <textarea rows={2} value={(p.lines[g] ?? []).join('\n')} onInput={(e) => {
                const arr = e.currentTarget.value.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 60)).slice(0, 40);
                setP({ ...p, lines: { ...p.lines, [g]: arr.length ? arr : undefined } });
              }} />
            </label>
          ))}
        </details>
        <div class="row">
          <button type="button" class={`btn btn-primary btn-sm ${saving ? 'is-loading' : ''}`} onClick={save} disabled={saving}>保存角色包</button>
          {p.license && <span class="hint">授权：{p.license}</span>}
        </div>
      </div>
    </div>
  );
}
