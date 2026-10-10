import { test, expect } from '@playwright/test';
import { trackErrors } from './helpers';

test('mobile: dial becomes a bottom sheet, layout has no horizontal overflow', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.locator('[data-dial-toggle]').click();
  await expect(page.locator('.dial-list')).toBeVisible();
  await page.locator('.dial-list a', { hasText: '技术' }).click();
  await expect(page).toHaveURL(/\/tech$/);
  expect(errors).toEqual([]);
});

test('mobile: avatar card opens on tap', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-avatar-btn]').click();
  await expect(page.locator('.avatar-pop')).toBeVisible();
});
