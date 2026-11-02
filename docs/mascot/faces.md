# 内联 SVG 看板娘：表情与口型

> 对象：`chibi` / `haru` / `sora` 三个内联 SVG 造型（`src/lib/mascot.ts`）。
> 骨架角色（蕾西亚）不在本文范围，见 `docs/lacia-rig/README.md` §3.4。
> 共同的方法论在 `skills/mascot-studio/`，本文只记录「这三个造型现在是什么样、怎么验的」。

---

## 1. 判据：形状，不是偏移

看板娘实际渲染宽度约 150 px，一张脸 70 单位高。这个尺寸下：

- **偏移看不见**。眉抬高 2 单位、嘴宽 2 单位，截图上分不出，真人看也分不出。
- **轮廓看得见**。弯眉 / 平眉 / 垂眉、圆嘴 / 扁嘴 / 露齿、睁眼 / 闭眼，一眼就分得开。

所以判据不是「状态之间有没有差别」，而是**把每个状态可见的形状写成元组，两两不能相同**：

```
(眉, 嘴, 腮红, 眼睑)
```

只要两个状态的元组一样，它们就是同一张脸，无论代码里给了多少不同参数。
`docs/mascot/verify/faces.mjs` 就是把这句话变成断言的那段脚本。

这一条是被真实 bug 逼出来的：早先 `sleep` 用的是 `neutral` 眉 + `neutral` 嘴，参数写了七个，出来的是「闭着眼的思考脸」，和 `idle` 一模一样。

---

## 2. 五张脸

三个造型共用同一套类名，`mascot.css` 用 `[data-state]` 选形状：

| 状态 | 眉 | 嘴 | 腮红 | 眼睑 | 一句话 |
|---|---|---|---|---|---|
| `idle` | `neutral` 平 | `idle` 一条细弧 | 无 | 睁 | 默认脸 |
| `talk` | `neutral` 平 | `talk` 小竖椭圆 | 无 | 睁 | 正在说话 |
| `happy` | `raise` 抬 | `grin` 露齿 | 有 | ∩ 弧 | 笑 |
| `held` | `raise` 抬 | `pout` 竖圆 | 有 | 睁 | 被拎起来 |
| `sleep` | `drop` 垂 | `sleep` 下垂弧 | 无 | ∪ 弧 | 睡着 |

两处必须解释，因为都是「看起来该一样、实际必须不一样」：

**`held` 与 `happy` 共用抬眉和腮红**，唯一的区别是嘴（`pout` 竖椭圆 1.9 × 2.4 vs `grin` 露齿）。如果两者都用 `open` 嘴——最初的版本就是这样——它们就是同一张脸，而这两个状态在交互里差得很远：一个是「开心」，一个是被拖到半空。

**`sleep` 与 `happy` 都用闭眼，但弧的方向相反**：`happy` 是 ∩（笑眼，下眼睑上推），`sleep` 是 ∪（上眼睑落下）。两者都**不是**把睁眼压扁得到的——`scaleY(.07)` 会把睫毛和虹膜抹成一条带子，闭眼是画出来的曲线。

`idle` 是**兜底**而不是基础规则：未知状态（pack 的 `blink`、水合前的初始值）落到 `idle`，显示一张脸而不是空脸。

---

## 3. 三个造型的差异

| | 眉 | 说明 |
|---|---|---|
| `haru` / `sora` | 四款全有 | 左半绘制后镜像，`[outer, inner]` 两端 y 值 |
| `chibi` | **没有** | Q 版风格本来不画眉，硬加会破坏造型 |

所以 `chibi` 的元组退化成 `(嘴, 腮红, 眼睑)`。矩阵实测仍然 5/5 两两不同：

```
chibi  idle  mouth-idle   cheeks=off eyes=y
       talk  mouth-talk   cheeks=off eyes=y
       happy mouth-grin   cheeks=on  happy-arc
       held  mouth-pout   cheeks=on  eyes=y
       sleep mouth-sleep  cheeks=off shut-eye
```

`idle` 与 `talk` 靠嘴分，`talk` 与 `held` 靠嘴分，`held` 与 `happy` 靠嘴 + 眼分。
**这是刻意的取舍**：为了凑齐四个维度而给 Q 版加眉，是把判据当教条。判据是「可分辨」，不是「必须有眉」。

---

## 4. 嘴形：SVG 能真的「长成不同形状」

骨架角色的嘴是位图，六个变体各是一张 PNG，靠烘焙时的参数区分（见 `docs/lacia-rig/README.md` §3.4 的 `corner` / `rx` / `ry` / `dy` 四参数表）。

SVG 造型的嘴是 `<path>`，可以直接写成不同的贝塞尔，不需要参数化：

| 变体 | 画法 | 形状 |
|---|---|---|
| `idle` | `M96.6 104.4 Q100 107.6 103.4 104.4`，无填充 | 一条细弧 |
| `talk` | `M96 103.2 Q100 111.6 104 103.2 Q100 106 ...Z` | 竖椭圆，4.2 单位高 |
| `grin` | 更大的开口 + 内嵌一条白牙 | 露齿笑 |
| `pout` | `<ellipse rx=1.9 ry=2.4>` | 竖圆，比宽高 |
| `sleep` | `M96.8 105.4 Q100 108.4 103.2 105.4`，控制点偏下 | 下垂弧 |

`grin` 单独包一个 `<g>`，因为牙齿要跟着开口一起动（见 §5 的缩放）。

---

## 5. 口型：两个 CSS 变量

气泡文字是**一次性出现**的，没有逐字日程可跟，所以按 ~210 ms/字（中文口语 4–5 字/秒）推导一条日程，见 `src/lib/viseme.ts` 的 `scheduleForText()`。
每帧写两个变量到 `.mascot` 上，CSS 侧翻译成缩放，JS 不碰 DOM 树：

```
--ms-open   scaleY      1 = 原尺寸
--ms-wide   scaleX      1 = 原尺寸
```

```css
.mascot { --ms-grin: calc(1 + (var(--ms-open, 1) - 1) * 0.7); }
.ms-mouth-talk, .ms-mouth-grin { transform-box: fill-box; transform-origin: 50% 0; }
.ms-mouth-talk { transform: scale(var(--ms-wide, 1), var(--ms-open, 1)); }
.ms-mouth-grin { transform: scale(var(--ms-wide, 1), var(--ms-grin)); }
```

`transform-origin: 50% 0` 是「从顶边缩放 = 下唇下落」。从中心缩放会上下对称张开，读起来像吹气球。

### 5.1 幅度按渲染像素标定

第一版把 viseme 映射到 `0.55 + open × 0.8`，也就是 **0.55–1.17**——基准落在原尺寸之下，等于「她说话时嘴反而变小」。实测行程 1.77 px，在 2.5 px 高的嘴上几乎看不出。

现在的映射是 `REST 0.8 + open × 1.16`，即 **0.8–1.9**。上界由下巴决定，不是审美：

| 造型 | 嘴的绘制高度 | 嘴上沿 y | 下巴 y | 1.9× 时的下沿 | 余量 |
|---|---|---|---|---|---|
| `haru` / `sora` | 4.2 单位 | 103.2 | 117.6 | 111.2 | 6.4 |
| `chibi` | 3.2 单位 | 97.4 | 114（头圆 `cy+r`） | 103.5 | 10.5 |

`chibi` 的余量最大，因为它的嘴画得最小、头圆又低——所以上界对它是宽松的，对 `haru` 才是紧的。

实测（`deviceScaleFactor: 1`，150 px 宽）：

| 状态 | 嘴高范围 | 行程 | 说明 |
|---|---|---|---|
| `talk` | 2.53 – 5.10 px | **2.57 px** | `--ms-open` 0.80–1.61 |
| `happy` | 3.29 – 5.37 px | **2.08 px** | 露齿笑走 70% 行程 |

`grin` 压到 70% 而不是 100%：满幅 1.9 会把笑变成张大嘴。压 70% 后仍有 2.08 px 行程，读得出在说话。

**阈值定在 2 px 是刻意的**——「能测出来」和「看得出」是两件事。1.3 px 的行程在 20 ms 采样下是一条漂亮的曲线，在屏幕上是噪点。

---

## 6. 怎么验

两个脚本，都需要 dev server（`npm run dev`，默认 4321）。

### `docs/mascot/verify/faces.mjs` —— 三造型 × 五状态

```bash
node docs/mascot/verify/faces.mjs          # 只断言
node docs/mascot/verify/faces.mjs --shots  # 另存 .ref/look-<look>-<state>.png
```

直接 `import { mascotSvg }` 拿**出厂**标记，注入真实页面，所以被测的标记和 CSS 都是线上那份。Node ≥ 22.18 直接吃 `.ts`，无构建步骤。

判据：元组两两不同 + `sleep` 必须闭眼 + 其它状态必须有眼（睁眼或笑眼弧，「被替换」也算——笑眼不是睁眼，但空脸才是失败）。

### `docs/mascot/verify/lipsync.mjs` —— 嘴真的在动

```bash
node docs/mascot/verify/lipsync.mjs
BASE=http://localhost:4321 node docs/mascot/verify/lipsync.mjs
```

需要**固定页面** `/mascot-probe`（`src/pages/mascot-probe.astro`，仅 dev 存在，生产返回 404）：本站角落看板娘是骨架角色，没有任何线上路由渲染 SVG 造型，而口型逻辑在组件客户端脚本里，不像表情矩阵那样能靠 import 触发。

四条断言，彼此不可替代：

1. `--ms-open` 走过 ≥ 4 个不同值 —— 抓「线路是死的」
2. **嘴的渲染高度**变化 ≥ 2 px —— 抓「变量写了但没缩放」（选择器写错、少了 `transform-box`，第 1 条全过、这条全挂）
3. 台词结束后回到静止 —— 抓「嘴停在半张」
4. `talk` 与 `happy` 都测 —— 点击有 30% 概率进 `happy`，那是一条**不同的嘴**元素，只测一个会漏掉另一个哑掉

`Math.random` 在点击瞬间被钉住以确定性到达两个状态，点完立刻还原。

---

## 7. 已知取舍

- **`happy` 用笑嘴说话，不换成说话嘴**。骨架角色是「状态定基础表情 + viseme 在嘴上叠加」两条通道；SVG 造型是整张脸替换，`happy` 就只有笑嘴。让笑嘴跟着动是折中，不是正解。正解要把「表情」和「发声」拆成两套选择器，改动面比收益大。
- **汉字没有读音**。所有 CJK 用 code point 哈希出稳定伪元音：同句永远同动画，不同句不雷同。比「所有汉字给同一个中性值」好（那会让整句变成一条平线），但仍然不是真口型。
- **`--ms-wide` 的可见变化依赖台词里有没有窄元音**。中文一行可以全是中性元音，宽向几乎不动。所以脚本只断言它在合理区间内被写入，不断言行程。
- **`chibi` 没有眉**，见 §3。
- **`pack` 与骨架角色不走这条路径**：前者是一张平位图（部件级运动靠位移场，见 `src/lib/mascot-warp.ts`），后者自带嘴层与弹簧。
