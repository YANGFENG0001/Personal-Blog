import { expect, type Page } from '@playwright/test';

export const OWNER = { username: 'owner', password: 'e2e-password-123' };

export async function login(page: Page) {
  await page.goto('/owner/login');
  await page.getByLabel('用户名').fill(OWNER.username);
  await page.getByLabel('密码').fill(OWNER.password);
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/owner$/);
}

/** Collect console errors / CSP violations / uncaught exceptions on a page. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
