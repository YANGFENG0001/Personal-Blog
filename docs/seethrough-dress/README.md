# 蓝裙皮肤的素材源

第二套皮肤（`dress`）的拆层原始素材。骨架代码不读这里的文件——它读
`public/lacia-rig/dress/*.webp` 和 `src/lib/lacia/parts-dress.ts`，那两个都是从这里**生成**的。
这里存的是"上游"：没有它，那两份生成物就是不可复现的孤儿。

## 目录

| 文件 | 是什么 |
|---|---|
| `source-raw.png` | 生图模型的原始输出（1024×1536） |
| `source.png` | 对齐后的立绘（585×1504），**实际送进 See-through 的就是它** |
| `workflow.json` | See-through 的 ComfyUI 工作流（API 格式，可直接 POST `/prompt`） |
| `layers/` | 22 层语义拆分 + `_depth.png`，1280×1280 画布 |
| `layers.json` | 层清单：文件名、`left/top/right/bottom`、深度中位数 |

## 从 layers 重新生成骨架素材

```bash
python docs/lacia-rig/export_assets.py \
  --src  docs/seethrough-dress/layers \
  --meta docs/seethrough-dress/layers.json \
  --out  public/lacia-rig/dress \
  --ts   src/lib/lacia/parts-dress.ts \
  --name DRESS \
  --title "Lacia blue-dress skin geometry"
```

跑完 `git diff src/lib/lacia/parts-dress.ts` 应当为空。不为空说明层或 `layers.json` 被改过。

## 为什么源图是这个姿势

`source.png` 不是随便一张立绘：它是拿战斗服的 `lacia_idle.png` 作 img2img 的**结构输入**
生成的，再把 alpha bbox 缩放到与原立绘**完全相同的 bbox**（493×1275 vs 493×1276，差 1px）。

所以两套皮肤的**肩 / 髋 / 脖**这些手工枢轴是通用的，膝/肘/腕/踝则各测各的（关节是身体
属性，不是服装属性）。换一张构图不同的立绘，这条前提就没了。

## 两个手工修补

`layers.json` 里有 22 层，但 See-through 只吐了 21 层：

- **`footwear` 是补出来的。** 模型眼里"没有靴筒就不是鞋"，低跟鞋整层缺失，`legwear`
  一路画到脚底。补法：膝以下唯一的近黑区域（亮度 < 340）取连通域 + 填洞，再按
  `X = 388.6 + x·0.852` 映射回 1280 画布。
- **腿部深色补丁与边缘白边**在原始层上修过（向肤色中位数插值 75%；`distance_transform_edt`
  借最近不透明像素的颜色）。这两步没有留脚本，修复已经**烘焙进 `layers/*.png`**——所以
  重跑上面的导出得到的是字节一致的产物（实测 30 张 webp 全同）。但要是重新从 `source.png`
  拆一次层，拿到的是没修的版本，这两步得手工再走一遍。

## 第一版为什么废弃

第一版是蓬 A 字裙。See-through 在裙摆与手臂空间重叠时只能二选一，把**整条裙摆**判给了
`handwear-l`（424×419 的"手部"层），左手彻底丢失。换 seed 不解决问题——模型每次都得二选一。

第二版把裙摆改成贴腿直筒、留出可见间隙，21 层干净，还多出一个 `bottomwear`，手回来了。
详见 `docs/lacia-rig/README.md` §6.1 和 `skills/mascot-studio/SKILL.md` §10.9。
