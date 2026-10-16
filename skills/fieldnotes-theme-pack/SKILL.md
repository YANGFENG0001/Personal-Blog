---
name: fieldnotes-theme-pack
description: Use when creating assets or theme files for a FIELDNOTES blog — mascot (看板娘) character packs, background layers, stickers, particles, cursors, theme covers, or a complete .theme.json theme (配色/字体/背景/贴纸/自定义 CSS). Covers exact asset specs, image-generation prompt rules (no fake transparency), the mascot pack and theme JSON formats, CSS limits, and how to validate before handing over.
---

# FIELDNOTES 主题与看板娘素材制作规范

FIELDNOTES 是一个个人研究博客，支持**主题包**（全站外观）和**看板娘角色包**。本技能告诉你：要产出哪些文件、每个文件的规格、怎样写生图提示词、怎样打包和自检。

产出物最终由站主导入网站，处理流程如下：

```
生图模型 / 手绘  →  素材工作室（tools/asset-studio，本地）抠图·修补·压缩·打包  →  网站后台导入
```

## 0. 最重要的规则（必读）

1. **绝不要让生图模型输出“透明背景”。** 模型会把灰白棋盘格*画*进图片里（假透明），上传后会变成一个方块。
   - 角色、贴纸、粒子、光标：用**纯色背景**。
     - 首选：`纯绿色背景 #00FF00`。
     - 角色身上有绿色时：用 `纯洋红 #FF00FF`。
     - 以上都不行时：用 `纯白 #FFFFFF`。
   - 不要阴影，不要地面，不要渐变，人物和背景之间要有清晰的边界。
   - 抠图交给素材工作室完成（`node cli.mjs matte …`）。
2. **不要文字、字母、数字、Logo、水印、签名、边框。**
3. **原创形象。** 不要复刻任何现成作品里的角色；人物设定为成年人。如果站主明确要用某个作品的角色，需要提醒站主自己确认授权。
4. **同一角色的多个状态图**必须满足：
   - 同画布尺寸、同站位、同比例、同光源方向。
   - 只改**表情和手势**，不改服装和发型。
   - 最稳妥的做法：先生成 idle，再用“基于这张图修改表情”的方式生成其它状态。
5. **背景图要给正文留出阅读空间**：左侧约 60% 保持低对比、少细节，视觉主体放在右侧或底部。日间和夜间各出一张。

## 1. 素材规格表

| 素材 | 用途 | 生成尺寸 | 交付格式 | 交付尺寸 / 体积 | 透明 |
| --- | --- | --- | --- | --- | --- |
| 看板娘状态图 ×1–6 | 页面角落的角色 | 1024×1536（竖） | 角色包 `.mascot.zip` | 工作室自动输出 高 720 的 WebP | 需要（工作室抠图） |
| 背景图层 | 全屏背景，可叠多层 | 1920×1080 或 2560×1440 | WebP | 宽 1920，≤ 400 KB | 不需要；远景、前景层可以透明 |
| 夜间背景 | 同上，夜晚版本 | 同上 | WebP | 同上 | 同上 |
| 贴纸 | 标题旁、卡片角、分隔线、页脚、空状态、侧栏 | 每个 512×512，或一张多元素合集 | WebP / PNG | ≤ 320 px，≤ 60 KB | 需要 |
| 粒子小图 ×1–4 | 飘落、上浮、闪烁的花瓣 / 叶子 / 雪花 | 256×256 | PNG / WebP | ≤ 64 px | 需要 |
| 光标 | 主题鼠标 | 256×256 | PNG | 32×32 | 需要 |
| 字体 | 标题 / 正文 | — | woff2 | 中文建议子集化后 ≤ 2 MB | — |
| 主题封面 | 主题卡片 | 1280×720 | WebP | 宽 640 | 不需要 |

贴纸合集：在一张纯色背景图上放多个**彼此分开、不重叠**的元素，再用 `node cli.mjs split 合集.png 输出目录/` 自动切成单张。

## 2. 看板娘角色包（`.mascot.zip`）

### 2.1 文件结构

```
我的角色.mascot.zip
├─ mascot.json
├─ idle.webp      必需
├─ talk.webp      可选：说话 / 点击时
├─ happy.webp     可选：开心（彩蛋、读完文章）
├─ held.webp      可选：被拎起（拖动中，常见为惊讶 + 手脚悬空）
├─ sleep.webp     可选：睡觉（深夜久未操作）
└─ blink.webp     可选：闭眼帧（用于眨眼，和 idle 只差眼睛）
```

推荐直接用工作室生成角色包：把 `idle.png`、`talk.png`……放进一个目录，再运行：

```bash
cd tools/asset-studio && npm install
node cli.mjs mascot 角色目录/ 角色名.mascot.zip --name 角色名 --display full
node cli.mjs check 角色名.mascot.zip
```

台词放在同目录的 `lines.json`，格式见 2.2 节里的 `lines` 字段。

### 2.2 mascot.json

```json
{
  "format": "fieldnotes-mascot@1",
  "name": "小春",
  "author": "作者名",
  "license": "原创 / CC BY 4.0 / 已获授权……",
  "width": 360, "height": 720,
  "states": { "idle": "idle.webp", "talk": "talk.webp", "blink": "blink.webp" },
  "anchors": { "baseline": 1, "bubble": [0.62, 0.04], "head": [0.5, 0.12] },
  "display": { "mode": "full", "height": 240, "flip": false, "shadow": true, "outline": "soft" },
  "motion": { "breathe": true, "sway": true, "swing": true, "blinkEvery": 5 },
  "lines": {
    "click":   ["今天也一起读一点吧。", "慢慢读就好。"],
    "morning": ["早上好！"], "noon": [], "evening": [], "night": ["夜深了，早点休息。"],
    "home": [], "article": ["这一段写得真好。"], "notFound": ["这里好像什么都没有……"],
    "readEnd": ["读完啦！"], "drag": ["哇——"], "drop": ["放好啦。"], "reset": ["回到老位置啦。"]
  }
}
```

字段规则：

- `width` / `height`：所有状态图共同的画布尺寸。工作室会自动对齐。
- `anchors`：都是 0–1 的比例。
  - `bubble`：对话气泡指向的位置。
  - `head`：头部中心，“探头”模式会用到。
  - `baseline`：脚底的位置。
- `display.mode`：
  - `full`：全身。
  - `bust`：半身，下半部分渐隐。
  - `peek`：只从屏幕边缘探出头。
- 每句台词 ≤ 60 字，每组 ≤ 40 句。没填的组会回退到 `click` 组。

## 3. 主题文件（`.theme.json`）

主题**只有数据，没有代码**：

- 它继承一个内置主题（`base`），只写需要覆盖的部分。
- 素材地址只能是 `/uploads/…`（站主上传后得到的路径）或 `https://…`。
- 交付时把 `.theme.json` 和所有引用到的素材文件一起给站主。站主先上传素材，把 JSON 里的路径替换成上传后的 `/uploads/…`，再导入。

### 3.1 完整示例

```json
{
  "format": "fieldnotes-theme@1",
  "name": "苔绿研究室",
  "description": "苔绿与木色，晨雾森林前的研究桌。",
  "author": "你的名字",
  "version": "1.0.0",
  "base": "forest",
  "palette": {
    "light": { "bg": "#f3f5ec", "surface": "#fcfdf7", "ink": "#24301f", "muted": "#53604b", "faint": "#5f6b57",
               "line": "#dfe5d3", "pane": "#eaeedf", "accent": "#4a6b2c", "tint": "#e4ecd6" },
    "dark":  { "bg": "#111712", "surface": "#18201a", "ink": "#e3eadf", "muted": "#a9b5a3", "faint": "#909c8a",
               "line": "#2a352b", "pane": "#1d261f", "accent": "#a7cf8a", "tint": "#25331f" }
  },
  "typography": { "display": "serif", "body": "sans", "scale": 1, "lineHeight": 2, "headingWeight": 700, "letterSpacing": 0.02 },
  "shape": { "radius": "soft", "border": 1, "shadow": "paper", "density": "comfortable" },
  "background": {
    "use": "layers",
    "layers": [
      { "kind": "gradient", "from": "#eef3e6", "to": "#dfe9d4", "angle": 180 },
      { "kind": "image", "src": "/uploads/xxxx.webp", "srcDark": "/uploads/yyyy.webp",
        "position": "bottom-right", "size": "width", "opacity": 1, "depth": 0.2 },
      { "kind": "texture", "texture": "paper", "opacity": 0.6 }
    ],
    "readingPanel": 0.9, "blur": 6
  },
  "particles": { "use": "image", "images": ["/uploads/leaf1.webp", "/uploads/leaf2.webp"], "motion": "fall", "count": 24, "speed": 0.8, "size": 18 },
  "stickers": [
    { "slot": "hero", "src": "/uploads/ink-drop.webp", "size": 96, "opacity": 0.9, "rotate": -6 },
    { "slot": "empty", "src": "/uploads/bookmark.webp", "size": 120 }
  ],
  "cursor": { "src": "/uploads/leaf-cursor.png", "hotspot": [4, 4] },
  "eggSet": "nature",
  "mascot": "haru",
  "css": ".post-title { letter-spacing: .02em; }"
}
```

### 3.2 字段取值

| 字段 | 取值 |
| --- | --- |
| `base` | `ink` 墨韵、`nature` 自然、`ocean` 海洋、`anime` 二次元、`starry` 星夜、`paper` 纸张、`minimal` 极简、`eyecare` 护眼、`forest` 森林、`meadow` 草原、`summer` 夏日物语、`sakura` 樱花坂、`tenki` 晴空之子 |
| `palette.*` | 9 个键都必须是 `#rrggbb`；可以只写 `light` 或只写 `dark` |
| `typography.display` / `body` | `serif`、`sans`，或 `custom`（同时要给 `displayFont` / `bodyFont`，值为 woff2 地址） |
| `typography.scale` | 0.85–1.25 |
| `typography.lineHeight` | 1.4–2.4 |
| `typography.headingWeight` | 400–900 |
| `typography.letterSpacing` | -0.02–0.12（单位 em） |
| `shape.radius` | `sharp`、`soft`、`round` |
| `shape.shadow` | `none`、`soft`、`paper`、`lifted` |
| `shape.density` | `compact`、`comfortable`、`spacious` |
| `shape.border` | 0–3 |
| `background.layers[].kind` | `image`、`gradient`、`texture`（取值 `paper`、`dots`、`grid`）、`scene`（取值 `ocean`、`forest`、`meadow`、`nightsky`、`summer`、`sakura`、`tenki`）；最多 6 层，从下往上叠 |
| `background.layers[].position` | `center`、`top`、`bottom`、`left`、`right`、`top-left`、`top-right`、`bottom-left`、`bottom-right` |
| `background.layers[].size` | `cover`、`contain`、`auto`、`width` |
| `background.layers[].blend` | `normal`、`multiply`、`screen`、`overlay`、`soft-light` |
| `background.layers[].depth` | 0–1，视差强度 |
| `background.layers[].drift` | `none`、`slow`、`medium` |
| `background.layers[].mode` | `both`、`light`、`dark` |
| `background.readingPanel` | 0.6–1，正文底板的不透明度；有图片背景时建议 ≥ 0.85 |
| `particles.use` | `inherit`、`none`、`builtin`（配合 `effect`：`particles`、`sakura`、`leaves`、`bubbles`、`stars`、`waves`、`fireflies`、`snow`）、`image` |
| `particles.motion` | `fall`、`rise`、`drift`、`twinkle` |
| `particles.count` | 4–80 |
| `stickers[].slot` | `hero`、`card-corner`、`divider`、`footer`、`empty`、`sidebar`；每个位置只能放一个 |
| `eggSet` | `ink`、`nature`、`ocean`、`anime`、`starry`、`paper`、`minimal`、`eyecare`、`summer`、`sakura`、`tenki` |
| `mascot` | `haru`、`sora`、`chibi`，或 `pack:<id>`（站主导入角色包后得到的 id） |

### 3.3 配色硬性要求（不满足会在后台被标红）

- `ink` 与 `bg` 的对比度 ≥ 7（正文）。
- `muted` 与 `bg` 的对比度 ≥ 4.5。
- `faint` 与 `surface` 的对比度 ≥ 4.5。
- `accent` 与 `bg` 的对比度 ≥ 3。
- 夜间的 `accent` 应该比日间更亮、更浅，不要直接照抄日间的颜色。

## 4. 自定义 CSS（`css` 字段）

优先使用配置项；只有配置项做不到的效果才写 CSS。CSS 会被自动检查，并且限定在本主题内生效：每条规则前面会自动加上 `html[data-custom-theme]`。

**会被拒绝**的写法：

- `@import`、`expression()`、`javascript:`、`behavior`、`-moz-binding`、`<style>` / `<script>`。
- 非 `/uploads/…` 的 `url()`。只有 `data:image/...` 的内联图片除外。
- 在 `html` / `body` / `main` 上使用 `display:none`、`visibility:hidden` 或 `opacity:0`。
- 覆盖全屏的 `position:fixed` 层却没有写 `pointer-events:none`。
- `z-index` ≥ 1000。
- 花括号、引号或注释不成对。
- 总长度超过 20000 字符。

**会被忽略**（只给出警告）的写法：选择器涉及工作台（`.owner*`）、`.preview-ball`、`#main`、`.skip-link`。

可用的颜色变量：`--bg`、`--surface`、`--ink`、`--muted`、`--faint`、`--line`、`--pane`、`--accent`、`--tint`。

常用选择器：`.hero`、`.post`、`.post-title`、`.site-header`、`.site-footer`、`.sidebar`、`.prose`（文章正文）、`.prose blockquote`、`.block-head`、`.site-card`、`.empty`。

## 5. 提示词模板

`prompts/` 目录下有逐类的模板，`{花括号}` 里的内容需要替换：

- `mascot-states.md`：角色设定和 6 个状态图，含“基于 idle 修改表情”的写法。
- `background-layers.md`：日间 / 夜间背景，以及远景、中景、前景分层。
- `stickers-particles-cursor.md`：贴纸合集、粒子、光标。
- `theme-cover.md`：主题封面。

## 6. 交付前自检清单

- [ ] 所有角色、贴纸、粒子图都是纯色背景（不是假透明格子），并且已经用工作室抠好。
- [ ] 角色各状态图同尺寸、同站位；`node cli.mjs check xxx.mascot.zip` 通过。
- [ ] 背景图日间和夜间都有；左侧正文区低对比；WebP ≤ 400 KB。
- [ ] 配色满足第 3.3 节的对比度要求。
- [ ] `.theme.json` 里的素材路径都是 `/uploads/…` 或 `https://…`，并且附上了全部素材文件和一份清单：说明每个文件对应 JSON 里的哪个字段。
- [ ] 自定义 CSS 已经在后台“主题工作室 → 自定义 CSS”里显示“检查通过”，或者确认没有使用第 4 节禁止的写法。
- [ ] 没有文字、水印和现成作品的角色；授权信息已写进 `author` / `license`。
