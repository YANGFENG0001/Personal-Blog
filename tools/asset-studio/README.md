# FIELDNOTES 素材工作室（本地工具）

把生图模型产出的角色图、贴纸和背景，处理成网站能直接用的素材：

- **去掉假透明背景**：生图模型常把“透明背景”画成灰白棋盘格。本工具能识别并去除，包括头发缝隙里的棋盘格。
- **去掉纯色背景**：绿幕 `#00FF00`、纯白等，同时清除边缘残留的背景色。
- **AI 抠图（可选）**：照片、场景插画这类复杂背景交给本地 ONNX 模型。
  - 二次元角色用 ISNet anime-seg，约 170MB。
  - 通用场景用 U²-Net-p，约 4.6MB。
- **画笔修补**：擦除残留，或恢复误删的部分。
- **看板娘角色包**：
  - 6 个状态（默认 / 说话 / 开心 / 被拎起 / 睡觉 / 闭眼）。
  - 按时间、页面和事件分组的台词。
  - 显示方式、描边、动作。
  - 一键导出 `.mascot.zip`。
- **贴纸合集自动切分**：一张图里的多个元素会切成单张，导出为 WebP 或 PNG。

只在本机运行，地址是 127.0.0.1，图片不会上传到任何地方。

## 安装

需要 Node.js 20 或更高版本。

```bash
git clone <你的仓库地址> fieldnotes
cd fieldnotes/tools/asset-studio
npm install          # 会同时安装 onnxruntime-node（AI 抠图用）；安装失败也不影响算法抠图
npm start            # 打开 http://127.0.0.1:4777
```

AI 模型在第一次使用时下载，可以点工作室右上角的“下载”，也可以用命令行：

```bash
node cli.mjs model anime     # 二次元角色模型（约 170MB，国内自动走 hf-mirror 镜像）
node cli.mjs model general   # 通用小模型（约 4.6MB）
```

模型保存在 `~/.fieldnotes-studio/models/`。下载失败时，可以手动下载后放到这个目录。

## 命令行（批量处理）

```bash
node cli.mjs matte  in.png out.webp [--mode auto|algo|ai|both] [--model anime|general] [--key 00ff00] [--kind mascot|sticker|particle|cursor]
node cli.mjs split  sheet.png outDir/            # 把贴纸合集切成单张
node cli.mjs mascot 角色目录/ 输出.zip --name 名字  # 目录里放 idle.png（必需）、talk.png、happy.png、held.png、sleep.png、blink.png，可选 lines.json
node cli.mjs check  角色包.zip                    # 导入前检查
```

## 导入到网站

在网站后台打开 **外观与主题 → 主题与配色 → 看板娘 → 导入角色包**，选择导出的 `.mascot.zip`，然后点“使用”。

## 让生图模型产出好处理的素材

完整规范见技能文档 `skills/fieldnotes-theme-pack/`。最重要的三条：

1. **不要**要求“透明背景”。改成 `纯绿色背景 #00FF00，无阴影，无渐变`；如果人物身上有绿色，就用纯白或纯洋红 `#FF00FF`。
2. 同一个角色的各个状态图，要保持同尺寸、同站位、同光源，只改表情和手势。
3. 不要文字、水印和边框，人物要完整，不要被画面边缘裁掉。
