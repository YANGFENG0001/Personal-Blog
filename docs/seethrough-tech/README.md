# 蕾西亚·机能（tech）—— 连体衣 + 长风衣

黑色连体紧身衣、带发光线条的长风衣、高跟短靴。**同一个人的第五套衣服。**

`source-raw.png` 是原始素材，`source.png` 是对齐后的图，`layers/` 是 See-through 拆出来的
21 个语义图层。

## 产物

| | |
|---|---|
| 画布 | 490 × 1266（`TECH_CANVAS`） |
| 图层 | 21（`docs/seethrough-tech/layers/`） |
| 部件 | 30 件，另 14 个表情变体 + 缩略图 |
| 输出 | `public/lacia-rig/tech/` 45 个文件，0.15 MB |
| 膝 | `r [192.5, 845]` / `l [305, 844]` |
| 肘 | 见 `parts-tech.ts` |

## 这一步踩到的坑

1. **两条腿在裆部是连着的。** 连体紧身衣是一整块布，腐蚀到 8 次仍是一个连通域——按
   连通域分腿这件事在物理上就不成立。但轮廓在中线附近有真正的低谷（列投影 134 / 峰值
   641），所以 `split_lr` 现在多了一条退路：分不开时按最窄的那一列切。
   判据是"低谷要足够深"（< 峰值的 35%）——礼服那条腿没有缝，会被这条判据挡回去，
   保持整体不切（否则会切出一条空腿，两个膝盖相差 300 多像素）。
2. **髋不能取 `topwear` 的底边。** 风衣从肩到小腿，底边在 y=1079 / 画布 1266，取它等于
   把整个身体的根放在脚踝上，人会从小腿折。规则改成：没有 `bottomwear` 时，如果
   `topwear` 的底边明显低于 `legwear` 的顶边，就用 `legwear` 的顶边当髋。
3. **同样没有 `face` 层**，脸皮由 `export_assets.py` 从源图回收（见
   `docs/seethrough-casual/README.md` 第 2 条）。
4. **`handwear` 是两只独立的袖子**，不需要按连通域分——拆层直接给了 `handwear-l` /
   `handwear-r`，各切上臂 / 前臂 / 手三段。
5. **风衣前襟在 `topwear` 里是实心的，腿被它盖死了。** 原画是敞开的风衣，两条腿从腰下就
   看得见；拆层给的 `topwear` 是一张闭合曲面，前襟填的是衣服内壁的阴影（69933 px）。
   衣服画在腿前面是对的，但那层阴影让她看起来只有小腿以下有腿。`--punch-leg` 按拆层
   写出来的深度图判"腿比布近"的像素，在 `topwear` 的 alpha 上挖掉，腿就露出来了。
   这套的 `topwear` 包围盒从 499×1044 缩到 423×891——少掉的那块本来就不该属于风衣。
6. **`torso` 枢轴同样被长下摆带跑。** `topwear` 中心落在 y=620，骨盆在 471，枢轴掉到
   风衣里；`torsoR` 于是让上半身和下摆反向摆。现在夹在骨盆到下巴的 20%–55% 之间，
   落在 415。

## 怎么重做

```bash
python docs/lacia-rig/pipeline/prep_alpha.py docs/seethrough-tech/source-raw.png \
    docs/seethrough-tech/source.png
python docs/lacia-rig/pipeline/run_st.py docs/seethrough-tech/source.png lacia_tech.png tech
python docs/lacia-rig/export_assets.py \
    --src docs/seethrough-tech/layers \
    --meta docs/seethrough-tech/layers/<prefix>_layers.json \
    --out public/lacia-rig/tech --ts src/lib/lacia/parts-tech.ts \
    --name TECH --source docs/seethrough-tech/source.png --punch-leg
python docs/lacia-rig/gen_face_variants.py --src public/lacia-rig/tech --out public/lacia-rig/tech
```

## 验证

```bash
LACIA_URL='http://localhost:4321/lacia?skin=tech' node docs/lacia-rig/verify/states.cjs
LACIA_URL='http://localhost:4321/lacia?skin=tech' node docs/lacia-rig/verify/joints.cjs
LACIA_URL='http://localhost:4321/lacia?skin=tech' node docs/lacia-rig/verify/lip.cjs
```

`joints` 的 `noPart` 为空——12 个关节每一个都挂在有图的骨头上，膝盖是真的（不是钉在髋上）。
