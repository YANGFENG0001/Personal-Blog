# Q 版（chibi）—— 三头身，部分为真的骨架

「夏日物语」主题的看板娘。夏日制服、贴头短发、侧马尾。

这份目录只有两张图：`source-raw.png` 和 `source.png`。**拆层结果没有归档**，重新导出
要重跑 See-through（约 5 分钟 GPU）。

## 她的骨架是"部分为真的"

大腿贴合，拆层找不到两条腿——只有一块 `legwear`。于是：

- **没有膝盖可测。** `export_assets.py` 把 `KNEES["r"] / KNEES["l"]` 直接钉在
  `FRAME["legR"] / FRAME["legL"]` 上，而不是在没有收窄的形状上按 45% 猜一个位置。
  后者正是 `JOINT_BANDS` 那套搜索窗口存在的理由：**有窗口是为了有得搜，不是为了让
  每个关节都有数**。
- **没有 `footwear`。** 脚踝退回 `legwear-{side}-lo`（没有的话退回 `legwear`）的底部中心。
- **没有 `neck` 层。** 脖子枢轴退回脸的水平中心。

结果就是 `noPart` 里那六根：`legR` / `legL` / `kneeR` / `kneeL` / `ankleR` / `ankleL`。
它们**照样有变换矩阵，也照样会动**——这正是坑所在，见下。

## 空骨头会给出假绿灯

`joints.cjs` 原本读的是骨头的变换矩阵。Q 版第一次跑，它报 `legR` 行程 1.97°、
`kneeR` 2.59°、`ankleR` 2.55°，全部"通过"——而那根骨头上**没有任何位图**。

现在脚本统计每根骨头上 `img.lr-part` 的数量，`noPart` 里的关节只报告不判分。
这不是放水：一根空骨头动多少度都是无关的，判它等于给假绿灯。

## 产物

| | |
|---|---|
| 画布 | 485 × 816（见 `CHIBI_CANVAS`）。头占一半，所以那些"髋上 40 px"的偏移必须按 `k = 816 / 1276` 缩放，否则落进下巴里 |
| 部件 | 22 件 |
| 输出 | `public/lacia-rig/chibi/` 38 个文件 = 22 件部件 + 15 个表情变体 + 缩略图，302 KB |
| 膝 | 钉在髋 `[247, 636.23]`（见上） |

## 生成参数

第三版才成：**降噪 0.92**、提示词里明写 three-head-tall 与贴头短发。前两版要么是正常
比例（拆出来的骨架和 `lacia` 的关节表对不上），要么头发太长把肩膀埋了（拆层后肩线
量不出来）。

## 孤层回收对她是负收益

同一个回收逻辑（见 `docs/seethrough-sora/README.md`）在她身上会回收出 207×788 的边框
碎片：她的白描边 5 px 宽，腐蚀一次仍存核心。把腐蚀提到三次能滤掉，但那时她**没有值得
回收的东西**了——她的部件都是实心块，不像小晴的侧辫那样细。

所以她的导出**不带 `--source`**。不是忘了，是判据给出的结论。

## 验证

```bash
LACIA_URL='http://localhost:4321/lacia?skin=chibi' node docs/lacia-rig/verify/states.cjs
LACIA_URL='http://localhost:4321/lacia?skin=chibi' node docs/lacia-rig/verify/joints.cjs
```

实测：五状态两两可辨（5/5）、双眼正确；`joints` 报告 6 个无部件关节并 pass。
