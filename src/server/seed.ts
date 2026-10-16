import type BetterSqlite3 from 'better-sqlite3';

type Db = BetterSqlite3.Database;

const id = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export const DEFAULT_SETTINGS = {
  site: {
    title: 'FIELDNOTES',
    subtitle: '独立写作与研究札记',
    intro: '一处围绕学习、研究与日常的独立写作空间。记录理解的过程，也保留尚未得到答案的问题。',
    launchDate: '2026-01-01',
    footer: '以文字记录思考，以代码验证理解。',
    language: 'zh-CN',
  },
  profile: {
    public: true,
    name: '站主',
    avatarText: 'F',
    avatarUrl: '',
    bio: '研究人工智能、软件技术与学习方法。喜欢阅读论文，也喜欢把问题认真写清楚。',
    interests: ['机器学习', '大语言模型', '软件工程'],
    links: [{ label: 'GitHub', url: 'https://github.com/' }],
  },
  appearance: {
    preset: 'ink' as string,
    theme: 'system' as 'system' | 'light' | 'dark',
    customAccent: '' as string,
    motion: 'normal' as 'off' | 'minimal' | 'normal' | 'rich',
    density: 'comfortable' as 'compact' | 'comfortable' | 'spacious',
    font: 'preset' as 'preset' | 'serif-sans' | 'sans' | 'serif',
    radius: 'preset' as 'preset' | 'sharp' | 'soft' | 'round',
    cursor: 'system' as 'system' | 'dot' | 'ring' | 'theme',
    cursorTrail: false,
    background: {
      type: 'preset' as 'preset' | 'none' | 'solid' | 'gradient' | 'paper' | 'dots' | 'grid' | 'animated' | 'image' | 'scene',
      scene: 'ocean' as string,
      effect: 'particles' as 'particles' | 'sakura' | 'leaves' | 'bubbles' | 'stars' | 'waves' | 'fireflies' | 'snow',
      color: '#f3f1ea',
      gradientFrom: '#f3efe6',
      gradientTo: '#e7eef0',
      imageUrl: '',
      overlay: 0.82,
      blur: 0,
      fixed: true,
      intensity: 'medium' as 'low' | 'medium' | 'high',
    },
    iconMotion: true,
    cardMotion: true,
    mascot: {
      mode: 'preset' as 'preset' | 'on' | 'off',
      character: 'preset' as string,
      draggable: true,
      imageUrl: '' as string,
      position: 'right' as 'right' | 'left',
      size: 'md' as 'sm' | 'md' | 'lg',
    },
  },
  dial: {
    layout: 'orbit' as 'orbit' | 'arc' | 'list' | 'rail',
    shape: 'card' as 'card' | 'capsule' | 'half' | 'leaf' | 'glass',
    handle: 'tab' as 'tab' | 'dot' | 'line',
    showTitle: true,
    showEnglish: true,
    showHint: true,
    showOrbit: true,
    showList: true,
    offsetY: 50,
  },
  encourage: {
    enabled: true,
    intervalMinutes: 5,
    baseChance: 8,
    increment: 4,
    maxChance: 28,
    durationSeconds: 14,
    cooldownMinutes: 20,
    quietOnArticle: true,
    animation: 'rise' as 'rise' | 'fade',
  },
  easter: {
    enabled: true,
    set: 'follow-theme' as string,
    triggers: {
      logo: true, konami: true, hello: true, lateNight: true, readEnd: true,
      avatar: true, festival: true, console: true, notFound: true,
    },
  },
  themeRotation: {
    mode: 'fixed' as 'fixed' | 'random' | 'rotate' | 'schedule',
    pool: [] as string[],
    everyDays: 7,
    rules: [] as { theme: string; time?: string; dates?: string; weekdays?: number[]; label: string }[],
    eggs: [] as { trigger: 'konami' | 'logo-7' | 'typed-word' | 'idle-night' | 'read-3'; word?: string; theme: string; minutes: number }[],
  },
  previewBall: {
    enabled: true,
    position: 'right' as 'right' | 'left',
    shape: 'circle' as 'circle' | 'squircle' | 'pill' | 'hexagon' | 'leaf',
    style: 'solid' as 'solid' | 'glass' | 'outline' | 'accent',
    size: 'md' as 'sm' | 'md' | 'lg',
    showLabel: true,
    pulse: true,
  },
};

export type Settings = typeof DEFAULT_SETTINGS;

const SITES: [string, string, string, string, string, [string, string][]][] = [
  ['learning', '学习', 'LEARNING', 'book', '系统梳理知识，建立可以反复查阅的理解。', [
    ['foundations', '基础理论'], ['deep-learning', '深度学习'], ['llm', 'LLM 与生成式 AI'],
  ]],
  ['research', '研究', 'RESEARCH', 'atom', '论文精读、问题意识，以及一次次可复现的探索。', [
    ['papers', '论文精读'], ['ideas', '研究心得'], ['experiments', '实验记录'],
  ]],
  ['tech', '技术', 'ENGINEERING', 'code', '实现、工具、工程实践与真实的技术问题。', [
    ['engineering', '技术博客'], ['projects', '项目实践'], ['tooling', '工具链'],
  ]],
  ['life', '日常', 'JOURNAL', 'pen', '技术之外，关于日常与缓慢思考的记录。', [
    ['notes', '随笔'], ['reading', '阅读'], ['weekly', '每周记录'],
  ]],
  ['resources', '资源', 'RESOURCES', 'archive', '整理长期值得保留的书单、论文、工具与链接。', [
    ['collections', '精选资源'], ['reading-list', '阅读清单'], ['tools', '开发工具'],
  ]],
];

export const SEED_TEMPLATES = [
  {
    id: 'paper', name: '论文精读', description: '论文信息、问题、贡献、方法、公式、实验与复现',
    defaultProgress: '待读',
    progress: ['待读', '阅读中', '已精读', '复现中', '已完成', '暂停'],
    body: `## 论文信息

- 标题：
- 作者：
- 年份 / 会议：
- 原文链接：

## 研究背景

## 核心问题

## 主要贡献

1.

## 方法理解

## 重要公式

$$
\\mathrm{Attention}(Q,K,V) = \\mathrm{softmax}\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V
$$

## 实验结果

## 相关资料

## 复现情况
`,
    reflection: '读完之后最大的疑问是……',
  },
  {
    id: 'tech', name: '技术博客', description: '背景、问题分析、思路、实现、结果与总结',
    defaultProgress: '进行中',
    progress: ['计划中', '进行中', '已完成', '暂停'],
    body: `## 背景

## 问题分析

## 解决思路

## 代码实现

\`\`\`ts
// 关键代码
\`\`\`

## 结果

## 总结

## 参考资料
`,
    reflection: '',
  },
  {
    id: 'learning', name: '学习笔记', description: '主题、核心概念、知识梳理、疑问与总结',
    defaultProgress: '进行中',
    progress: ['计划中', '进行中', '已完成'],
    body: `## 学习主题

## 核心概念

## 知识梳理

## 疑问

## 个人总结
`,
    reflection: '',
  },
  {
    id: 'reflection', name: '研究心得', description: '主题、思考过程、观点、问题与后续方向',
    defaultProgress: null,
    progress: ['进行中', '已完成'],
    body: `## 研究主题

## 思考过程

## 观点

## 尚未解决的问题

## 后续方向
`,
    reflection: '',
  },
  {
    id: 'free', name: '自由文章', description: '不限制结构，适合随笔与日常记录',
    defaultProgress: null, progress: [], body: '', reflection: '',
  },
];

const PROGRESS = ['待读', '阅读中', '已精读', '计划中', '进行中', '复现中', '已完成', '暂停'];

// Every quote is attributed to a verifiable source; follow-ups are original text.
const QUOTES: [string, string, string, string, string][] = [
  ['学而不思则罔，思而不学则殆。', '孔子', '《论语·为政》', '读过的东西，要停下来想一想，才会变成自己的。今天不妨挑一个概念，用自己的话重新讲一遍。', '古典'],
  ['路漫漫其修远兮，吾将上下而求索。', '屈原', '《离骚》', '研究的路很长，但每一次求索都会留下痕迹。走到这里，已经比昨天更远一点。', '古典'],
  ['不积跬步，无以至千里。', '荀子', '《劝学》', '一篇笔记、一个公式、一次复现——都是跬步。慢慢来，比较快。', '古典'],
  ['博学之，审问之，慎思之，明辨之，笃行之。', '《礼记》', '《中庸》第二十章', '从阅读到追问，再到动手验证，这是一条完整的路。你正在其中某一步上。', '古典'],
  ['What I cannot create, I do not understand.', 'Richard Feynman', '加州理工黑板遗迹，1988', '真正理解一个模型的方式，往往是亲手把它写出来。哪怕只是一个最小可运行的版本。', '经典'],
  ['The first principle is that you must not fool yourself — and you are the easiest person to fool.', 'Richard Feynman', 'Cargo Cult Science，1974', '对实验结果多问一句“真的吗”，是研究者最朴素也最珍贵的习惯。', '经典'],
  ['Premature optimization is the root of all evil.', 'Donald Knuth', 'Structured Programming with go to Statements，1974', '先让它正确，再让它优雅，最后才让它更快。今天先完成，就已经很好。', '经典'],
  ['あきらめたらそこで試合終了ですよ。', '安西光義', '《SLAM DUNK》井上雄彦', '卡住的时候，换个角度、睡一觉，再回来看看。比赛还没有结束。', '动漫'],
];

const BOARDS: [string, [string, string | null, string | null][]][] = [
  ['论文精读', [['完成 Attention Is All You Need 精读笔记', '本周', null], ['整理 3 篇相关引用文献', null, null]]],
  ['技术实践', [['实现一个最小多头注意力', '进行中', null]]],
  ['日常日程', [['更新本周研究随笔', '本周', null]]],
];

export const MODULE_DEFS = [
  { type: 'about', zone: 'public-sidebar', name: '关于站主', visibleTo: 'public' },
  { type: 'stats', zone: 'public-sidebar', name: '公开统计', visibleTo: 'public' },
  { type: 'tags', zone: 'public-sidebar', name: '标签', visibleTo: 'public' },
  { type: 'colophon', zone: 'public-sidebar', name: '版本说明', visibleTo: 'public' },
  { type: 'featured', zone: 'public-home', name: '精选文章', visibleTo: 'public' },
  { type: 'recent', zone: 'public-home', name: '最近更新', visibleTo: 'public' },
  { type: 'sites', zone: 'public-home', name: '分站索引', visibleTo: 'public' },
  { type: 'toc', zone: 'public-article', name: '文章目录', visibleTo: 'public' },
  { type: 'reflection', zone: 'public-article', name: '心得', visibleTo: 'public' },
  { type: 'quick-write', zone: 'owner-dashboard', name: '快捷写作', visibleTo: 'owner' },
  { type: 'growth', zone: 'owner-dashboard', name: '成长足迹', visibleTo: 'owner' },
  { type: 'recent-edits', zone: 'owner-dashboard', name: '最近编辑', visibleTo: 'owner' },
  { type: 'in-progress', zone: 'owner-dashboard', name: '进行中的研究', visibleTo: 'owner' },
  { type: 'tasks', zone: 'owner-dashboard', name: '任务板', visibleTo: 'owner' },
  { type: 'papers', zone: 'owner-dashboard', name: '论文追踪', visibleTo: 'owner' },
] as const;

export const STAT_DEFS = [
  { kind: 'site-days', label: '建站天数', description: '从站主设定的建站日期到今天的天数（含当天）。' },
  { kind: 'uptime-streak', label: '连续在线', description: '截至今天，连续每天都有服务心跳记录（或外部监测上报）的天数。' },
  { kind: 'publish-days', label: '发布天数', description: '有至少一篇公开文章首次发布的不同日期数量。' },
  { kind: 'publish-streak', label: '连续发布', description: '截至今天或昨天，连续每天都有公开文章发布的天数。' },
  { kind: 'learning-streak', label: '连续学习', description: '截至今天或昨天，连续每天都有学习活动（保存文章或完成任务）的天数。' },
  { kind: 'post-count', label: '公开文章', description: '当前对游客可见的文章总数。' },
] as const;

const WELCOME = `欢迎来到这里。这是一篇由系统初始化时生成的示例文章，你可以在站主工作台中编辑或删除它。

## 这个网站是什么

它由多个**分站**组成：学习、研究、技术、日常与资源。将鼠标移到页面左侧边缘，或按 \`Alt + S\`，即可展开分站切换器。

## 写作能力

支持 GFM 表格、代码高亮与数学公式：

| 能力 | 说明 |
| --- | --- |
| Markdown | 标准 CommonMark + GFM |
| 公式 | KaTeX，行内 $E = mc^2$ 与块级 |
| 代码 | Shiki 语法高亮 |

\`\`\`python
import torch
x = torch.randn(2, 3)
print(x.softmax(dim=-1))
\`\`\`

$$
\\nabla_\\theta \\mathcal{L} = \\frac{1}{N}\\sum_{i=1}^{N} \\nabla_\\theta \\ell(f_\\theta(x_i), y_i)
$$

> 记录理解的过程，也保留尚未得到答案的问题。
`;

export function seed(db: Db): boolean {
  const done = db.prepare(`SELECT value FROM settings WHERE key = 'seeded'`).get();
  if (done) return false;
  const ts = new Date().toISOString();

  db.transaction(() => {
    const setS = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setS.run(k, JSON.stringify(v));

    const insSite = db.prepare(
      `INSERT INTO sites (id, slug, name, en_name, description, icon, visibility, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'public', ?, ?, ?)`,
    );
    const insCat = db.prepare(
      `INSERT INTO categories (id, site_id, slug, name, visibility, sort, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'public', ?, ?, ?)`,
    );
    const catIds: Record<string, string> = {};
    SITES.forEach(([slug, name, en, icon, desc, cats], i) => {
      const sid = id();
      insSite.run(sid, slug, name, en, desc, icon, i, ts, ts);
      cats.forEach(([cslug, cname], j) => {
        const cid = id();
        catIds[`${slug}/${cslug}`] = cid;
        insCat.run(cid, sid, cslug, cname, j, ts, ts);
      });
    });

    const insT = db.prepare(
      `INSERT INTO templates (id, name, description, body_md, reflection_md, default_progress, progress_options, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    SEED_TEMPLATES.forEach((t, i) =>
      insT.run(t.id, t.name, t.description, t.body, t.reflection, t.defaultProgress, JSON.stringify(t.progress), i),
    );

    const insP = db.prepare('INSERT INTO progress_options (id, label, sort) VALUES (?, ?, ?)');
    PROGRESS.forEach((p, i) => insP.run(id(), p, i));

    const insQ = db.prepare(
      'INSERT INTO quotes (id, text, author, source, follow_up, category, sort) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    QUOTES.forEach(([text, author, source, follow, cat], i) => insQ.run(id(), text, author, source, follow, cat, i));

    const insB = db.prepare('INSERT INTO task_boards (id, name, sort, created_at) VALUES (?, ?, ?, ?)');
    const insTask = db.prepare(
      'INSERT INTO tasks (id, board_id, title, priority, due_date, sort, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    BOARDS.forEach(([name, tasks], i) => {
      const bid = id();
      insB.run(bid, name, i, ts);
      tasks.forEach(([title, pr, due], j) => insTask.run(id(), bid, title, pr, due, j, ts));
    });

    const insM = db.prepare(
      `INSERT INTO site_modules (id, type, zone, name, enabled, visible_to, sort, settings) VALUES (?, ?, ?, ?, 1, ?, ?, '{}')`,
    );
    MODULE_DEFS.forEach((m, i) => insM.run(id(), m.type, m.zone, m.name, m.visibleTo, i));

    const insStat = db.prepare(
      `INSERT INTO stat_defs (id, kind, label, description, enabled, public, sort) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    );
    STAT_DEFS.forEach((s, i) => insStat.run(id(), s.kind, s.label, s.description, s.kind === 'site-days' ? 1 : 0, i));

    const insPost = db.prepare(
      `INSERT INTO posts (id, slug, title, summary, category_id, status, visibility, template_id, body_md, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, 'published', 'public', 'free', ?, ?, ?, ?)`,
    );
    const pid = id();
    insPost.run(pid, 'hello-fieldnotes', '你好，FIELDNOTES', '关于这个网站的结构与写作能力的简短说明。',
      catIds['life/notes'], WELCOME, ts, ts, ts);
    db.prepare('INSERT INTO post_tags (post_id, tag) VALUES (?, ?)').run(pid, '站点说明');

    setS.run('seeded', JSON.stringify(ts));
  })();
  return true;
}
