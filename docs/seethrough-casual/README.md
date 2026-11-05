# 蕾西亚·日常（casual）—— 同一张立绘的拆层与骨架

开衫、白衬衫、深蓝百褶裙、过膝袜、乐福鞋。**同一个人的第四套衣服**，不是新角色。

这份目录归档流水线的中间产物：`source-raw.png` 是原始素材（透明背景 WebP 转的 PNG），
`source.png` 是对齐到骨架画布之后的图，`layers/` 是 See-through 拆出来的 22 个语义图层
（含 `layers.json`）。

## 为什么它以前只有一张图

它原先是一个**素材包**（`mascot_packs` 里 id `daa79f56`）：一张 `idle.webp`，没有 talk、
没有 blink、没有关节。选它等于把角落里的看板娘换成一张静态图——不呼吸、不转头、不说话。
`dress`（蓝裙）当时是骨架，所以同一个人两套衣服的能力不一样，这没有道理。

现在它和战斗服、蓝裙走同一条流水线，差别只剩位图。

## 产物

| | |
|---|---|
| 画布 | 491 × 1266（`CASUAL_CANVAS`） |
| 图层 | 22（`docs/seethrough-casual/layers/`） |
| 部件 | 31 件（含回收的脸皮），另 14 个表情变体 + 缩略图 |
| 输出 | `public/lacia-rig/casual/` 46 个文件，0.17 MB |
| 膝 | `r [184.5, 842]` / `l [303.5, 845]` |
| 肘 | `r [138, 349]` / `l [349, 368]` |

## 这一步踩到的坑

1. **源图已经是透明的，不能用 `prep_source.py`。** 那个脚本从四边 flood fill 吃掉纯黑
   背景；这三套是从 WebP 来的，alpha 通道本身就是遮罩。用 `prep_alpha.py`：它做的是
   同一件事的后半段（裁到人物、等比缩放、底对齐），外加把半透明边缘的 RGB 换成最近的
   实心像素——否则 320px 显示时会有一圈深色描边。
2. **拆层没有 `face` 层。** See-through 把鼻子、嘴、眼白、睫毛都单独给了，但没给脸皮。
   结果是一双眼睛和一张嘴浮在头发上：部件一个不少，脸没有。`export_assets.py` 现在会从
   对齐后的源图按椭圆**回收**脸皮（减法，不是重画），插在衣服之上、五官之下。
3. **`bottomwear` 要挂 `torso`。** 百褶裙挂腰，不挂下巴。`headwear`（发夹）挂 `hairFront`。
4. **髋不能再取 `topwear` 的底边。** 开衫长到裙摆，那条边不是腰。现在优先取
   `bottomwear` 的顶边（`hip_y = bw["y"]`），这条规则对战斗服也成立，只是它没有
   `bottomwear` 层，走的是原来的分支。
5. **腿骨起点也跟着改了。** `legR/legL` 现在固定在髋下方 `16k`，不再是"各自 legwear 层
   的顶边"——过膝袜的顶边在大腿中部，绕那里转像从袜口折腿。

## 怎么重做

```bash
# 1. 透明素材 → 对齐到 585×1504 的画布（底对齐）
python docs/lacia-rig/pipeline/prep_alpha.py docs/seethrough-casual/source-raw.png \
    docs/seethrough-casual/source.png

# 2. 拆层（ComfyUI 要在跑，约 4 分钟）
python docs/lacia-rig/pipeline/run_st.py docs/seethrough-casual/source.png lacia_casual.png casual

# 3. 把 ComfyUI output 里的 casual_*_*.png 与 _layers.json 拷进 layers/，然后导出
python docs/lacia-rig/export_assets.py \
    --src docs/seethrough-casual/layers \
    --meta docs/seethrough-casual/layers/<prefix>_layers.json \
    --out public/lacia-rig/casual --ts src/lib/lacia/parts-casual.ts \
    --name CASUAL --source docs/seethrough-casual/source.png

# 4. 表情变体
python docs/lacia-rig/gen_face_variants.py --src public/lacia-rig/casual --out public/lacia-rig/casual
```

`--source` 是必须的：没有它就没有脸皮，也没有孤层回收。

## 验证

```bash
LACIA_URL='http://localhost:4321/lacia?skin=casual' node docs/lacia-rig/verify/states.cjs
LACIA_URL='http://localhost:4321/lacia?skin=casual' node docs/lacia-rig/verify/joints.cjs
LACIA_URL='http://localhost:4321/lacia?skin=casual' node docs/lacia-rig/verify/lip.cjs
```

三项都通过：`states` 5/5 唯一、`joints` 12 关节全有部件、`lip` plateau 0.75。
`bleed.cjs` 不适用——它量的是 BLACK MONOLITH 的扇面，这套衣服没有装置。
