# 示例：墨韵 · 纸墨札记

这个示例用 `素材图/墨韵主题/` 里已有的素材，演示从原始图片到导入网站的完整流程。

1. **背景**：`纸墨背景/初版.png` 本身就是不透明的背景图，不需要抠图，只需压缩：

   ```bash
   node tools/asset-studio/cli.mjs matte 素材图/墨韵主题/纸墨背景/初版.png paper-bg.webp --mode none --kind background
   ```

2. **贴纸**：`透明素材包/初版.png` 是带假棋盘格的合集图，先切成单张贴纸：

   ```bash
   node tools/asset-studio/cli.mjs split 素材图/墨韵主题/透明素材包/初版.png stickers/
   ```

   从输出里挑出墨滴、印章、书签三张。

3. **看板娘**：`角落看板娘/角落看板娘_初版.png` 同样是假棋盘格背景：

   ```bash
   mkdir 墨韵角色 && cp 素材图/墨韵主题/角落看板娘/角落看板娘_初版.png 墨韵角色/idle.png
   node tools/asset-studio/cli.mjs mascot 墨韵角色/ 墨韵.mascot.zip --name 墨韵 --display bust
   ```

4. **上传并导入**：
   1. 在网站后台“设置 → 文件”上传 `paper-bg.webp` 和三张贴纸。
   2. 把 `ink-paper.theme.json` 里的 `/uploads/REPLACE-…` 替换成上传后得到的路径。
   3. 在“主题工作室 → 导入主题文件”中选择这个 JSON。
   4. 在“外观与主题 → 看板娘 → 导入角色包”中选择 `墨韵.mascot.zip`。

5. **导入前检查**：

   ```bash
   npm run theme:check skills/fieldnotes-theme-pack/examples/ink-paper.theme.json
   ```
