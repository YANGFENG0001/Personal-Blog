# 小晴（sora）—— 生成立绘 + 拆层 + 骨架

「天气」主题的看板娘。深蓝短发、单侧编发、太阳发夹、立领防风外套。

这份目录只有两张图：`source-raw.png`（生成模型原始输出）和 `source.png`（抠图并对齐到
骨架画布之后）。**拆层结果没有归档**，要重新导出得重跑 See-through（约 5 分钟 GPU）。

## 设计被拆层器反过来约束了

前六版都画成**连帽雨衣**，全部失败，而且失败方式一模一样：See-through 把两只袖子和帽兜
塞进同一个 `handwear-l`（476×666，跨整幅），`handwear-r` 只剩 2 像素，
`export_assets.py` 在空层上 `IndexError: index 0 is out of bounds`。

根因不是参数，是**连通性**：兜帽的布料和两只袖子在剪影上连成一片，按连通域永远切不开。
第 7 版改成**立领**，同一个拆层器干净吐出两只手。

所以"立领"不是服装偏好，是**拆层要求**。以后再画这个角色，先问一句"拆层器能不能切开"。

另外两次失败也值得记：

- 手插口袋 → 肘和腕测不到（`cut_at` 的搜索窗口落空）。提示词里明写 "hands open and
  clearly visible, no hands in pockets"。
- 伞被画到画布边缘切掉（`bbox` 触到 x=583）。伞后来改成可选组件，不画在立绘里。

## 产物

| | |
|---|---|
| 画布 | 490 × 1266（见 `SORA_CANVAS`） |
| 部件 | 31 件 = 30 件拆层产物 + 1 件孤层回收回来的侧辫 |
| 输出 | `public/lacia-rig/sora/` 47 个文件 = 31 件部件 + 15 个表情变体 + 缩略图，270 KB |
| 肘 | `r [132.5, 321]` / `l [355, 377]` |

## 孤层回收

拆层**静默丢了一条侧辫**：182×70、3105 px，在任何图层里都不存在。它不是被合并进别的层，
是真的没吐出来。

解法是减法而不是重画：**源图里有、而所有图层都没有的像素，按定义就是丢的那块**。

```python
_lost  = (_ink > 0.35) & (_covered < 0.35)
_core  = ndimage.binary_erosion(_lost, iterations=3)   # 判据：有没有"内部"
_m     = _lost & ndimage.binary_dilation(_core_keep, iterations=3)
```

腐蚀三次是调出来的，不是拍的：辫子 12–18 px 粗，三次腐蚀仍存核心；而 Q 版那 5 px 描边、
以及源图与图层合成之间的 1 px 配准差，都被滤掉。腐蚀一次时 Q 版会"回收"出 207×788 的
边框碎片——那就是把描边当成了部件。

回收出来的东西在 `parts-sora.ts` 里 id 是 `orphan`，`SORA_SKIN.bone.orphan = 'hairBack'`，
因为它挂在后发上、跟着后发转。

## 怎么重做

```bash
python docs/lacia-rig/pipeline/gen_char.py    --ref lacia_idle.png --prompt "..." --seed N
python docs/lacia-rig/pipeline/prep_source.py --in out.png --out docs/seethrough-sora/source.png
python docs/lacia-rig/pipeline/run_st.py      --in docs/seethrough-sora/source.png --out <临时目录>
python docs/lacia-rig/export_assets.py --layers <临时目录> --name sora \
       --source docs/seethrough-sora/source.png   # ← 孤层回收需要整图
python docs/lacia-rig/gen_face_variants.py --src docs/seethrough-sora/source.png --out public/lacia-rig/sora
```

`--source` 是给孤层回收用的。没有它，侧辫就是丢的。

## 验证

```bash
LACIA_URL='http://localhost:4321/lacia?skin=sora' node docs/lacia-rig/verify/states.cjs
LACIA_URL='http://localhost:4321/lacia?skin=sora' node docs/lacia-rig/verify/joints.cjs
```

实测：五状态两两可辨、双眼正确；12 关节全有部件（`noPart: []`），鞋底 R 2.93 / L 1.77。
