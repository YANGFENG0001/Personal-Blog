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
| 做一套站点主题：配色、日夜、场景、验收 | `theme-studio` |
| 把角色/主题装进 FIELDNOTES 这个站 | `fieldnotes-*` |

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

技能靠 `SKILL.md` 头部的 `name` / `description` 被发现，所以复制过去不需要改任何路径（脚本按相对路径 `scripts/…` 引用）。

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

## 这套技能里最值钱的几条结论

写在这里，免得只看目录的人漏掉：

1. **做「一模一样」必须用参考图当图生图底稿。** 纯文字描述一定漂移。先把参考图拆成逐项设定卡，再写提示词。
2. **生图模型给不了真透明通道。** `background: "transparent"` 只是把棋盘格画进画面。必须纯色底 + 自己抠。
3. **AI 生图切不出干净图层。** 「底帧 vs 只改眼睛的帧」做差异，实测差异散布全身 2.14%，无法分层。想要局部动态就用位移贴图，不要试图做 Live2D 式拆件。
4. **抠图的阈值要覆盖背景梯度的全部范围**，用分位数或均值都会在远端留下半透明残留，最后表现是「头发变色」或「永远裁不干净」。
5. **验收时量尺寸要等入场动画结束**，否则会读到「还在往上滑」的位置，表现为底部莫名留缝。

## 维护

- 通用层改完，检查适配层有没有引用到旧路径。
- 脚本改了行为，同步改对应 SKILL.md 里描述它的那一段 —— 文档和脚本不一致比没有文档更坏。
