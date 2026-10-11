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
  await page.getByLabel('标题', { exact: true }).fill(title);
  await page.getByLabel('正文 Markdown').fill(`## 第一节\n\n正文内容 ${SECRET}\n\n## 第二节\n\n$E=mc^2$\n`);
  await page.getByLabel('心得').fill(`私人心得 ${SECRET}-reflection`);
  for (const l of opts.links ?? []) {
    await page.getByRole('button', { name: '添加', exact: true }).first().click();
    await page.getByLabel('链接名称').last().fill(l.label);
    await page.getByLabel('链接地址').last().fill(l.url);
  }
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.toast-text').last()).toHaveText('已保存');
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
  await expect(page.locator('.toast-text').last()).toHaveText('已发布');
  const pub = await visitorText(request, url);
  expect(pub.status).toBe(200);
  expect(pub.text).toContain(SECRET);
  expect(pub.text).not.toContain(`${SECRET}-reflection`); // private reflection stays private
  expect((await visitorText(request, `/search?q=${SECRET}`)).text).toContain('E2E 生命周期测试');
  expect((await visitorText(request, '/rss.xml')).text).toContain('E2E 生命周期测试');

  // Withdraw.
  await page.getByRole('button', { name: '撤回' }).click();
  await expect(page.locator('.toast-text').last()).toHaveText('已撤回为草稿');
  expect((await visitorText(request, url)).status).toBe(404);
  expect((await visitorText(request, `/search?q=${SECRET}`)).text).not.toContain('E2E 生命周期测试');
  expect((await visitorText(request, '/sitemap.xml')).text).not.toContain(post.slug);
  expect(errors).toEqual([]);
});

test('related links replace the default sidebar', async ({ page }) => {
  await login(page);
  const id = await newPost(page, 'E2E 相关链接', { links: [{ label: 'arXiv 原文', url: 'https://arxiv.org/abs/1706.03762' }] });
  await page.getByRole('button', { name: '发布', exact: true }).click();
  await expect(page.locator('.toast-text').last()).toHaveText('已发布');
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
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('导入的笔记');
  await expect(page.getByLabel('正文 Markdown')).toHaveValue(/imported-body/);
  await expect(page.locator('.ed-tag')).toHaveCount(2);
  // Nothing was created on the server.
  const list = await (await page.request.get('/api/owner/posts?q=导入的笔记')).json();
  expect(list.total).toBe(0);

  // Oversized / wrong type files are rejected with a message.
  await page.locator('[data-testid="md-import"]').setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(page.locator('.toast-error').last()).toContainText('.md');
});

test('task boards: create, inline rename, add, complete, uncomplete, reorder, delete — and persist', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page);
  await page.goto('/owner/tasks');
  await page.getByRole('button', { name: '新建任务板' }).click();
  await page.getByLabel('新任务板名称').fill('测试看板E2E');
  await page.getByLabel('新任务板名称').press('Enter');
  const board = page.locator('.tb-board', { hasText: '测试看板E2E' });
  await expect(board).toBeVisible();

  // Inline rename through the ⋯ menu.
  await board.getByRole('button', { name: /的操作$/ }).click();
  await page.getByRole('menuitem', { name: '重命名' }).click();
  const nameInput = page.getByRole('textbox', { name: '任务板名称' });
  await nameInput.fill('模型复现E2E');
  await nameInput.press('Enter');
  const renamed = page.locator('.tb-board', { hasText: '模型复现E2E' });
  await expect(renamed).toBeVisible();

  for (const t of ['第一项', '第二项']) {
    await renamed.getByLabel(/添加任务到/).fill(t);
    await renamed.getByLabel(/添加任务到/).press('Enter');
    await expect(renamed.locator('.tb-task', { hasText: t })).toBeVisible();
  }

  // Keyboard reorder: move "第二项" above "第一项", then confirm it persists.
  await renamed.getByRole('button', { name: '拖动排序：第二项（或按 Alt+方向键）' }).focus();
  await page.keyboard.press('Alt+ArrowUp');
  await expect(renamed.locator('.tb-task').first()).toContainText('第二项');
  await page.waitForTimeout(300);
  await page.reload();
  const after = page.locator('.tb-board', { hasText: '模型复现E2E' });
  await expect(after.locator('.tb-task').first()).toContainText('第二项');

  // Complete → moves to the collapsed "已完成" section; uncomplete brings it back.
  await after.locator('.tb-task', { hasText: '第一项' }).getByRole('checkbox').check();
  await expect(after.locator('.tb-list').first().locator('.tb-task', { hasText: '第一项' })).toHaveCount(0);
  await page.reload();
  const b2 = page.locator('.tb-board', { hasText: '模型复现E2E' });
  await b2.getByRole('button', { name: /已完成 1/ }).click();
  const done = b2.locator('.tb-task', { hasText: '第一项' });
  await expect(done).toHaveClass(/is-done/);
  await done.getByRole('checkbox').uncheck();
  await page.reload();
  const b3 = page.locator('.tb-board', { hasText: '模型复现E2E' });
  await expect(b3.locator('.tb-task', { hasText: '第一项' })).not.toHaveClass(/is-done/);

  await b3.locator('.tb-task', { hasText: '第一项' }).hover();
  await b3.getByRole('button', { name: '删除：第一项' }).click();
  await expect(page.locator('.tb-task', { hasText: '第一项' })).toHaveCount(0);

  await b3.getByRole('button', { name: /的操作$/ }).click();
  await page.getByRole('menuitem', { name: '删除任务板' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: '删除' }).click();
  await expect(page.locator('.tb-board', { hasText: '模型复现E2E' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('stat scope: multi-select sites and back to "全站"', async ({ page, request }) => {
  await login(page);
  await page.goto('/owner/display');
  const card = page.locator('.stat-card[data-stat="site-days"]');
  const scope = card.getByRole('group', { name: /显示范围/ });
  await scope.getByRole('button', { name: '研究' }).click();
  await scope.getByRole('button', { name: '技术' }).click();
  await expect(scope.getByRole('button', { name: '研究' })).toHaveAttribute('aria-pressed', 'true');
  await expect(scope.getByRole('button', { name: '全站' })).toHaveAttribute('aria-pressed', 'false');
  await page.waitForTimeout(300);
  // Scoped: shown on /research, not on the home page.
  expect((await visitorText(request, '/research')).text).toContain('建站天数');
  expect((await visitorText(request, '/')).text).not.toContain('建站天数');
  // Deselecting both returns to "全站".
  await scope.getByRole('button', { name: '研究' }).click();
  await scope.getByRole('button', { name: '技术' }).click();
  await expect(scope.getByRole('button', { name: '全站' })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(300);
  expect((await visitorText(request, '/')).text).toContain('建站天数');
});

test('appearance: choosing a theme preset applies to the public site', async ({ page, request }) => {
  const errors = trackErrors(page);
  await login(page);
  await page.goto('/owner/appearance');
  await page.locator('[data-preset-id="ocean"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-preset', 'ocean');
  for (const tab of ['背景与光标', '动效与排版', '分站切换器', '预览悬浮球', '彩蛋', '主题与配色']) {
    await page.getByRole('tab', { name: tab }).click();
  }
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.toast-text').last()).toContainText('外观已保存');
  const home = await visitorText(request, '/');
  expect(home.text).toContain('data-preset="ocean"');
  expect(home.text).toContain('data-bg-effect="bubbles"');
  // Restore the default for other tests.
  await page.locator('[data-preset-id="ink"]').click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('.toast-text').last()).toContainText('外观已保存');
  expect(errors).toEqual([]);
});

test('eggs: triple-clicking the brand mark bursts particles without navigating; Konami works', async ({ page }) => {
  await page.goto('/learning');
  const mark = page.locator('[data-brandmark]');
  await page.waitForLoadState('networkidle');
  await mark.click({ clickCount: 3 });
  await expect(page.locator('.fx-layer .fx-p').first()).toBeAttached();
  await expect(page).toHaveURL(/\/learning$/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(k);
  await expect(page.locator('.egg-note')).toContainText('隐藏的角落');
});

test('no Astro dev toolbar is injected', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('astro-dev-toolbar')).toHaveCount(0);
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
  for (const p of ['/owner', '/owner/posts', '/owner/editor', '/owner/tasks', '/owner/sites', '/owner/display', '/owner/settings', '/owner/knowledge', '/owner/papers', '/owner/appearance']) {
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
