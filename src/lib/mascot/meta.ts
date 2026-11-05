/**
 * 看板娘的**元数据**：有哪些角色、叫什么、一句话介绍。
 *
 * 与几何（`svg.ts`）分开是为了包体：后台的主题编辑器只需要"角色列表"来画选择
 * 器，如果它和十几 KB 的 SVG 路径写在同一个模块里，Rollup 只能整块发出去——
 * 一个 45 KB 的 chunk 换几百字节的数组。分开之后主题编辑器只拉这一份。
 */

export type MascotId = 'chibi' | 'haru' | 'sora' | 'lacia';

export const MASCOTS: { id: MascotId; name: string; desc: string; thumb?: string }[] = [
  { id: 'haru', name: '小春', desc: '樱色发卡、长发、水手服，安静地陪你读书。' },
  { id: 'sora', name: '小晴', desc: '短发侧辫、太阳发夹，撑着透明雨伞的晴天少女。' },
  {
    id: 'lacia',
    name: '蕾西亚',
    desc: '分层骨架立绘：30 个语义图层挂在关节上，会转头、眨眼、摆臂、呼吸；装置 BLACK MONOLITH 有四种形态。（致敬《BEATLESS》，非官方立绘）',
    thumb: '/lacia-rig/thumb.webp',
  },
  { id: 'chibi', name: 'Q 版', desc: '最初的 Q 版夏日制服少女。' },
];

export function isMascotId(id: string): id is MascotId {
  return MASCOTS.some((m) => m.id === id);
}
