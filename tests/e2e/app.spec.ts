import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { login, trackErrors } from './helpers';

test.describe.configure({ mode: 'serial' });

const SECRET = `secret-${Date.now()}`;

async function visitorText(request: APIRequestContext, path: string) {
  const r = await request.get(path, { headers: { cookie: '' } });
  return { status: r.status(), text: await r.text() };
}

async function newPost(page: Page, title: string, opts: { template?: string; links?: { label: string; url: string }[] } = {}) {
  await page.goto(`/owner/editor${opts.template ? `?template=${opts.template}` : ''}`);
  await page.getByLabel('标题').fill(title);
  await page.getByLabel('正文 Markdown').fill(`## 第一节\n\n正文内容 ${SECRET}\n\n## 第二节\n\n$E=mc^2$\n`);
  await page.getByLabel('心得').fill(`私人心得 ${SECRET}-reflection`);
  for (const l of opts.links ?? []) {
    await page.getByRole('button', { name: '添加', exact: true }).first().click();
    await page.getByLabel('链接名称').last().fill(l.label);
    await page.getByLabel('链接地址').last().fill(l.url);
  }
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.toast').last()).toHaveText('已保存');
  await expect(page).toHaveURL(/\/owner\/editor\/[a-z0-9]+$/);
  return page.url().split('/').pop()!;
}

test('public pages have no login entry and no console errors', async ({ page }) => {
  const errors = trackErrors(page);
  for (const p of ['/', '/learning', '/life/notes/hello-fieldnotes', '/archive', '/tags', '/search?q=FIELDNOTES', '/knowledge']) {
    await page.goto(p);
    await expect(page.locator('a[href^="/owner"]')).toHaveCount(0);
    await expect(page.locator('.pball')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('site dial opens with keyboard and navigates', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Alt+s');
  await expect(page.locator('[data-dial]')).toHaveAttribute('data-open', '');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/research$/);
  await expect(page.locator('.category-bar')).toContainText('论文精读');
});

test('unauthenticated owner access is blocked', async ({ request }) => {
  expect((await request.get('/api/owner/posts')).status()).toBe(401);
  const r = await request.get('/owner/tasks', { maxRedirects: 0 });
  expect(r.status()).toBe(302);
});

test('draft → publish → withdraw lifecycle respects visibility everywhere', async ({ page, request }) => {
  const errors = trackErrors(page);
  await login(page);
  const id = await newPost(page, 'E2E 生命周期测试', { template: 'tech' });

  // Draft: not visible to visitors anywhere.
  const res = await page.request.get(`/api/owner/posts/${id}`);
  const post = await res.json();
  const url = `/${post.siteSlug}/${post.categorySlug}/${post.slug}`;
  expect((await visitorText(request, url)).status).toBe(404);
  for (const p of ['/rss.xml', '/sitemap.xml', '/archive', '/']) {
    expect((await visitorText(request, p)).text).not.toContain(SECRET);
    expect((await visitorText(request, p)).text).not.toContain('E2E 生命周期测试');
  }
  // The search page echoes the query; assert on the result count instead.
  expect((await visitorText(request, `/search?q=${SECRET}`)).text).toContain('找到 0 篇');

  // Publish.
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.toast').last()).toHaveText('已发布');
  const pub = await visitorText(request, url);
  expect(pub.status).toBe(200);
  expect(pub.text).toContain(SECRET);
  expect(pub.text).not.toContain(`${SECRET}-reflection`); // private reflection stays private
  expect((await visitorText(request, `/search?q=${SECRET}`)).text).toContain('E2E 生命周期测试');
  expect((await visitorText(request, '/rss.xml')).text).toContain('E2E 生命周期测试');

  // Withdraw.
  await page.getByRole('button', { name: '撤回' }).click();
  await expect(page.locator('.toast').last()).toHaveText('已撤回为草稿');
  expect((await visitorText(request, url)).status).toBe(404);
  expect((await visitorText(request, `/search?q=${SECRET}`)).text).not.toContain('E2E 生命周期测试');
  expect((await visitorText(request, '/sitemap.xml')).text).not.toContain(post.slug);
  expect(errors).toEqual([]);
});

test('related links replace the default sidebar', async ({ page }) => {
  await login(page);
  const id = await newPost(page, 'E2E 相关链接', { links: [{ label: 'arXiv 原文', url: 'https://arxiv.org/abs/1706.03762' }] });
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.toast').last()).toHaveText('已发布');
  const post = await (await page.request.get(`/api/owner/posts/${id}`)).json();

  await page.goto(`/${post.siteSlug}/${post.categorySlug}/${post.slug}`);
  await expect(page.locator('.links-side')).toBeVisible();
  await expect(page.locator('.links-side')).toContainText('arXiv 原文');
  await expect(page.locator('.default-side')).toHaveCount(0);

  // An article without links keeps the default sidebar.
  await page.goto('/life/notes/hello-fieldnotes');
  await expect(page.locator('.links-side')).toHaveCount(0);
  await expect(page.locator('.default-side .sidebar')).toBeVisible();
});

test('markdown import fills the editor without publishing', async ({ page }) => {
  await login(page);
  await page.goto('/owner/editor');
  await page.locator('[data-testid="md-import"]').setInputFiles({
    name: 'note.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('---\ntitle: 导入的笔记\ntags: [导入, 测试]\nsummary: 导入摘要\n---\n\n# 忽略\n\n导入正文 imported-body'),
  });
  await expect(page.getByLabel('标题')).toHaveValue('导入的笔记');
  await expect(page.getByLabel('正文 Markdown')).toHaveValue(/imported-body/);
  await expect(page.locator('.ed-tag')).toHaveCount(2);
  // Nothing was created on the server.
  const list = await (await page.request.get('/api/owner/posts?q=导入的笔记')).json();
  expect(list.total).toBe(0);

  // Oversized / wrong type files are rejected with a message.
  await page.locator('[data-testid="md-import"]').setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(page.locator('.toast-error').last()).toContainText('.md');
});

test('task boards: create, rename, add, complete, uncomplete, delete — and persist', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page);
  await page.goto('/owner/tasks');
  await page.getByLabel('新任务板名称').fill('论文精读E2E');
  await page.getByRole('button', { name: '新建任务板' }).click();
  const board = page.locator('.tb-board', { hasText: '论文精读E2E' });
  await expect(board).toBeVisible();

  page.once('dialog', (d) => d.accept('模型复现E2E'));
  await board.getByRole('button', { name: '重命名' }).click();
  const renamed = page.locator('.tb-board', { hasText: '模型复现E2E' });
  await expect(renamed).toBeVisible();

  await renamed.getByLabel(/添加任务到/).fill('复现 Transformer');
  await renamed.getByRole('button', { name: '添加' }).click();
  const task = renamed.locator('.tb-task', { hasText: '复现 Transformer' });
  await expect(task).toBeVisible();

  await task.getByRole('checkbox').check();
  await page.reload();
  const done = page.locator('.tb-board', { hasText: '模型复现E2E' }).locator('.tb-task', { hasText: '复现 Transformer' });
  await expect(done).toHaveClass(/is-done/);
  await done.getByRole('checkbox').uncheck();
  await page.reload();
  const again = page.locator('.tb-board', { hasText: '模型复现E2E' }).locator('.tb-task', { hasText: '复现 Transformer' });
  await expect(again).not.toHaveClass(/is-done/);

  page.once('dialog', (d) => d.accept());
  await again.getByRole('button', { name: /删除：/ }).click();
  await expect(page.locator('.tb-task', { hasText: '复现 Transformer' })).toHaveCount(0);

  page.once('dialog', (d) => d.accept());
  await page.locator('.tb-board', { hasText: '模型复现E2E' }).getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('.tb-board', { hasText: '模型复现E2E' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('hiding a site removes it from navigation and its posts become 404', async ({ page, request }) => {
  await login(page);
  await page.goto('/owner/sites');
  const site = page.locator('.sm-site', { hasText: '日常' });
  await site.locator('.sm-site-head .switch').click();
  await expect(site.locator('.sm-site-head .switch')).toContainText('隐藏');
  expect((await visitorText(request, '/life/notes/hello-fieldnotes')).status).toBe(404);
  expect((await visitorText(request, '/life')).status).toBe(404);
  expect((await visitorText(request, '/')).text).not.toContain('href="/life"');
  await site.locator('.sm-site-head .switch').click();
  await expect(site.locator('.sm-site-head .switch')).toContainText('公开');
  expect((await visitorText(request, '/life/notes/hello-fieldnotes')).status).toBe(200);
});

test('owner session persists, preview ball switches views, logout works', async ({ page, context }) => {
  await login(page);
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'fn_session')!;
  expect(session.httpOnly).toBe(true);
  expect(session.expires).toBeGreaterThan(Date.now() / 1000 + 20 * 86400); // remember-me

  const p2 = await context.newPage();
  await p2.goto('/owner');
  await expect(p2).toHaveURL(/\/owner$/);

  await page.locator('.pball').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.pball[data-mode="visitor"]')).toBeVisible();
  await page.locator('.pball').click();
  await expect(page).toHaveURL(/\/owner$/);

  await page.getByRole('button', { name: '退出' }).click();
  await expect(page).toHaveURL(/\/owner\/login/);
  await p2.goto('/owner');
  await expect(p2).toHaveURL(/\/owner\/login/);
});

test('every owner page loads without console errors', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page);
  for (const p of ['/owner', '/owner/posts', '/owner/editor', '/owner/tasks', '/owner/sites', '/owner/display', '/owner/settings', '/owner/knowledge', '/owner/papers']) {
    await page.goto(p);
    await expect(page.locator('#owner-main')).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('encouragement preview renders from the display page', async ({ page }) => {
  await login(page);
  await page.goto('/owner/display');
  await page.getByRole('button', { name: '立即预览' }).click();
  await expect(page.locator('.enc-card')).toBeVisible();
  await expect(page.locator('.enc-quote')).not.toBeEmpty();
});
