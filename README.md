# FIELDNOTES：个人博客与 AI 学习研究平台

这是一个可以长期自托管的个人网站系统，分成两部分：

- **公开网站**：多分站、多栏目的专业博客，同时承载研究笔记和知识库。游客只能看到站主明确公开的内容。
- **站主工作台**：在 `/owner` 下，需要登录。用于写作发布、知识库、论文追踪、DIY 任务板、成长统计、展示模块和外观设置。

> 核心原则：**公开什么由站主决定，权限在服务端执行。**
> 私有文章、草稿、心得、任务、学习记录和私有统计都不会进入任何公开的 HTML、JS、JSON、搜索、RSS 或站点地图。

## 功能一览

| 模块 | 内容 |
| --- | --- |
| 多分站 | 初始有学习、研究、技术、日常、资源五个分站，都可以增删改、排序和隐藏。左侧有隐藏式轮盘或弧形切换器，支持键盘（`Alt+S`、方向键、Esc），移动端改为底部抽屉。切换分站时有全局页面转场。 |
| 栏目 | 每个分站有独立栏目，顶部只显示当前分站的栏目。可设简介、展示形式（列表、卡片、紧凑）、是否公开和排序。删除栏目时需要先迁移其中的文章。 |
| 文章 | 支持草稿、发布、更新、撤回、归档、删除和定时发布。“已发布”和“公开”是两个独立的开关。修改 slug 后旧链接会 301 跳转。 |
| Markdown | GFM 表格与任务列表、Shiki 代码高亮（日夜双主题）、KaTeX 公式、目录和锚点、图片上传与粘贴。编辑器预览和公开页面走同一条渲染管线，并做 XSS 净化。 |
| 模板 | 论文精读、技术博客、学习笔记、研究心得、自由文章。模板可以增删改；切换模板前会确认是否覆盖已有内容。 |
| 进度与心得 | 进度词库可自定义，每篇文章可单独决定是否公开进度。“我的心得”是独立字段，默认私有。 |
| 相关链接 | 每条链接可设类型、名称、URL，可排序，只接受 http(s)。公开文章有链接时，右侧用“相关资料”**替换**默认侧栏；移动端放在正文之后。 |
| `.md` 导入 | 解析 front matter，有大小、编码、格式校验。导入内容只进入编辑器，**不会自动发布**。 |
| 知识库 | 层级知识节点，可关联文章，有私有和公开两种视图（`/knowledge`）。 |
| 论文追踪 | 记录作者、年份、会议、链接、代码、方向、阅读状态和复现状态，可关联精读笔记。 |
| 任务板 | 任务板可新建、重命名、删除、排序；任务可新增、编辑、完成或取消完成、删除、排序，支持截止日期、备注、关联文章，并可选择是否显示在总览。 |
| 统计 | 建站天数、连续在线（心跳或外部监控）、发布天数（按日期去重）、连续发布、连续学习、公开文章数。每项可以单独启用、公开和限定分站。 |
| 鼓励提示 | 概率递增机制：可设间隔、初始概率 a、每轮增量、上限、冷却时间和展示时长，阅读文章时降低打扰。后台可即时预览，文案库可编辑。 |
| 彩蛋 | 节日提示、Konami 秘籍、三击品牌标识出现火花，可以整体关闭。 |
| DIY 模块 | 公开首页、侧栏、文章页和站主总览的模块都可以启用、重命名、排序、设置可见范围。外观可调主题、强调色、动画强度、轮盘样式、密度和悬浮球。 |
| 基础能力 | 搜索（FTS5，只搜公开内容）、标签、归档、RSS、sitemap、robots、404、SEO/OG、深浅色、响应式、`prefers-reduced-motion`、键盘可达。 |
| 安全 | argon2id 密码、服务端会话（HttpOnly/SameSite，“记住我”为 30 天滚动续期）、CSRF token 加 Origin 校验、登录限速、基于哈希的严格 CSP、上传文件魔数校验、安全响应头。 |

## 技术栈与取舍

- **Astro 7 SSR**（`@astrojs/node` standalone）加 **Preact islands**。公开页基本不发 JS，只有工作台的交互部分加载岛组件。
- **SQLite**（better-sqlite3，WAL 模式）。适合单机 VPS，备份就是复制一个文件。迁移脚本在 `src/server/migrations.ts`，启动时自动执行。
- **unified / remark / rehype**，加 Shiki 和 KaTeX，组成统一的 Markdown 管线。
- **Zod** 做服务端输入校验。
- **Vitest** 做单元和集成测试，**Playwright** 做端到端验收。

为什么没用 Starlight 和纯静态方案：需求里有在线编辑、即时发布和私有数据，纯静态构建满足不了“即时生效”加“绝不泄露”。知识库内容在数据库里，并且带权限，所以在 Astro 中自建了知识库视图。详见 [`docs/decisions.md`](docs/decisions.md)。

## 本地开发

需要 Node.js 24 或更高版本。

```bash
npm install
npm run owner:create -- admin     # 创建站主账号（会提示输入密码，至少 10 位）
npm run dev                       # http://localhost:4321  ，工作台 /owner
```

数据默认存放在 `./data`（数据库和上传文件），可以通过 `DATA_DIR` 修改。

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` / `npm start` | 生产构建 / 运行（`dist/server/entry.mjs`） |
| `npm run check` | TypeScript 与 Astro 类型检查 |
| `npm test` | 单元与集成测试 |
| `npm run test:e2e` | 端到端测试（需要先 `npm run build`，首次运行前执行 `npx playwright install chromium`） |
| `npm run db:migrate` | 手动执行数据库迁移 |
| `npm run owner:create -- <用户名>` | 创建或重置站主账号（重置后所有设备会被登出） |
| `npm run backup` | 在线备份数据库和上传文件到 `data/backups/` |

## 部署

推荐用 Docker Compose 部署到 Linux VPS，Caddy 会自动申请 HTTPS 证书。完整步骤见 **[`docs/deploy.md`](docs/deploy.md)**，简要流程如下：

```bash
git clone https://github.com/<you>/<repo>.git fieldnotes && cd fieldnotes
cp .env.example .env && nano .env          # 设置 DOMAIN 和 SITE_URL
docker compose up -d --build
docker compose exec app node scripts/create-owner.ts admin
```

## 目录结构

```
src/
  server/            服务端（只在服务端运行）
    db.ts            数据库连接
    migrations.ts    迁移
    seed.ts          初始数据
    visibility.ts    唯一的公开判定入口
    auth/            密码、会话、限速
    services/        分站栏目、文章、任务、统计、设置、知识库、上传等业务逻辑
  lib/               共享工具：markdown 管线、统计纯函数、鼓励概率状态机、前端 API 客户端
  layouts/           Base / PublicLayout / OwnerLayout
  components/public  轮盘、头像卡、文章列表、侧栏、鼓励提示
  components/owner   编辑器、任务板、分站管理、展示模块、设置、知识库、论文（Preact）
  pages/             公开路由、/owner/*、/api/owner/*（全部经中间件鉴权和 CSRF 校验）
  middleware.ts      会话解析、权限拦截、安全头
scripts/             create-owner / migrate / backup / smoke.sh
tests/               unit / integration / e2e
docs/                部署、架构与决策记录
框架/                原始需求书与 V4 原型（仅供参考）
```

## 数据安全提示

- `data/` 目录就是你的全部数据，请定期备份（见部署文档里的定时备份）。
- 站主账号只能在服务器命令行创建或重置，网页上没有注册入口。
- 后台的“设置 → 账号与备份”可以下载完整 JSON 备份，以及全部文章的 Markdown 压缩包。
