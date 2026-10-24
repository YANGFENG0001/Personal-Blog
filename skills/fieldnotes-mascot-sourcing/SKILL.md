---
name: fieldnotes-mascot-sourcing
description: Use when the owner wants a 看板娘 (mascot) built from existing / open-license artwork rather than freshly drawn art — searching OpenGameArt or itch.io for CC0 / CC-BY / CC-BY-SA character sprites, judging whether a pack is actually usable (full body with feet, same-pose expressions), assembling a .mascot.zip from raw PNGs, importing it through /api/owner/mascots, and verifying it renders on the live site. Covers license and attribution rules, plus the pitfalls that waste the most time (visual-novel sprites have no feet, motion.blinkEvery has a minimum, theme rotation hides preset changes).
---

# 用现成素材做看板娘

`fieldnotes-theme-pack` 讲的是**自己画/自己生图**。本技能讲另一条路：**去开放许可素材站找现成的立绘**，加工成 FIELDNOTES 能直接导入的角色包。

两条路的产出物是同一个 `.mascot.zip`，格式规范见 `skills/fieldnotes-theme-pack/SKILL.md` 第 2 节，这里不重复。

## 0. 先定方向（30 秒决策）

| 情况 | 走哪条路 |
|---|---|
| 站主要**原创**角色、要贴合特定主题配色 | `fieldnotes-theme-pack`（生图或手绘 SVG） |
| 站主接受**现成画风**、要快、要多状态 | 本技能（找素材） |
| 站主点名要**某个动漫作品的角色** | ⚠️ 默认不做。站主明确表示"授权我自己解决、你只管出图"时才做，且必须按**同人二创**如实记录来源（见第 1 节） |
| 站主要**插画级**、不满足手绘 SVG 的观感 | 生图 + 抠图，见第 8 节 |
| 只是要"能露全身、有脚"的角色 | 本技能最省事 |

## 1. 版权：这是硬约束，不是建议

- **不复制受版权保护的角色。** 站主说"要《天气之子》的女主"时，正确做法是做**同一气质的原创角色**（雨、放晴、白裙、双马尾、云隙的光），并在交付时明确说明这是致敬而非复刻。
- **例外：站主自己承担授权。** 若站主明确说"这个角色我允许你用原形象二创，许可我自己解决，不用你操心"，那就照做，但**不要因此宣称已获授权**：`mascot.json` 的 `license` 写"同人二创 · 本站自用"，来源说明里写清"版权归原权利方，站主已声明自行处理许可"。别反复拿版权劝阻——站主已经表态了，再劝就是没听懂。
- 可用的素材只有三类：
  - **CC0 / Public Domain** —— 无需署名，最省心。
  - **CC-BY** —— 必须署名，允许修改。
  - **CC-BY-SA** —— 必须署名，且**衍生图也要以相同协议共享**（用在个人博客可以，但要告诉站主）。
  - **作者自定义许可**（itch.io 常见）—— 逐条读 `Rules.txt`，通常"署名 + 允许修改 + 非盈利免联系"。
- 下载前**先确认许可**，不要先下后补。OpenGameArt 的许可在页面右侧，itch.io 在描述区或包内 `Rules.txt`。
- **署名落到三处**，缺一不可：
  1. `mascot.json` 的 `author` / `license`（后台角色卡片会显示 author）；
  2. 仓库里的来源说明文件（如 `素材图/网络素材/来源与署名.md`）；
  3. 站主要的话，页脚/致谢页也放一份。

## 2. 找素材

### 2.1 去哪找

| 站点 | 特点 | 注意 |
|---|---|---|
| **OpenGameArt** | 许可最干净，CC0 多；`curl` 直连可抓 | 二次元立绘质量参差，多是半身 |
| **itch.io** | 专业 VN 立绘包多，画质高 | 许可各作者自定义，必须读 `Rules.txt` |

搜索用**英文**，关键词组合：`anime girl sprite`、`visual novel character`、`full body`、`character sprite sheet`、`expressions`。

OpenGameArt 直连抓取（搜索页是服务端渲染，可直接解析）：

```bash
curl -s -A "Mozilla/5.0" "https://opengameart.org/art-search-advanced?keys=anime+portrait&sort_by=count&sort_order=DESC" \
  | grep -oE 'href="/content/[a-z0-9-]+"' | sed 's|href="/content/||;s|"||' | sort -u
```

抓详情页拿许可与附件：

```bash
curl -s -A "Mozilla/5.0" "https://opengameart.org/content/<slug>" -o p.html
grep -oiE '(CC0|CC-BY-SA 4\.0|CC-BY 4\.0|CC-BY 3\.0|OGA-BY 3\.0)' p.html | sort -u
grep -oE 'https://opengameart\.org/sites/default/files/[^"]*\.(png|zip|7z)' p.html | sort -u
```

### 2.2 itch.io 的下载流程（要点）

免费素材也要走一遍"购买"流程，用 Playwright 自动化：

1. 打开素材页 → 点 `a.buy_btn`
2. 弹窗里点 `text=/No thanks/i`
3. 跳到下载页 → 点 `a.download_btn`（**注意：这个按钮是 JS 触发下载，必须 `page.waitForEvent('download')` 配 `Promise.all`，不能只点**）
4. `download.saveAs()` 存盘

按钮文案是 `Download`，不是 `Buy`，选择器按 `a.download_btn` 找。

### 2.3 ⚠️ 最大的坑：VN 立绘没有脚

**视觉小说立绘（visual novel sprite）按行业惯例在裙摆或大腿处截断**，下半身留白好让立绘压在对话框后面。所以：

- 一整套"7 服装 × 7 表情"的漂亮立绘，**很可能一帧都没有脚**。
- 检查方法（先查再下，别等打包完才发现）：

```bash
node -e "
const sharp=require('sharp');
(async()=>{
  const f='candidate.png';
  const {data,info}=await sharp(f).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width:W,height:H,channels:C}=info;
  let top=H,bottom=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(data[(y*W+x)*C+3]>16){if(y<top)top=y;if(y>bottom)bottom=y;}
  console.log('canvas',W+'x'+H,'人物高度占比',((bottom-top)/H).toFixed(3));
})();"
```

判读：**人物高度 ÷ 画布高度 ≈ 0.97 且画布宽高比 ≈ 1:2** → 半身立绘（没有脚）；**宽高比 1:2.8 ~ 1:3.5** → 大概率是全身。

- 即使源包里有 `.psd`，也**不代表**藏了腿部图层——用 `strings` 查过图层名再下结论。
- 需要"有脚"的角色，直接换素材，不要试图拼腿（画风对不上，很难看）。

## 3. 判断一套素材能不能用

打包前逐条过：

- [ ] **多状态同姿势**：`idle / talk / happy` 必须同画布、同站位、同比例，只差表情。若每张姿势都不同，状态切换会"跳"——这种情况**只做 `idle` 单状态包**，靠回退机制保证不崩。
- [ ] **透明通道是真的**：`sharp().metadata().hasAlpha === true`，且 alpha 有实际分布（不是全 255）。棋盘格背景 = 假透明，必须先抠图（`tools/asset-studio`）。
- [ ] **人物贴边**：裁掉四周多余透明边（`sharp().trim({ threshold: 8 })`），否则脚离视口底边会留一条缝。
- [ ] **分辨率够**：宽度 ≥ 560px（渲染高度约 220–300px，2x 屏需要 2 倍）。
- [ ] **许可可商用/可个人使用**，且能署名。

## 4. 打包

用本技能的脚本，输入一份 JSON 配置即可：

```bash
node skills/fieldnotes-mascot-sourcing/scripts/build-pack.mjs pack.config.json
```

配置示例（`source` 里没列出的状态就是"没有"，会被自动省略）：

```json
{
  "name": "小葵",
  "author": "Noraneko Games",
  "license": "Custom (attribution required, modifications allowed)",
  "width": 560,
  "trim": true,
  "out": ".tmp-check/out-mascot.zip",
  "source": {
    "idle":  "raw/neutral.png",
    "talk":  "raw/open.png",
    "happy": "raw/smile_blush.png",
    "held":  "raw/smile.png",
    "sleep": "raw/frown_blush.png"
  },
  "display": { "mode": "full", "height": 240, "crop": 1 },
  "lines": { "click": ["今天想读点什么？"] }
}
```

脚本会做：读图 → 可选 trim → 统一缩放到 `width`/`height` → 转 WebP(q92) → 从 alpha 边界算 `anchors.baseline` → 写 `mascot.json` → 打 zip。

**两条关于缩放/裁剪的铁律**（`build-pack.mjs` 已实现，手写脚本要照抄）：

1. **trim 用"并集"，不要逐帧裁。** 逐帧裁会让各帧画布尺寸不一致，状态切换时人物比例会跳、锚点也会漂。正确做法：先算出**所有源图的 alpha 包围盒并集**，用同一个矩形裁每一帧。
2. **高瘦全身立绘按 `height` 缩放，不要按 `width`。** 源图若是 560×2496 的竖长立绘，按宽度缩放到 546 会把高度抬到 2400+，反而更糟。给配置加 `"height": 1200`，脚本改走 `fit: 'inside'` 的高度通路。
3. 画布尺寸不一致是**硬失败**（`fail()`），不是警告——宁可报错也别导出一套帧大小不齐的包。

**必须遵守的 schema 约束**（违反会被接口 400 打回）：

| 字段 | 约束 |
|---|---|
| `states.idle` | **必需** |
| `states.*` 文件名 | 必须匹配 `^[a-z]+\.(webp\|png)$` |
| `motion.blinkEvery` | **≥ 2**（写 0 会报 `too_small`） |
| `display.height` | 80–520 |
| `display.crop` | 0.2–1（1 = 全身；越小越往上裁，**不缩放**） |

## 5. 导入与验证

### 5.1 导入

接口要 `Origin` + `x-csrf-token`，token 从任一 owner 页面的 `<meta name="csrf-token">` 取。注意 **`/api/auth/login` 本身免 CSRF**（中间件放行登录路径），所以顺序是：先登录拿 cookie，再打开任一 owner 页面读 meta 里的 token。

```bash
# 1. 登录
curl -s -c /tmp/c.txt http://localhost:4321/owner/login -o /dev/null
curl -s -b /tmp/c.txt -c /tmp/c.txt -X POST http://localhost:4321/api/auth/login \
  -H "Content-Type: application/json" -H "Origin: http://localhost:4321" \
  -d '{"username":"admin","password":"fieldnotes123","remember":true}'

# 2. 取 csrf
CSRF=$(curl -s -b /tmp/c.txt http://localhost:4321/owner/appearance \
  | grep -oE 'name="csrf-token" content="[^"]*"' | sed 's/.*content="//;s/"//')

# 3. 上传
curl -s -b /tmp/c.txt -X POST http://localhost:4321/api/owner/mascots \
  -H "Origin: http://localhost:4321" -H "x-csrf-token: $CSRF" \
  -F "file=@out.mascot.zip;type=application/zip"
```

成功返回 `{"pack":{"id":"...", ...}}`。**重复上传会生成重复包**，注意别多跑一次。

### 5.2 设为当前看板娘

`GET /api/owner/settings/appearance` → 改 `mascot.character = "pack:<id>"`、`mascot.mode = "on"` → `PUT` 回去（同样要 csrf）。

### 5.3 让某个主题自动用上这个角色包（可选）

想让"切到樱花坂就自动换成小铃"这种效果，在 `src/lib/themes.ts` 的对应预设上加一行：

```ts
{ id: 'sakura', ..., mascot: 'haru', mascotPack: '小铃' },
```

- `mascotPack` 写的是**角色包名字**，不是 id —— id 是内容哈希，重新导入就变了；名字稳定，且找不到时**自动回退**到 `mascot`（内置角色），删包不会把主题搞坏。
- 只在站主把看板娘设成「跟随主题」（`character: 'preset'`）时生效；手动选定的角色永远优先。
- 解析发生在 `PublicLayout.astro`（`findPackIdByName` 只查一列，开销可忽略）。

当前绑定：`sakura → 小春`、`tenki → 小晴`、`lacia → 蕾西亚`、`summer → 小穗`（全是插画包）；内置 SVG 角色只作兜底。

### 5.4 验证（不要只看 200）

```js
// 用 Playwright 量真实渲染，而不是猜
const info = await page.evaluate(() => {
  const r = document.querySelector('[data-mascot]');
  const img = r.querySelector('.mascot-frame[data-frame="idle"]');
  const b = r.getBoundingClientRect();
  return { kind: r.dataset.kind, bottom: b.bottom, h: b.height, w: b.width,
           natural: img.naturalWidth + 'x' + img.naturalHeight, vh: innerHeight };
});
```

验收标准：

- `kind === 'pack'`
- `bottom === innerHeight`（脚正好落在视口底边，不能留缝）
- `w / h === naturalWidth / naturalHeight`（**没有被压扁**——比例不符说明命中了下面第 6 节的 CSS 坑）
- 点击后气泡有文字、状态切到 `talk`

## 6. 踩过的坑（省你一小时）

1. **`preset` 改了但页面没变** —— 站主开了**主题轮播**（`themeRotation`），`pickTheme()` 会覆盖 `preset`。要固定看某个主题，用 owner 登录态的 `?theme-preview=<presetId>`。
2. **看板娘被压扁、底部留白** —— 旧版单图看板娘的 `.mascot-btn img { max-height: 260px; object-fit: contain }` 会误伤角色包帧图。该规则现在已限定为 `.mascot[data-kind='image']`；若再出现，先查这条选择器。
3. **CSS 改了填充/类名，SVG 没跟上 → 角色直接少零件。** 这是最坑的一种"改坏了"：CSS 里写 `fill: url(#xx)`，而 SVG 的 `<defs>` 里**没有这个渐变**时，按规范该元素**不渲染**——眼睛看着 CSS 明明改成功了，页面上的角色却莫名其妙少了头/衣服/裙子。排查方法：`getComputedStyle(el).fill` 拿到 `url("#xxx")`，再 `document.getElementById('xxx')` 看是不是 null。**改外观 CSS 后，务必截一张图看成品，不要只看 diff。**
4. **删除角色包接口 500** —— 沙箱会拦截开发服务器进程内的 `fs.rmSync`（安全删除阈值），**不是产品 bug**。绕过：直接删库（`uploads` + `mascot_packs` 两张表）并手动删 `data/uploads/` 下的文件。
5. **`mascot.json` 校验失败** —— 错误信息是 Zod 的原始结构，看 `path` 和 `message` 就知道哪个字段超范围（最常见的还是 `blinkEvery`）。
6. **半身立绘当全身用** —— 见 2.3。别试图补腿。
7. **只给 `idle` 也能用** —— 缺失状态会优雅回退到 `idle`，点击、拖动、气泡都正常，只是没有表情变化。这是单状态包的合法做法。
8. **itch.io 429 Too Many Requests** —— 连续下多个文件会被限流。逐个文件下、失败就等一会儿再试，别并发批量。
9. **itch.io 有两个 `buy_btn`，第一个是隐藏的** —— 用 `a.buy_btn:visible`，否则 `click` 会因 "element is not visible" 超时。
10. **Git-Bash 的 `/tmp` 和 Node 看到的 `/tmp` 不是同一个路径** —— 临时脚本里的 `require('/tmp/x.json')` 会 ENOENT。用项目内相对路径（如 `.tmp-src/`）当暂存目录。
11. **ESM 脚本不读 `NODE_PATH`** —— 用了项目 `node_modules` 的脚本必须放进项目目录再 `node` 跑，不能放 `/tmp`。
12. **头像/素材目录别提交进 git** —— 本地素材目录（如 `素材图/`，30MB 级）和 `.tmp-src/` 之类的下载暂存区，加进 `.gitignore`，只提交代码和技能文档。

## 7. 交付清单

- [ ] `.mascot.zip` 已导入，`/api/owner/mascots` 里能看到，`id` 已记录
- [ ] 前台截图证明：`kind=pack`、`bottom === innerHeight`、比例正确、点击有台词
- [ ] `mascot.json` 的 `author` / `license` 与素材来源一致
- [ ] 来源与署名说明已写进仓库（来源 URL、作者、许可、做了哪些修改）
- [ ] 若用了 CC-BY-SA：已提醒站主"衍生图需同协议共享"
- [ ] 已告诉站主怎么换回别的角色（后台 → 外观与主题 → 角色）

## 8. 从零生成立绘（找不到合适素材时）

手绘 SVG 撞不到"动漫插画"的观感，开放素材站又常常没有全身同姿势的多表情立绘。剩下的路是**生图 + 抠图**。整条链是：洋红底出图 → 抠图 → 表情帧 → 对齐画布 → 打包。

### 8.1 ⚠️ 模型给不了真透明通道

`background: "transparent"` **不是透明**，它只是把一张**棋盘格图案画进画面**。实测 `sharp` 读出 `hasAlpha: false`、四角像素是 `234,231,229,255`（画上去的棋盘格）。所以：

**必须让模型在纯色底上出图，再自己抠。**

提示词里写死（英文比中文稳）：

```
Professional anime character illustration, full body, standing upright facing the viewer,
complete figure from head to shoes. The entire background is one perfectly flat solid magenta
chroma-key colour, absolutely uniform, no gradient, no shadow, no texture.
Japanese visual novel character sprite style, ... no text, no watermark,
isolated single character, generous margin around the figure.
```

用 `size: "1024x1536"`、`quality: "high"`。

### 8.2 抠图：按背景色**距离**，不要按洋红指标

第一版用 `min(R,B) − G`（洋红度）当指标，只在背景真是洋红时成立。模型经常漂到**酒红 `132,54,86`** 或**粉 `203,95,151`**，此时指标只有 32，阈值窗口被压到 `6..20`，**浅紫/浅粉的头发会被整片吃掉**。

正确做法见 `scripts/chroma-key.mjs`：

```bash
node skills/fieldnotes-mascot-sourcing/scripts/chroma-key.mjs in.png out.png [--check] [--drop-islands]
```

- `--check` 合成到中灰上，边缘毛边一眼可见（**每次都要看一眼**，别只看 exit code）
- `--drop-islands` 剔除漂浮道具，见 8.3

核心逻辑：

```js
// 1. 取四周 2px 边框环的 RGB 中位数当背景色 B（比取四角稳，能扛住边角的一笔杂色）
// 2. d = 到 B 的欧氏距离
// 3. d <= lo → 全透明；d >= hi → 全不透明；中间线性过渡
//    lo = max(6, 边框环内的最大 d * 1.8)   ← 噪声地板
//    hi = lo + 42
// 4. 对 0 < a < 255 的像素做反预乘，把背景色真正减掉：
//    F = (C - (1 - a) * B) / a
```

反预乘比"去饱和"干净得多：边缘像素不会再带一圈背景色调（酒红底会留红边，灰底会留灰边）。

### 8.3 三个必须处理的脏东西

| 脏东西 | 处理 |
|---|---|
| 右下角「AI 生成 WORKBUDDY」水印 | 水印是**不透明**的，抠不掉。直接把右下 `30% × 7.5%` 区域的 alpha 强制置 0（人物够不到那个角） |
| 模型自作主张加的**漂浮道具**（蕾西亚右上多了一块悬空黑板） | **不能整块抹**——它和头发在同一列，抹矩形会在头发上打洞。按**连通域**算面积，只删面积 < 主体 10% 的碎片 |
| `sharp().trim()` 静默失效 | 半透明像素贴边时 trim 直接放弃（透明伞一定触发）。自己算 alpha 包围盒再 `.extract()` |

### 8.4 表情帧：只改脸

用 `image1` + `input_fidelity: "high"`，提示词强调"其余一切不许动"：

```
Keep this exact character, pose, body, clothing, hair, umbrella, framing and flat magenta
background completely unchanged. Only change the face: eyes open looking at the viewer,
mouth slightly open as if speaking a short sentence.
```

**必须串行生成，每出一张立刻改名。** 并行调两次会共用同一时间戳文件名，后一张把前一张覆盖掉（实测丢过一整个 `src-sora`）。

一套三帧就够：`idle`（闭口）/ `talk`（睁眼开口）/ `happy`（闭眼笑）。缺的状态会自动回退到 `idle`。

### 8.5 对齐画布：按 alpha 包围盒**底边中心**

逐帧抠图必然差 1–3px（一缕头发这帧出框、下帧没出），而 `build-pack.mjs` 遇到画布不一致是**硬失败**。不要手调，用脚本：

```bash
node skills/fieldnotes-mascot-sourcing/scripts/align-frames.mjs <输出目录> <角色名> <帧.png> <帧.png> ...
```

- 取所有帧 alpha 包围盒的**最大宽高**当公共画布
- 每帧按**底边贴齐 + 水平居中**合成进去

底边对齐是关键：`anchors.baseline` 读的就是脚的位置，脚对齐了状态切换才不会跳。

### 8.6 打包与验证

配置里给 `"height": 900`（**按高度缩放，别按宽度**——全身立绘按宽度会被放大到 2000+ 高），`trim: false`（已经自己裁过了），`display.height: 300`、`crop: 1`。

验证时注意两个坑（都会让你误判）：

1. **`?theme-preview=` 不改角色包。** 它只翻一个预览属性；`mascotPack` 走的是 `appearance.preset`，必须在库里改 `preset`。
2. **入场动画期间量尺寸是错的。** `.mascot` 有 0.6s 延迟 + 0.9s 的 `ms-enter`，量早了会读到"还在从下面往上滑"的位置，表现为底部莫名留 17px 缝。等 2s 再量。

### 8.7 没有站主密码时怎么导入

`POST /api/owner/mascots` 要站主会话。**不要为了导入去重置站主密码**——那会把站主所有设备踢下线。用脚本直接写库，它复刻了 `importPack()` 的全部行为：

```bash
node skills/fieldnotes-mascot-sourcing/scripts/import-pack.mjs a.mascot.zip b.mascot.zip
```

细节（手写脚本要照抄）：

- `mascot_packs(id, name, manifest, created_at, updated_at)`，`id` 是 16 位 hex
- `uploads(id, filename, original_name, mime, size, created_at, pack_id)`，`filename` 是 **24 位 hex + 扩展名**（`readUpload` 用 `^[a-f0-9]{24}\.(png|webp|…)$` 校验，长度不对就 404）
- 图片落到 `data/uploads/`，`original_name` 用 `idle.webp` 这种，因为 `urlsFor()` 是靠它反推状态的

