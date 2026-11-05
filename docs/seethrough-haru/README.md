# 小春（haru）—— 生成立绘 + 拆层 + 骨架

「樱花」主题的看板娘。栗色长发、公主切侧发、水手服，樱色发卡。

这份目录归档的是**流水线的中间产物**：`source-raw.png` 是生成模型的原始输出，
`source.png` 是抠图并对齐到骨架画布之后的图，`layers/` 是 See-through 拆出来的 46 个
语义图层。`layers.json` 是拆层器给的图层清单。

## 为什么重做过

她原先是一个手写的内联 SVG（`src/lib/mascot/svg.ts`，已删除）。那个版本能动、能换表情、
能做口型，但**静帧的画质和生成模型差一个量级**——平涂 + 手调贝塞尔怎么调都追不上，
用户的原话是「还是丑」。判断记录在 `docs/mascot-motion-research.md` §5.2。

## 产物

| | |
|---|---|
| 画布 | 328 × 1277（见 `src/lib/lacia/parts-haru.ts` 的 `HARU_CANVAS`） |
| 图层 | 46（`docs/seethrough-haru/layers/`） |
| 部件 | 31 件，其中一件位图被两个 id 共用 |
| 输出 | `public/lacia-rig/haru/` 46 个文件 = 30 件部件 + 15 个表情变体 + 缩略图，272 KB |
| 膝 | `r [113.5, 945]` / `l [217.5, 931]`，各自腿轮廓最窄的一行 |

## 这一步踩到的坑

1. **必须 img2img。** 骨架要求站立 A-pose；`export_assets.py` 的 `cut_at` 在固定窗口里
   找"层内最窄行"测肘和膝，手臂横过髋部就落到窗口外，量出来的关节是错的。用
   `lacia_idle.png`（584×1504）当结构输入是最省事的姿势锁定。
2. **她是第一个"不是第三套衣服"的皮肤。** 蓝裙换的是图层和枢轴，小春换的是画布尺寸、
   十三根非关节枢轴、和整批表情变体。这三样现在都是 `LaciaSkin` 的字段
   （`canvas` / `frame` / `faceBase`），不是在引擎里按角色 id 分支。理由见
   `docs/lacia-rig/README.md` §6.4。
3. **`bottomwear` 要挂到 `torso`。** 默认挂点是 `head`，裙褶会跟着下巴转。
4. **她没有装置**，所以 `states.cjs` / `joints.cjs` / `secondary.cjs` 里凡是点
   `.ls-console` 的段落都要跳过——那两个脚本已经加了守卫。

## 怎么重做

```bash
python docs/lacia-rig/pipeline/gen_char.py    --ref lacia_idle.png --prompt "..." --seed N
python docs/lacia-rig/pipeline/prep_source.py --in out.png --out docs/seethrough-haru/source.png
python docs/lacia-rig/pipeline/run_st.py      --in docs/seethrough-haru/source.png --out docs/seethrough-haru/layers
python docs/lacia-rig/export_assets.py --layers docs/seethrough-haru/layers --name haru
python docs/lacia-rig/gen_face_variants.py --src docs/seethrough-haru/source.png --out public/lacia-rig/haru
```

## 验证

```bash
node docs/lacia-rig/verify/states.cjs      # 五状态两两可辨
node docs/lacia-rig/verify/lip.cjs         # 口型按字形驻留（plateauRatio 0.76）
node docs/lacia-rig/verify/joints.cjs      # 12 关节全有部件，鞋底 R 2.9 / L 1.77
node docs/lacia-rig/verify/secondary.cjs   # 躯干链行程与滞后
```

四个脚本都要 dev server 在跑，用 `LACIA_URL=http://localhost:4321/lacia?skin=haru` 指过去。
