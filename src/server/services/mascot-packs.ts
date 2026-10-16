import { unzipSync, strFromU8 } from 'fflate';
import { getDb, newId, now } from '../db';
import { badRequest, notFound } from '../errors';
import { MASCOT_STATES, mascotPackSchema, type MascotPack, type MascotState, type StoredMascotPack } from '../../lib/mascot-pack';
import { getSetting, setSetting } from './settings';
import { deletePackFiles, hasTransparency, MAX_UPLOAD, saveUpload, sniff } from './uploads';

const MAX_PACK = 24 * 1024 * 1024;
const MAX_PACKS = 30;

interface Row {
  id: string;
  name: string;
  manifest: string;
}

function urlsFor(packId: string): Partial<Record<MascotState, string>> {
  const rows = getDb().prepare('SELECT filename, original_name AS name FROM uploads WHERE pack_id = ?').all(packId) as { filename: string; name: string }[];
  const urls: Partial<Record<MascotState, string>> = {};
  for (const r of rows) {
    const state = r.name.replace(/\.(webp|png)$/, '') as MascotState;
    if ((MASCOT_STATES as readonly string[]).includes(state)) urls[state] = `/uploads/${r.filename}`;
  }
  return urls;
}

function toStored(r: Row): StoredMascotPack {
  const manifest = mascotPackSchema.parse(JSON.parse(r.manifest));
  return { ...manifest, id: r.id, urls: urlsFor(r.id) };
}

export function listPacks(): StoredMascotPack[] {
  return (getDb().prepare('SELECT id, name, manifest FROM mascot_packs ORDER BY created_at DESC').all() as Row[]).flatMap((r) => {
    try {
      return [toStored(r)];
    } catch {
      return [];
    }
  });
}

export function getPack(id: string): StoredMascotPack | null {
  const r = getDb().prepare('SELECT id, name, manifest FROM mascot_packs WHERE id = ?').get(id) as Row | undefined;
  if (!r) return null;
  try {
    return toStored(r);
  } catch {
    return null;
  }
}

/**
 * Import a mascot pack zip. Everything is validated before anything is written:
 * manifest schema, file names (no paths), image type by magic bytes, sizes.
 * Returns the stored pack plus warnings (e.g. images without transparency).
 */
export function importPack(zip: Buffer): { pack: StoredMascotPack; warnings: string[] } {
  if (zip.length > MAX_PACK) throw badRequest(`角色包不能超过 ${MAX_PACK / 1024 / 1024}MB`);
  const count = (getDb().prepare('SELECT COUNT(*) AS n FROM mascot_packs').get() as { n: number }).n;
  if (count >= MAX_PACKS) throw badRequest(`最多保存 ${MAX_PACKS} 个角色包，请先删除一些`);
  let files: Record<string, Uint8Array>;
  try {
    let total = 0;
    files = unzipSync(new Uint8Array(zip), {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_PACK * 3) throw new Error('解压后过大');
        return true;
      },
    });
  } catch (e) {
    throw badRequest(`无法读取 zip：${(e as Error).message}`);
  }
  // Accept packs zipped with a single top-level folder.
  const names = Object.keys(files).filter((n) => !n.endsWith('/'));
  const prefix = names.length && names.every((n) => n.includes('/')) ? names[0]!.split('/')[0] + '/' : '';
  const get = (n: string) => files[prefix + n];
  const rawManifest = get('mascot.json');
  if (!rawManifest) throw badRequest('角色包里缺少 mascot.json');
  let manifest: MascotPack;
  try {
    manifest = mascotPackSchema.parse(JSON.parse(strFromU8(rawManifest)));
  } catch (e) {
    throw badRequest(`mascot.json 格式不正确：${(e as Error).message.slice(0, 300)}`);
  }
  const warnings: string[] = [];
  const images: [MascotState, string, Buffer][] = [];
  for (const state of MASCOT_STATES) {
    const file = manifest.states[state];
    if (!file) continue;
    const data = get(file);
    if (!data) throw badRequest(`mascot.json 引用了 ${file}，但压缩包里没有这个文件`);
    const buf = Buffer.from(data);
    if (buf.length > MAX_UPLOAD) throw badRequest(`${file} 超过 ${MAX_UPLOAD / 1024 / 1024}MB`);
    const type = sniff(buf);
    if (!type || !['png', 'webp'].includes(type.ext)) throw badRequest(`${file} 必须是 PNG 或 WebP 图片`);
    if (hasTransparency(buf) === false) warnings.push(`${file} 没有透明通道，会显示成方块。建议先用“素材工作室”抠图。`);
    images.push([state, `${state}.${type.ext}`, buf]);
  }
  const id = newId();
  const ts = now();
  const db = getDb();
  db.transaction(() => {
    db.prepare('INSERT INTO mascot_packs (id, name, manifest, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(id, manifest.name, JSON.stringify(manifest), ts, ts);
    for (const [, name, buf] of images) saveUpload(buf, name, id);
  })();
  return { pack: getPack(id)!, warnings };
}

/** Update editable fields (name, anchors, display, motion, lines) — images stay as imported. */
export function updatePack(id: string, raw: unknown): StoredMascotPack {
  const cur = getPack(id);
  if (!cur) throw notFound('角色包');
  const { id: _i, urls: _u, ...base } = cur;
  const patch = (raw ?? {}) as Partial<MascotPack>;
  const next = mascotPackSchema.parse({
    ...base,
    name: patch.name ?? base.name,
    anchors: patch.anchors ?? base.anchors,
    display: patch.display ?? base.display,
    motion: patch.motion ?? base.motion,
    lines: patch.lines ?? base.lines,
  });
  getDb().prepare('UPDATE mascot_packs SET name = ?, manifest = ?, updated_at = ? WHERE id = ?').run(next.name, JSON.stringify(next), now(), id);
  return getPack(id)!;
}

export function deletePack(id: string): void {
  if (!getPack(id)) throw notFound('角色包');
  deletePackFiles(id);
  getDb().prepare('DELETE FROM uploads WHERE pack_id = ?').run(id);
  getDb().prepare('DELETE FROM mascot_packs WHERE id = ?').run(id);
  // If the site was using this pack, fall back to the theme's own character.
  const a = getSetting('appearance');
  if (a.mascot.character === `pack:${id}`) setSetting('appearance', { ...a, mascot: { ...a.mascot, character: 'preset' } });
}
