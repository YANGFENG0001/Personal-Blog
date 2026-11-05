# 蕾西亚·礼服（gown）—— 开衩长裙

白色露肩长裙、黑色长手套、白色高跟。**同一个人的第六套衣服。**

`source-raw.png` 是原始素材（398×900），`source.png` 是对齐后的图，`layers/` 是 See-through
拆出来的 22 个语义图层。

## 产物

| | |
|---|---|
| 画布 | 490 × 1266（`GOWN_CANVAS`） |
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
5. **`bottomwear` 是那条 658px 高的长裙**，挂 `torso`。`torso` 枢轴因此落在裙摆中部
   （y=729），呼吸缩放作用在裙子上——这比让裙子跟着胸口走更接近布料的感觉。

## 怎么重做

```bash
python docs/lacia-rig/pipeline/prep_alpha.py docs/seethrough-gown/source-raw.png \
    docs/seethrough-gown/source.png --fill-height
python docs/lacia-rig/pipeline/run_st.py docs/seethrough-gown/source.png lacia_gown.png gown
python docs/lacia-rig/export_assets.py \
    --src docs/seethrough-gown/layers \
    --meta docs/seethrough-gown/layers/<prefix>_layers.json \
    --out public/lacia-rig/gown --ts src/lib/lacia/parts-gown.ts \
    --name GOWN --source docs/seethrough-gown/source.png
python docs/lacia-rig/gen_face_variants.py --src public/lacia-rig/gown --out public/lacia-rig/gown
```

## 验证

```bash
LACIA_URL='http://localhost:4321/lacia?skin=gown' node docs/lacia-rig/verify/states.cjs
LACIA_URL='http://localhost:4321/lacia?skin=gown' node docs/lacia-rig/verify/joints.cjs
LACIA_URL='http://localhost:4321/lacia?skin=gown' node docs/lacia-rig/verify/lip.cjs
```

三项都通过。`bleed.cjs` 不适用（没有装置）。
