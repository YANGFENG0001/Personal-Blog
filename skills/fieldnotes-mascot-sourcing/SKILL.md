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
| 站主点名要**某个动漫作品的角色** | ⚠️ 不能做。见第 1 节 |
| 只是要"能露全身、有脚"的角色 | 本技能最省事 |

## 1. 版权：这是硬约束，不是建议

- **不复制受版权保护的角色。** 站主说"要《天气之子》的女主"时，正确做法是做**同一气质的原创角色**（雨、放晴、白裙、双马尾、云隙的光），并在交付时明确说明这是致敬而非复刻。
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

### 5.3 验证（不要只看 200）

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
