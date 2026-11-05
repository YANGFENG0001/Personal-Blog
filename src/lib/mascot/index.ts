/**
 * 看板娘的入口。分成三份，各自解决一个包体问题：
 *
 *   meta.ts    角色列表与介绍   ← 后台主题编辑器只要这个
 *   lines.ts   台词             ← 服务端渲染角落组件时读
 *   model.ts   组件 / 动作模型  ← 骨架与后台共用
 *
 * `index.ts` 把三份合起来，是服务端与后台的方便入口。**客户端脚本不要从这里
 * import**——那样会把角色列表一起拖进浏览器。客户端要什么就 import 那个具体
 * 的模块。
 */
export * from './meta';
export * from './model';
export { MASCOT_LINES, type MascotVoice } from './lines';
