# 技能库

四个技能，分成**通用**和**项目适配**两层。换项目时只需要重写适配层，通用层原样带走。

```
mascot-studio/              通用 · 看板娘 / 桌面角色制作
theme-studio/               通用 · 站点主题制作
fieldnotes-mascot-sourcing/ 适配 · FIELDNOTES 的角色包格式与导入
fieldnotes-theme-pack/      适配 · FIELDNOTES 的主题 JSON 格式
```

## 什么时候用哪个

| 你要做的事 | 用 |
|---|---|
| 从零做一个插画级角色，或把某个角色「一模一样还原」 | `mascot-studio` |
| 角色抠图、多帧对齐、局部动态（头发飘/呼吸） | `mascot-studio` |
| 她要拿着/展开某个武器或装置、要多个姿势、要口型对台词 | `mascot-studio` §10「拆层刚体骨架」+ `references/rig-notes.md` |
| 做一套站点主题：配色、日夜、场景、验收 | `theme-studio` |
| 把角色/主题装进 FIELDNOTES 这个站 | `fieldnotes-*` |

`mascot-studio` 有两条动效路线：**位移场**（一张图 + `feDisplacementMap`，便宜，只能做
头发飘/呼吸）和**拆层刚体骨架**（20+ 图层 + 层级 + 弹簧，能做关节、道具、口型）。
选错路线是这类项目最贵的错误，判断标准见 SKILL.md §0 和 §10.1。

## 拿给别的 Agent 怎么用

通用层是**自包含**的：SKILL.md 讲方法与判断，scripts/ 是可执行工具，不依赖 FIELDNOTES 的任何代码。

```bash
# 只带通用能力
cp -r skills/mascot-studio skills/theme-studio <目标项目>/skills/
```

带过去之后，那个 Agent 只需要回答 SKILL.md 末尾「Adapter」的四个问题，就能把产物接到它自己的项目上。

依赖（通用层脚本用到）：`sharp`、`fflate`、`better-sqlite3`（仅 `import-pack.mjs` 需要）。

```bash
npm i sharp fflate better-sqlite3
```

### 想让 Agent 自动发现这些技能

本仓库把技能放在根目录 `skills/`，是**文档与脚本**的组织方式，Agent 不会自动加载。要让支持技能自动发现的宿主（如 WorkBuddy）加载它们，把需要的技能放进项目级或用户级技能目录：

```bash
# 项目级（跟着仓库走）
mkdir -p .workbuddy-ai/skills
cp -r skills/mascot-studio skills/theme-studio .workbuddy-ai/skills/

# 或者用户级（所有项目都能用）
cp -r skills/mascot-studio skills/theme-studio ~/.workbuddy-ai/skills/
```

**但复制会让两份文件各自演化，文档和代码不一致比没有文档更坏。** 本仓库对
`mascot-studio` 用的是 **junction**（Windows 目录联接），单一真相源：

```powershell
New-Item -ItemType Junction `
  -Path   .workbuddy-ai\skills\mascot-studio `
  -Target (Resolve-Path skills\mascot-studio)
```

改 `skills/mascot-studio/` 里的任何文件，`.workbuddy-ai/skills/` 那份立刻同步；
删掉 junction 用 `Remove-Item .workbuddy-ai\skills\mascot-studio`（不会删源目录）。

技能靠 `SKILL.md` 头部的 `name` / `description` 被发现，所以挂过去不需要改任何路径
（脚本按相对路径 `scripts/…` 引用）。

## 脚本清单

| 脚本 | 作用 | 关键点 |
|---|---|---|
| `mascot-studio/scripts/chroma-key.mjs` | 纯色底抠图 | 按背景色**距离**而非洋红指标；反预乘去污染；`--check` 出灰底预览 |
| `mascot-studio/scripts/align-frames.mjs` | 多帧对齐到同一画布 | 按 alpha 包围盒**底边贴齐**，脚对齐状态切换才不跳 |
| `mascot-studio/scripts/warp-map.mjs` | 生成位移贴图 | 局部动态的核心；无需额外生图 |
| `mascot-studio/scripts/build-pack.mjs` | 打角色包 | 并集裁剪、按高度缩放、自动算 baseline |
| `mascot-studio/scripts/import-pack.mjs` | 直接写库导入 | 没有站主密码时用，不重置密码 |
| `theme-studio/scripts/contrast-check.mjs` | 配色对比度审计 | 逐项判 WCAG，并给出**具体修正色** |

每个脚本都能独立跑，`node <脚本> --help` 之外，文件头的注释就是用法说明。

## 参考笔记

| 文件 | 内容 |
|---|---|
| `mascot-studio/references/rig-notes.md` | 拆层刚体骨架的实现细节：拆层命令与踩坑、骨骼层级与 socket 挂点、弹簧参数表、表情差分烘焙（亚像素/同尺寸/opacity）、口型五元音映射、出血布局、验证脚本 |

拆层路线依赖的不是 npm 包，而是 **ComfyUI + See-through**（8GB 显存要用 NF4 版）。
启动前记得 `HF_ENDPOINT=https://hf-mirror.com` 并清掉代理变量，否则连节点 import 都会卡几分钟。

## 这套技能里最值钱的几条结论

写在这里，免得只看目录的人漏掉：

1. **做「一模一样」必须用参考图当图生图底稿。** 纯文字描述一定漂移。先把参考图拆成逐项设定卡，再写提示词。
2. **生图模型给不了真透明通道。** `background: "transparent"` 只是把棋盘格画进画面。必须纯色底 + 自己抠。
3. **AI 生图切不出干净图层** —— 这是**差分法**的失败，不是拆层的失败。专用拆层模型（See-through）能出干净图层，代价是要换成刚体骨架方案。想要局部动态又不想拆层，就用位移贴图。
4. **抠图的阈值要覆盖背景梯度的全部范围**，用分位数或均值都会在远端留下半透明残留，最后表现是「头发变色」或「永远裁不干净」。
5. **验收时量尺寸要等入场动画结束**，否则会读到「还在往上滑」的位置，表现为底部莫名留缝。
6. **动效路线选错，比调参调不好贵得多。** 需求里有「她拿着/展开某个东西」就必须拆层骨架，位移场再做也做不出来。
7. **弹簧的初值要等于它「什么都没发生」时的值。** 位置是 0，比例是 1。写成 0 的后果是 hydrate 后第一帧 `scaleY(0)`——嘴消失 60ms 再胀回来，而且很难联想到是弹簧的问题。
8. **「还原比例」被打折扣，八成是布局偷的，不是美术判断。** 先去量画板可用宽度，再去改美术。
9. **动效不能靠肉眼判断「动了没有」，也不能靠 CDP 往返采样。** 采样必须在页面内循环，判据用「相邻样本重复率」（驻留型动效 > 0.5，正弦只有 0.1–0.2）。

## 维护

- 通用层改完，检查适配层有没有引用到旧路径。
- 脚本改了行为，同步改对应 SKILL.md 里描述它的那一段 —— 文档和脚本不一致比没有文档更坏。
