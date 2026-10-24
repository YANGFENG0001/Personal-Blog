---
name: mascot-studio
description: 通用「看板娘 / 桌面角色」制作技能，不绑定任何具体项目。适用于任何需要「插画级角色站在页面角落」的场景：从找素材或生图、按参考图做严格还原、抠图去背、多状态设计、局部动态（头发飘/呼吸/头轻转）、打包成角色包、到验收上线。当用户说「做个看板娘」「角色不够还原」「要动漫插画级」「每个部位都要有动态」「加更多表情状态」时使用。产出物通过 adapter 一节对接目标项目的格式。
---

# 看板娘制作（通用）

本技能只讲**怎么做出一套能上线的角色**，不绑定具体站点。落到某个项目时看最后一节「Adapter」。

## 0. 先做三个判断（30 秒）

| 问题 | 结论 |
|---|---|
| 站主有**指定作品的角色**要还原吗？ | 走 §2「参考图还原」。**不要凭文字描述画**，必跑偏 |
| 有**现成的开放许可立绘**能用吗？ | 优先用现成的，省 10 倍成本。见 §1 |
| 站主只要「动漫插画级」、角色可原创？ | 走 §3「生图」+ §4「抠图」 |

> 版权：默认做原创。若站主明确说「这个角色我允许你用原形象二创，授权我自己解决」，照做，但在产物里如实写「同人二创 · 版权归原权利方」，**不要宣称已获授权**。站主已表态后不要再反复劝。

## 1. 用现成素材（最省成本）

- 来源：OpenGameArt（许可干净，CC0 多）、itch.io（VN 立绘质量高，但许可是作者自定义，必须读包内 `Rules.txt`）。
- **最大的坑：视觉小说立绘没有脚。** 行业惯例在裙摆/大腿处截断。判读方法：人物高度 ÷ 画布高度 ≈ 0.97 且画布宽高比 ≈ 1:2 → 半身；宽高比 1:2.8 ~ 1:3.5 → 大概率全身。
- 不要试图拼腿，画风对不上，很难看。换素材。
- 多状态必须**同画布、同站位、同比例**，只差表情。姿势每张都不同的话，只做单状态包。

## 2. 参考图还原（做「一模一样」时唯一靠谱的路）

文字描述会漂。**把参考图当图生图的 `image1`**，逐项锁死设计。

### 2.1 找参考图

优先官方设定三视图（正 / 背 / 四分之三），它比任何同人图都准。官网角色页通常有原图，直接抓：

```bash
curl -s -A "Mozilla/5.0" "https://<官网>/character/" -o p.html
grep -oE 'src="[^"]*\.(png|jpg)"' p.html | sort -u
```

拿到三视图后**裁出正视图**再当参考（整张三视图会让模型复刻分栏排版）：

```bash
node -e "require('sharp')('<三视图>.png').extract({left:38,top:0,width:230,height:527}).png().toBuffer()
  .then(b=>require('sharp')(b).trim({threshold:10}).toFile('ref-front.png'))"
```

### 2.2 拆设定卡

动笔写提示词之前，先把参考图**逐项拆成清单**。漏一项就会跑偏，而且返工成本高。以《BEATLESS》蕾西亚为例：

| 部位 | 设定 |
|---|---|
| 发 | 淡紫长直发、左侧一条细黑发饰、一缕细刘海垂在两眼之间 |
| 眼 | 冰蓝瞳、上睫毛锐利 |
| 颈 | 黑色高领 |
| 躯干 | 白色胸甲、黑色勾线、纵向中缝、胸口镂空 |
| 髋 | 白色花瓣状护板、髋部与大腿根裸露 + 细吊带 |
| 臂 | 黑色长手套包到指尖、尖指 |
| 腿 | 黑色大腿袜、外上侧开缺口 |
| 鞋 | 黑色高跟靴、鞋跟与鞋头带白 |

**这一步是整条流水线里性价比最高的。** 我第一次凭印象画成了「白外套 + 长裙摆」，方向就错了，怎么调都不像。

### 2.3 还原提示词骨架

```
Recreate the exact character design in the reference image, one single figure only.
Same face, same <发>, same <眼>, same <颈>, same <躯干>, same <髋>, same <臂>, same <腿>, same <鞋>.
<slim tall eight-head proportions, pale skin>

Render as ONE full-body anime illustration, front view, standing upright facing the viewer,
arms relaxed down at her sides, complete figure from head to shoes.
Polished modern anime illustration style, clean line art, soft cel shading,
the design itself must be identical to the reference.

The entire background is one perfectly flat solid magenta chroma-key colour #FF00FF,
absolutely uniform, no gradient, no shadow, no floor, no texture.
No text, no watermark, no additional figures, no design-sheet layout,
isolated single character, generous margin around the figure.
```

`image1` = 裁好的正视图，`input_fidelity: "high"`，`size: "1024x1536"`。

### 2.4 定点修正

一次生成很难全对。**只改错的那几项**，其余强调不许动：

```
Keep this exact same character, pose, body, outfit, hair, colours, proportions,
framing and flat magenta background completely unchanged. Fix only these details:
1. <问题一，写具体：the gloves must cover the hands, black gloved hands with pointed fingertips>
2. <问题二>
Do not move, rescale, recolor or restyle anything else.
```

蕾西亚第一次把**手套画成露出手**、**发饰做成两侧**，就是这样一次修好的。

### 2.5 二创扩展

还原版定稿后，以**还原版为 `image1`** 出变体，只换服装/场景：

```
Keep this exact same character — identical face, identical <发>, identical <眼>,
identical body proportions, identical pose and identical flat magenta background.
Change ONLY the outfit into <新造型描述>.
Same front view, standing upright, arms relaxed at the sides, complete figure from head to shoes.
...
```

这样多套造型并排时是**同一个人的几套衣服**，而不是几个人。这是判断二创是否合格的标准。

## 3. 生图（原创角色）

### 3.1 模型给不了真透明通道

`background: "transparent"` **不是透明**，它只是把一张棋盘格图案**画进画面**。实测 `sharp` 读出 `hasAlpha: false`，四角像素是 `234,231,229,255`（画上去的棋盘格）。

**所以必须让模型在纯色底上出图，再自己抠。**

### 3.2 提示词骨架（原创）

```
Professional anime character illustration, full body, standing upright facing the viewer,
complete figure from head to shoes. The entire background is one perfectly flat solid
magenta chroma-key colour, absolutely uniform, no gradient, no shadow, no texture.
Japanese visual novel character sprite style, <角色设定>.
No text, no watermark, isolated single character, generous margin around the figure.
```

底色的选择顺序：洋红 `#FF00FF` → 绿 `#00FF00` → 白 `#FFFFFF`（挑与角色配色差最大的）。洋红对肤色/白发/深色衣物最安全。

### 3.3 表情帧必须串行生成

用 `image1` + `input_fidelity: "high"` 改脸：

```
Keep this exact character, pose, body, clothing, hair, framing and flat magenta background
completely unchanged. Only change the face: <表情描述>.
Do not move, rescale or restyle anything else.
```

**每出一张立刻重命名。** 并行调两次会共用同一时间戳文件名，后一张把前一张覆盖掉（实测丢过一整张源图）。

## 4. 抠图（本技能最容易翻车的一步）

用 `scripts/chroma-key.mjs`：

```bash
node scripts/chroma-key.mjs in.png out.png [--check] [--drop-islands] [--no-trim]
```

- `--check` 合成到中灰上，边缘毛边一眼可见。**每张都要看，不要只看 exit code。**
- `--drop-islands` 剔除漂浮杂物（见 4.4）
- `--no-trim` 保留整画布，用于「同画布对比两张图」

### 4.1 按「背景色距离」，不要按洋红指标

`min(R,B) − G` 这种洋红度指标只在背景真是洋红时成立。模型经常漂到**酒红 `132,54,86`** 或**粉 `203,95,151`**，此时指标只剩 32，阈值窗口被压到 6–20，**浅紫/浅粉的头发会被整片吃掉**。

正确做法：

```
B = 左上/右上/左下三个角 2px 边框环的 RGB 中位数
d = 到 B 的欧氏距离
d <= lo → 全透明；d >= hi → 全不透明；中间线性过渡
lo = min(110, max(6, 三角最大距离 × 1.2 + 4))
hi = lo + 16          ← 窄过渡带，赛璐璐硬边不需要宽过渡
对 0 < a < 255 的像素反预乘：F = (C − (1−a)·B) / a
```

### 4.2 阈值估计踩过的三个坑（都别重犯）

1. **用整个边框环估噪声** → 人物头发/手臂贴边时噪声被顶到 130，`lo` 抬到 129，整幅人物进入半透明区，反预乘把洋红减过头，**淡紫头发变成薄荷绿**。
2. **改成只看四角** → 右下角正好压着「AI 生成」水印，白字又把阈值顶到上限。
3. **最终**：只看左上/右上/左下三个角（跳过水印区），**取最大值而不是 p95**——背景不是纯平涂，实测梯度差能到 72，用分位数会让远端背景残留半透明、永远裁不干净。

### 4.3 宽过渡带会留洋红晕

过渡带从 42 收到 16 之后边缘才干净。反预乘只能部分恢复边缘像素，宽过渡带 = 每个边缘像素都停在半路 = 一圈粉边。再加一道兜底：若恢复后仍偏洋红（`min(R,B) − G > 10`），朝绿色通道拉回。

### 4.4 水印与漂浮道具

| 脏东西 | 处理 |
|---|---|
| 右下角水印 | 水印是**不透明**的，抠不掉。把右下 `30% × 7.5%` 区域 alpha 强制置 0（人物够不到那个角） |
| 模型自作主张加的**漂浮道具** | **不能整块抹**——它常与头发同列，抹矩形会在头发上打洞（实测框内有 960 个主体像素）。按**连通域**算面积，只删面积 < 主体 10% 的碎片 |
| `sharp().trim()` 静默失效 | 半透明像素贴边时 trim 直接放弃（透明伞一定触发）。自己算 alpha 包围盒再 `.extract()` |

## 5. 画布对齐

逐帧抠图必然差 1–3px（一缕头发这帧出框、下帧没出），而多数打包器遇到画布不一致会**硬失败**。

```bash
node scripts/align-frames.mjs <输出目录> <角色名> <帧.png> ...
```

按 **alpha 包围盒底边贴齐 + 水平居中**合成到公共画布。底边对齐是关键：`baseline`（脚的位置）读的就是它，脚对齐了状态切换才不跳。

## 6. 局部动态

### 6.1 ⚠️ 图层叠加这条路，AI 生图走不通

想做「眼睛/嘴/头发各自独立成层」，标准做法是「底帧 vs 只改某部位的帧」做差异抠层。**实测做不到**：这个模型无法把「除目标部位外的部分」保持像素级不变，连阴影和线宽都会重画，差异散布全身 **2.14%**，切不出干净图层。

### 6.2 用位移贴图（已验证可行）

`feDisplacementMap` + 一张位移图，对**真实像素**做局部变形：**无接缝、无重影、不需要额外生成**，贴图为中性的区域完全不动。

```bash
node scripts/warp-map.mjs warp.config.json
```

```json
{
  "width": 585, "height": 1504, "out": "warp",
  "zones": [
    { "id": "hair", "shape": "sides",   "y": [0.02, 0.58], "edge": 2.4, "axis": "x", "amp": 1 },
    { "id": "head", "shape": "ellipse", "cx": 0.5, "cy": 0.09, "rx": 0.17, "ry": 0.09, "axis": "x", "amp": 0.8 },
    { "id": "body", "shape": "band",    "y": [0.34, 1.0], "axis": "y", "amp": 0.3 }
  ]
}
```

渲染侧串联，**每条用不同的 `dur`**，相位自然错开就有了「局部互相配合」的呼吸感：

```html
<filter id="warp" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">
  <feImage href="warp-hair.png" result="m1" preserveAspectRatio="none"/>
  <feDisplacementMap in="SourceGraphic" in2="m1" scale="0"
                     xChannelSelector="R" yChannelSelector="G" result="s1"/>
  <feImage href="warp-head.png" result="m2" preserveAspectRatio="none"/>
  <feDisplacementMap in="s1" in2="m2" scale="0"
                     xChannelSelector="R" yChannelSelector="G" result="s2"/>
  <feImage href="warp-body.png" result="m3" preserveAspectRatio="none"/>
  <feDisplacementMap in="s2" in2="m3" scale="0"
                     xChannelSelector="R" yChannelSelector="G" result="s3"/>
</filter>
```

### 6.3 三个必踩的坑

1. **滤镜之间必须用 `result` 名字引用，不能用 `id`。** 写成 `in="d1"`（id）会让链断掉，输出变成位移图本身——整块画面会变成**橄榄绿**（位移图中性值 `128,128,0`）。这个现象很好认。
2. **`filter` 引用失败时元素可能整个不渲染。** 绝不能把 `filter: url(#x)` 直接写进 CSS——一旦 SVG 没注入或图没加载，看板娘会**整块消失**。必须由 JS 在确认 SVG 已插入后再挂 class。
3. **宿主元素往往已经有 `drop-shadow` filter。** 位移 filter 会把它覆盖掉，所以要挂在内层包裹元素上，或者把阴影并进同一条滤镜链（末尾加 `feDropShadow`）。

幅度建议：`scale` 在 ±4 ~ ±12 之间（相对渲染后的 CSS 像素）。超过 ±16 会开始显得像果冻。

### 6.4 更进一步：贴图不必预生成，运行时按锚点画出来

预生成 PNG 的问题是「一个角色一套贴图」，角色包一换就得重出。但位移场其实只依赖两个锚点——**头顶位置**和**脚底线**，这两个值任何角色包都有。所以可以直接在浏览器里用 canvas 画贴图，`toDataURL()` 塞进 `feImage`：

```js
// R = 水平位移，G = 垂直位移，128 = 不动
data[o] = 128 + Math.round(127 * dx);
data[o + 1] = 128 + Math.round(127 * dy);
image.setAttribute('href', canvas.toDataURL('image/png'));
```

`feImage` 的三种引用方式在 Chromium 下都实测可用（外部 URL / data URI / 文档内片段 `#id`）。**优先用 data URI**：不用管跨域、不用管文件路径，角色包导入后立即生效。

每个区一个 `feDisplacementMap`，用 `requestAnimationFrame` 改 `scale` 属性（30fps 足够；纯正弦显得机械，叠一点二次谐波和一条很慢的项）。

**三个区，不是四个。** 曾经加过一个「裙摆」区，结果它把腿横向平移——穿连身衣的角色看起来像被人在拖着走。胯以下一律不动。

| 区 | 轴 | 幅度（占渲染宽度） | 周期 | 作用 |
|---|---|---|---|---|
| head | 水平（绕**颈部**旋转） | 0.012 | 7s | 头部轻转 |
| hair | 水平（脸部中线为零） | 0.026 | 7s，相位滞后 0.6rad | 头发跟随 |
| torso | 垂直 | 0.013 | 4.8s | 呼吸 |

三条关键取值理由：

- **周期要和宿主样式表里的整身摇摆一致。** 本项目整身 rotate 是 7s，位移区也用 7s，头和身体才是一套动作。各自用 5.4 / 7.2 / 5.9 这种「互质周期」看着不呆板，实际读起来是三个东西各晃各的——**互质周期 ≠ 互相配合**。
- **头的幅度要小。** 真实站立时头相对稳定，动的应该是头发。幅度开大（0.019 以上）像在左右张望，不像呼吸。默认尺寸下 0.012 大约是 4° 的头顶行程。
- **呼吸只到腰。** 一路开到胯会把骨盆抬离双腿，看起来是腰在被拉长。

### 6.5 位移场的形状：三个反直觉的地方

1. **头的旋转支点在颈部，不在头心。** 用头心做支点，头顶和下巴会反向等幅移动，那是**剪切**，看起来像整颗头被斜着推。支点下移到脖子，头顶大幅摆、下巴几乎不动，才是转头。

2. **旋转场的权重不能从中心往外衰减。** 写成 `w = 1 - smoothstep(0.55, 1, r)` 会让**头顶（r=1）权重为 0**——只剩头心周围一圈在动。正确写法是「头内权重恒为 1，只在头外淡出」：`w = 1 - smoothstep(0.92, 1.45, r)`。

3. **头发场在脸部中线必须为零。** 一开始写成「中间满幅、两侧衰减」，结果**整张脸被横向推走**——脸的辨识度最高，一眼就看出不对。正确形状是反向的凹槽：`smoothstep(0.045, 0.145, |u - hx|)`，中线为零、两侧满幅。

**而且头发区必须停在肩膀上方。** 位移场只是 `(u, v)` 的函数，**分不清头发和它后面同列的手臂**。头发一直垂到腰的角色，把场延伸到腰就等于把手臂一起摆。这是这个方法的硬边界，不是调参能解决的。

4. **每个场都要在自己区域的边界上收敛到 0**，否则留一道折痕。所以纵向轮廓用中间高两头为 0 的鼓包 `sin(π·p)^0.65`，不能用单调函数。

5. **能力探测别写错对象。** `createImageData` 在 `CanvasRenderingContext2D.prototype` 上，不在 `HTMLCanvasElement.prototype` 上。写错的后果是**静默返回 null，动效完全不生效，控制台一个错都没有**。

6. **贴图要覆盖「滤镜区域」而不是「元素盒子」。** 滤镜区域默认带内边距（`x="-6%" width="112%"`），`feImage` + `preserveAspectRatio="none"` 会把图铺满整个区域。生成贴图时要把像素坐标反向换算回元素坐标，否则所有区域整体偏移、比例也不对：

   ```js
   const u = ((x + 0.5) / w) * (1 + 2 * PAD_X) - PAD_X;
   const v = ((y + 0.5) / h) * (1 + 2 * PAD_Y) - PAD_Y;
   ```

### 6.6 让动效对状态有反应

只用一个恒定幅度跑到底，看久了就是「一个在匀速摆的东西」。留一个 `setEnergy(k)` 接口，内部对幅度做缓动（τ ≈ 0.3s）：

| 状态 | energy | 观感 |
|---|---|---|
| idle | 1.0 | 常态 |
| sleep（深夜久无操作） | 0.4 | 几乎不动，只剩呼吸 |
| held（被拖动） | 1.7 | 被拎起来，头发甩得厉害 |

缓动别写太慢：0.05/帧 时被拎起来要两秒才到位，看起来像渐变而不是反应。

顺带一个坑：拖动时那句台词如果带 3.4s 的计时器，计时结束会把状态退回 `idle`，**幅度在半空中掉回去**。回退目标要判一下「是不是还在拖」：`setDragging ? 'held' : 'idle'`。

### 6.7 验证方法（血泪）

**一、必须把背景隔离掉。** 主题背景里的粒子一直在动，不隔离的话「关掉形变」的对照组差异比「打开形变」还大，结论完全反过来。给角色垫纯色 `background`，或清空页面只留一张图。

**二、必须只留 idle 帧。** 眨眼是另一张图，换帧时全身都会「变化」，会把分带统计整个污染掉——排查半天以为是位移场漏到了脚上，其实是眨眼。测之前 `document.querySelectorAll('.mascot-frame:not([data-frame="idle"])').forEach(n => n.remove())`。

**三、先测技术底噪，再判断场设计。** 这一条最省时间：`feDisplacementMap` 只要 `scale ≠ 0`，即使贴图**完全是中性**（128,128,128），也会让约 1% 的边缘像素发生变化（8 位下 128/255 = 0.50196，偏差 `scale × 0.00196`，再叠上滤镜重采样）。边缘密集的区域（比如细白描边的鞋）能到 5%。

所以正确的顺序是：**先用全中性贴图跑一遍，量出每个分带的底噪**，再和真实贴图对比。本项目的实测：

```
             真实贴图   全中性贴图（底噪）
头            12.6%        0.0%
上身           2.3%        1.2%
腰腿           0.0%        0.0%
脚             5.4%        5.4%   ← 全部是底噪
```

脚部那 5.4% 和中性贴图一模一样，说明它**根本不是位移**。不要追这个数字，放大两倍肉眼看鞋底是完全静止的。**以放大后的肉眼判断为准，不要以像素统计为准。**

**四、对照组的数字必须是 0.00%**，不是 0.00% 就说明还有别的东西在动（背景、换帧、整身 CSS 动画没关干净）。

性能：3 级滤镜、30fps 更新，实测页面帧间隔 p50/p95 = 16.7/16.8ms，和关闭时**完全一致**，Chromium 走 GPU 合成。放心用。

## 7. 状态设计

### 7.1 必备与可选

| 状态 | 用途 | 必需 |
|---|---|---|
| `idle` | 默认 | ✅ |
| `talk` | 说话/点击（睁眼开口） | 建议 |
| `happy` | 彩蛋、读完文章（闭眼笑） | 建议 |
| `blink` | 眨眼（只差眼睛） | 建议，成本最低的「活着」信号 |
| `held` | 被拖动（惊讶、手脚悬空） | 可选 |
| `sleep` | 深夜久未操作 | 可选 |

缺失状态**优雅回退到 `idle`**，所以单状态包也是合法交付。

### 7.2 想要几十个状态，靠组合而不是靠生成

每个状态单独生成一张 = 每张 5–10 credits。几十个状态乘几个角色就不可承受。

正确做法是**部件组合**：`眼(4) × 嘴(4) × 腮红(2) = 32` 种表情，只多生成 3 张变体帧。

但注意 §6.1：AI 生图切不出干净部件层，所以组合只能落在**整帧切换**上——即每种组合仍是一张完整帧。**组合的收益只有在你能稳定切层时才成立。**

现实建议：**6–10 个状态**用整帧；再多就先确认站主愿意为生成量付费，并明确告知成本。

### 7.3 状态在小尺寸下会「看不出」

全身立绘缩到 300px 高时脸只有约 40px，`talk` 和 `happy` 只差嘴型，肉眼几乎看不出。**状态切换的主要反馈是气泡台词，不是表情。** 要看清表情就调大 `display.height` 或减小 `crop`（只显示上半身）。

## 8. 验收（不要只看 HTTP 200）

```js
const info = await page.evaluate(() => {
  const root = document.querySelector('[data-mascot], .mascot');
  const img = root.querySelector('img');
  const r = root.getBoundingClientRect();
  const ir = img.getBoundingClientRect();
  return {
    kind: root.dataset.kind,
    w: Math.round(r.width), h: Math.round(r.height),
    bottom: Math.round(r.bottom), vh: innerHeight,
    natural: img.naturalWidth + 'x' + img.naturalHeight,
    // 被压扁 = 渲染宽高比与图片本身不一致
    ratioOk: Math.abs(ir.width / ir.height - img.naturalWidth / img.naturalHeight) < 0.02,
  };
});
```

验收标准：

- `kind` 是角色包（不是回退到内置角色）
- `bottom === vh`（脚正好落在视口底边，不留缝）
- `ratioOk === true`（没被压扁）
- 点击后状态切到 `talk`、气泡有字
- 侧栏/正文文字没被人物压住（量一下文字右边界 vs 人物左边界，**用文字元素而不是容器**，容器外框相交是假警报）

### 两个假信号

1. **`?theme-preview=` 之类的前缀参数不会真的切换主题。** 角色包通常绑定在「当前预设」上，必须改真实设置。
2. **入场动画期间量尺寸是错的。** 常见入场是 0.6s 延迟 + 0.9s 时长，量早了会读到「还在往上滑」的位置，表现为底部莫名留 17px 缝。等 2s 再量。

## 9. 导入：不要重置站主密码

管理接口要站主会话。**不要为了导入去重置密码**——那会把站主所有设备踢下线。直接写库，或让站主在后台点导入。

写库时要复刻接口的全部行为，最容易被忽略的是**上传文件名的格式约束**（如必须 24 位 hex + 扩展名，正则卡死长度）和**用 `original_name` 反推状态名**。见 `scripts/import-pack.mjs`。

## 10. 交付清单

- [ ] 角色包已导入，后台能看到
- [ ] 前台截图证明：包生效、`bottom === vh`、比例未压扁、点击有台词
- [ ] 每张帧都过了 `--check` 灰底预览，无洋红晕、无缺角、无水印
- [ ] 多帧画布尺寸一致
- [ ] **局部动效已实测**：对照组差异为 0.00%、头发/头肩有变化、鞋底放大两倍看不出抖动
- [ ] `author` / `license` 与真实来源一致（同人二创要写明版权归原权利方）
- [ ] 来源说明写进仓库：参考图出处、做了哪些改动、哪些是二创
- [ ] 告诉站主怎么换回别的角色

## Adapter：对接具体项目

本技能的产物是**一组对齐好的透明 PNG 帧 + 一个清单**。落到目标项目时只需回答四个问题：

1. **打包格式**：帧怎么组织成文件？（本项目用 `.mascot.zip` + `mascot.json`，见 `scripts/build-pack.mjs`）
2. **状态名**：目标项目认哪些状态名？把不认识的映射过去或裁掉。
3. **挂载点**：渲染在哪个容器、用什么 class/dataset 切换状态？
4. **尺寸与锚点**：渲染高度、裁剪、气泡指向点怎么表达？

具体的 FIELDNOTES 适配见 `skills/fieldnotes-mascot-sourcing/SKILL.md`。
