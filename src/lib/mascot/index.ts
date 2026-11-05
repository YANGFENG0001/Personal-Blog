/**
 * 看板娘的入口。分成四份，各自解决一个包体问题：
 *
 *   meta.ts    角色列表与介绍   ← 后台主题编辑器只要这个
 *   svg.ts     内联 SVG 几何     ← 服务端渲染用，浏览器拿不到
 *   parts.ts   造型的可选组件
 *   actions.ts 造型的动作模组   ← 只有这一份会进浏览器
 *
 * `index.ts` 把四份合起来，是服务端与后台的方便入口。**客户端脚本不要从这里
 * import**——那样会把几何一起拖进浏览器，等于白拆。客户端要动作表就 import
 * `./actions`，要角色列表就 import `./meta`。
 */
export * from './meta';
export * from './model';
export { mascotSvg, MASCOT_LINES } from './svg';
export { SVG_COMPONENTS, SVG_COMPONENT_DEFAULTS, type SvgComponentId, type SvgHandle } from './parts';
export { SVG_SELF_ACTIONS, actionForState, svgActionsFor } from './actions';
