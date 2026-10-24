---
name: fieldnotes-mascot-sourcing
description: FIELDNOTES 站点的看板娘适配层。负责把「已做好的角色帧」变成本站能用的 .mascot.zip 并导入验证，以及查开放许可素材站的抓取命令、署名落点、schema 硬限制和本项目特有的坑。制作流程本身（还原/生图/抠图/对齐/局部动态/状态设计）不在这里，看 skills/mascot-studio/SKILL.md。
---

# FIELDNOTES 看板娘适配层

本文件只讲**本站的格式与流程**。做角色的通用方法看 `skills/mascot-studio/SKILL.md`。

```
找素材 / 生图 / 抠图 / 对齐 / 动态   ← skills/mascot-studio
        ↓  一组对齐好的透明 PNG 帧
打包 / 导入 / 绑定主题 / 验收        ← 本文件
```

脚本都在通用技能里，不要在这里另存一份：

```bash
node skills/mascot-studio/scripts/build-pack.mjs  pack.config.json
node skills/mascot-studio/scripts/import-pack.mjs  xxx.mascot.zip
```

## 1. 现成素材渠道（速查）

| 站点 | 特点 | 注意 |
|---|---|---|
| OpenGameArt | 许可最干净，CC0 多 | 二次元立绘质量参差，多是半身 |
| itch.io | 专业 VN 立绘包多，画质高 | 许可是作者自定义，**必须读包内 `Rules.txt`** |

搜索用英文：`anime girl sprite`、`visual novel character`、`full body`、`expressions`。

OpenGameArt 直连抓取（搜索页服务端渲染，可直接解析）：

```bash
curl -s -A "Mozilla/5.0" "https://opengameart.org/art-search-advanced?keys=anime+portrait&sort_by=count&sort_order=DESC" \
  | grep -oE 'href="/content/[a-z0-9-]+"' | sed 's|href="/content/||;s|"||' | sort -u
curl -s -A "Mozilla/5.0" "https://opengameart.org/content/<slug>" -o p.html
grep -oiE '(CC0|CC-BY-SA 4\.0|CC-BY 4\.0|CC-BY 3\.0|OGA-BY 3\.0)' p.html | sort -u
```

itch.io 下载要点：免费素材也要走「购买」流程；按钮是 `a.download_btn`（JS 触发，必须 `page.waitForEvent('download')` 配 `Promise.all`）；有隐藏的 `buy_btn`，用 `a.buy_btn:visible`；连续下载会被 429 限流，逐个下。

**最大陷阱：VN 立绘没有脚**（在裙摆/大腿处截断）。判读：人物高度 ÷ 画布高度 ≈ 0.97 且宽高比 ≈ 1:2 → 半身。检测代码见通用技能 §1。

## 2. 署名落三处

1. `mascot.json` 的 `author` / `license`（后台角色卡片会显示 author）
2. 仓库里的 `素材图/网络素材/来源与署名.md`
3. 站主要的话，页脚/致谢页也放一份

CC-BY-SA 要额外提醒站主「衍生图需同协议共享」。

## 3. 角色包格式硬约束

违反会被接口 400 打回：

| 字段 | 约束 |
|---|---|
| `states.idle` | **必需** |
| `states.*` 文件名 | 必须匹配 `^[a-z]+\.(webp\|png)$`（**不能有连字符**） |
| `motion.blinkEvery` | **≥ 2**（写 0 会报 `too_small`） |
| `display.height` | 80–520 |
| `display.crop` | 0.2–1（1 = 全身；越小越往上裁，**不缩放**） |
| 各状态图 | 画布尺寸必须完全一致，否则 `build-pack` 硬失败 |

`display` 三个模式的语义：`full` 全身、`bust` 下半身渐隐、`peek` 只从屏幕边缘探头。

打包配置示例：

```json
{
  "name": "小葵", "author": "Noraneko Games", "license": "Custom",
  "height": 900, "trim": false, "quality": 92,
  "out": "out.mascot.zip",
  "source": { "idle": "raw/neutral.png", "talk": "raw/open.png", "happy": "raw/smile.png" },
  "display": { "mode": "full", "height": 300, "crop": 1 },
  "lines": { "click": ["今天想读点什么？"] }
}
```

两条铁律（`build-pack.mjs` 已实现）：

1. **trim 用并集，不要逐帧裁。** 逐帧裁会让画布尺寸不一致，状态切换跳、锚点漂。
2. **高瘦全身立绘按 `height` 缩放，不要按 `width`。** 560×2496 的立绘按宽度缩到 546 会把高度抬到 2400+。

## 4. 导入

### 4.1 站主在后台导入（首选）

后台 → 外观与主题 → 角色 → 导入 `.mascot.zip`。

### 4.2 接口

需要 `Origin` + `x-csrf-token`，token 从任一 owner 页面的 `<meta name="csrf-token">` 取。注意 `/api/auth/login` 本身免 CSRF，所以顺序是：先登录拿 cookie，再开 owner 页面读 meta。

### 4.3 没有站主密码时

**不要为了导入去重置站主密码**——那会把站主所有设备踢下线。直接写库：

```bash
node skills/mascot-studio/scripts/import-pack.mjs a.mascot.zip b.mascot.zip
```

它复刻了 `importPack()` 的行为，两个容易忽略的点：

- `uploads.filename` 必须是 **24 位 hex + 扩展名**（`readUpload` 用 `^[a-f0-9]{24}\.(png|webp|…)$` 卡死长度，长度不对就 404）
- `uploads.original_name` 要写 `idle.webp` 这种，因为 `urlsFor()` 靠它反推状态名

## 5. 绑定主题

在 `src/lib/themes.ts` 的预设上加一行：

```ts
{ id: 'sakura', ..., mascot: 'haru', mascotPack: '小春' },
```

- `mascotPack` 写**角色包名字**，不是 id —— id 是内容哈希，重新导入就变；名字稳定，找不到时自动回退到 `mascot`（内置角色），删包不会把主题搞坏。
- 只在站主把看板娘设成「跟随主题」（`character: 'preset'`）时生效；**手动选定的角色永远优先**。

当前绑定：`sakura → 小春`、`tenki → 小晴`、`lacia → 蕾西亚`、`summer → 小穗`。

## 6. 验收

```js
const info = await page.evaluate(() => {
  const r = document.querySelector('[data-mascot]');
  const img = r.querySelector('.mascot-frame[data-frame="idle"]');
  const b = r.getBoundingClientRect();
  return { kind: r.dataset.kind, bottom: Math.round(b.bottom), vh: innerHeight,
           natural: img.naturalWidth + 'x' + img.naturalHeight };
});
```

- `kind === 'pack'`
- `bottom === innerHeight`（脚正好落在视口底边）
- `w / h === naturalWidth / naturalHeight`（没被压扁）
- 点击后气泡有字、状态切到 `talk`

## 7. 本项目特有的坑

1. **`preset` 改了但页面没变** —— 站主开了**主题轮播**（`themeRotation`），`pickTheme()` 会覆盖 `preset`。要固定看某个主题用 `?theme-preview=<presetId>`（注意它只翻预览属性，**不改角色包**）。
2. **看板娘被压扁、底部留白** —— 旧版单图的 `.mascot-btn img { max-height: 260px; object-fit: contain }` 会误伤角色包帧图。该规则已限定为 `.mascot[data-kind='image']`。
3. **CSS 改了填充/类名，SVG 没跟上 → 角色少零件。** CSS 写 `fill: url(#xx)` 而 `<defs>` 里没有这个渐变时，按规范该元素**不渲染**。改外观 CSS 后必须截图看成品。
4. **删除角色包接口 500** —— 沙箱会拦截开发服务器进程内的 `fs.rmSync`，不是产品 bug。绕过：直接删库（`uploads` + `mascot_packs`）并手动删 `data/uploads/` 下的文件。
5. **`mascot.json` 校验失败** —— 错误是 Zod 原始结构，看 `path` 就知道哪个字段超范围（最常见的还是 `blinkEvery`）。
6. **Git-Bash 的 `/tmp` 和 Node 看到的不是同一路径** —— 用项目内相对路径当暂存目录。ESM 脚本不读 `NODE_PATH`，必须放在项目目录里跑。
7. **素材目录别提交进 git** —— `素材图/` 是 30MB 级，`.ref/`、`.tmp-*` 已在 `.gitignore`。
