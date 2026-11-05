# 蕾西亚·礼服（gown）—— 开衩长裙

白色露肩长裙、黑色长手套、白色高跟。**同一个人的第六套衣服。**

`source-raw.png` 是原始素材（398×900），`source.png` 是对齐后的图，`layers/` 是 See-through
拆出来的 22 个语义图层。

## 产物

| | |
|---|---|
| 画布 | 499 × 1272（`GOWN_CANVAS`） |
| 图层 | 22（`docs/seethrough-gown/layers/`） |
| 部件 | 31 件，另 14 个表情变体 + 缩略图 |
| 输出 | `public/lacia-rig/gown/` 45 个文件，0.17 MB |
| 膝 | `r [199.5, 1007]` / `l [297, 843]` —— **两个高度不同，这是对的** |

## 这一步踩到的坑

1. **它必须按高度对齐，不能按外框。** 裙摆比人还宽（396×897），按"缩到框里"等比缩放后
   人物只有其他皮肤的 88% 高——同一个人，明显矮一截。`prep_alpha.py --fill-height`
   改成按高度缩放到 1495，裙摆两侧各溢出 37px 被画布裁掉。裙摆跑出画面边缘不奇怪，
   人变矮才奇怪。
2. **开衩只露出一条腿。** `legwear` 只有 178×612，其中一条腿从大腿开始、另一条被裙子盖到
   膝盖。按列切会得到一条腿加一条空腿——两个膝盖相差 300 多像素。所以 `split_by_column`
   加了"低谷必须够深"的判据，这套判据挡下之后保留整体，腿按一条处理。
3. **膝盖高度不对称是数据的真相，不是 bug。** y=1007 和 y=843 差的这 164px 就是"一条腿
   露到大腿、另一条只露到膝下"。裙子把它们都盖住了，视觉上没有代价；强行给没画出来的
   腿编一个膝盖才是错的。
4. **同样没有 `face` 层**，脸皮由 `export_assets.py` 从源图回收。
5. **`bottomwear`（那条 658px 高的衬裙）必须画在腿后面。** 拆层的 z 序里它是 2、`legwear`
   是 5——开衩露出来的腿本来就在衬裙前面。挂 `torso` 会跑到腿前面去，开衩处只剩一块灰板。
   现在 `rig.ts` 按 z 序自动把它塞进 `.lr-under`（见主 README §6.6.1）。
6. **`topwear` 必须按深度图挖洞，否则开衩还是灰的。** See-through 的 `topwear` 是一张闭合
   曲面，开衩处填的是衣服内壁的阴影（实心像素）。衣服画在腿前面是对的，但那层阴影会把腿
   盖死。`--punch-leg` 用拆层已经写好的 `*_depth.png` 判"腿比布近"的像素，在 `topwear`
   的 alpha 上挖掉 20077 px，腿从洞里露出来，白色缎面该盖住的地方（小腿前面那道斜襟）
   因为深度更近而保留。
7. **`torso` 枢轴不能取 `topwear` 的中心。** 这套的 `topwear` 一直到脚踝，中心落在 y=729，
   而骨盆在 536——枢轴跑到裙摆里，`torsoR` 就让上半身朝一边、下摆朝另一边，整个人绕着
   一根藏在裙子里的铰链晃。现在夹在骨盆到下巴的 20%–55% 之间，落在 467。


## 怎么重做

```bash
python docs/lacia-rig/pipeline/prep_alpha.py docs/seethrough-gown/source-raw.png \
    docs/seethrough-gown/source.png --fill-height
python docs/lacia-rig/pipeline/run_st.py docs/seethrough-gown/source.png lacia_gown.png gown
python docs/lacia-rig/export_assets.py \
    --src docs/seethrough-gown/layers \
    --meta docs/seethrough-gown/layers/<prefix>_layers.json \
    --out public/lacia-rig/gown --ts src/lib/lacia/parts-gown.ts \
    --name GOWN --source docs/seethrough-gown/source.png --punch-leg
python docs/lacia-rig/gen_face_variants.py --src public/lacia-rig/gown --out public/lacia-rig/gown
```

## 验证

```bash
LACIA_URL='http://localhost:4321/lacia?skin=gown' node docs/lacia-rig/verify/states.cjs
LACIA_URL='http://localhost:4321/lacia?skin=gown' node docs/lacia-rig/verify/joints.cjs
LACIA_URL='http://localhost:4321/lacia?skin=gown' node docs/lacia-rig/verify/lip.cjs
```

三项都通过。`bleed.cjs` 不适用（没有装置）。
