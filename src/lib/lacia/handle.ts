/**
 * 骨架动作模组的把手与弹簧名。
 *
 * 单独一个文件是为了**不把引擎拖进后台**：设置面板要读组件表（槽位、名字、
 * 动作数），如果这些类型写在 `rig.ts` 里，面板就得连弹簧、IK、标记生成器一起
 * 打包。类型本身在编译后不存在，但 import 的模块会被拉进来——所以边界必须画在
 * 一个只有类型和常量的文件上。
 */
import type { LaciaForm } from './lines';
import type { SayLine } from '../viseme';

/**
 * 动作模组可以寻址的弹簧。
 *
 * 写在这里而不是从引擎里推断，是为了让组件能点出一个手势而不用 import 引擎。
 * `LaciaRig` 用 `Record<LaciaSpring, Spring>` 标注它的弹簧表，所以"加了弹簧
 * 却没加到这里"（或反过来）是编译错误，而不是运行时静默无效。
 */
export type LaciaSpring =
  | 'rootY'
  | 'hipsX'
  | 'hipsR'
  | 'spineR'
  | 'chestR'
  | 'torsoR'
  | 'torsoShift'
  | 'torsoY'
  | 'torsoX'
  | 'neckR'
  | 'neckX'
  | 'neckY'
  | 'headR'
  | 'headX'
  | 'headY'
  | 'headTurn'
  | 'hairFWorld'
  | 'hairBWorld'
  | 'armRR'
  | 'armLR'
  | 'legRR'
  | 'legLR'
  | 'kneeRR'
  | 'kneeLR'
  | 'elbowRR'
  | 'elbowLR'
  | 'wristRR'
  | 'wristLR'
  | 'ankleRR'
  | 'ankleLR'
  | 'monY'
  | 'monR'
  | 'monHit'
  | 'monWorld'
  | 'monAim'
  | 'monRecoil'
  | 'browY'
  | 'browTilt'
  | 'mouthOpen'
  | 'mouthWide';

/**
 * 动作模组能对骨架做什么。
 *
 * 刻意做小：组件描述手势，拿不到 rig 本身。`after` 由 rig 持有，所以被打断的
 * 动作不会留下延迟回调——那是两个动作重叠时用裸 `setTimeout` 必然出现的 bug
 * （切到别的动作后，railgun 的 260ms 甩头还会再打一次）。
 */
export interface RigHandle {
  impulse(spring: LaciaSpring, peak: number): void;
  kick(spring: LaciaSpring, velocity: number): void;
  /** 应用一个装置构型但不跑它的动作（供动作内部调用）。 */
  setDeviceForm(form: LaciaForm): void;
  say(lines: readonly SayLine[]): void;
  after(ms: number, fn: () => void): void;
}
