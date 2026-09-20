import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { createSeed } from '../../src/seed';

test('content fills the single column across the sidebar breakpoint during live resizing', async ({ page }) => {
  await page.goto('/forum');
  await page.evaluate(s => localStorage.setItem('sustlink.forum.v1', JSON.stringify(s)), { ...createSeed(), loggedIn: true });
  await mkdir('artifacts/responsive-breakpoint', { recursive: true });
  for (const path of ['/forum', '/board/life', '/profile', '/topic/topic-2', '/board/market']) {
    await page.setViewportSize({ width: 1000, height: 897 });
    await page.goto(path);
    // Cross both sides without navigation: this reproduces dragging the window edge.
    for (const width of [761, 760, 749, 721, 720, 421, 749, 761]) {
      await page.setViewportSize({ width, height: 897 });
      const layout = page.locator('.forum-layout');
      const main = page.locator('#forum-main');
      if (width <= 760) {
        await expect(page.locator('.left-sidebar')).toBeHidden();
        await expect.poll(async () => {
          const outer = await layout.boundingBox();
          const inner = await main.boundingBox();
          return Math.abs(outer!.width - inner!.width);
        }).toBeLessThan(1);
        expect((await main.boundingBox())!.width).toBeGreaterThan(width - 70);
      } else {
        await expect(page.locator('.left-sidebar')).toBeVisible();
        await expect(main).toHaveCSS('overflow-y', 'auto');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path === '/forum' && width === 749) {
        await page.screenshot({ path: 'artifacts/responsive-breakpoint/forum-749.png' });
      }
    }
  }
});

test('topic rows retain avatars and aligned metadata when the header switches to compact mode', async ({ page }) => {
  await page.setViewportSize({ width: 749, height: 897 });
  await page.goto('/forum');
  await page.evaluate(s => localStorage.setItem('sustlink.forum.v1', JSON.stringify(s)), { ...createSeed(), loggedIn: true });
  await page.reload();
  const firstRow = page.locator('.topic-row').first();
  const initialHeight = (await firstRow.boundingBox())!.height;
  for (const width of [721, 720, 693, 749]) {
    await page.setViewportSize({ width, height: 897 });
    await expect(firstRow.locator('.avatar')).toBeVisible();
    expect((await firstRow.boundingBox())!.height).toBeCloseTo(initialHeight, 0);
    const context = await firstRow.locator('.topic-context').boundingBox();
    const activity = await firstRow.locator('.topic-activity').boundingBox();
    expect(context!.y + context!.height / 2).toBeCloseTo(activity!.y + activity!.height / 2, 0);
  }
  for (const path of ['/forum', '/board/life', '/profile']) {
    await page.goto(path);
    for (const width of [693, 421, 320]) {
      await page.setViewportSize({ width, height: 897 });
      const row = page.locator('.topic-row').first();
      if (await row.count()) {
        await expect(row.locator('.avatar')).toBeVisible();
        const summary = await row.locator('.topic-summary').boundingBox();
        for (const selector of ['.topic-title-line', '.topic-context', '.topic-activity']) {
          const child = await row.locator(selector).boundingBox();
          expect(child!.x).toBeGreaterThanOrEqual(summary!.x);
          expect(child!.x + child!.width).toBeLessThanOrEqual(summary!.x + summary!.width + 1);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (path === '/forum') {
        await mkdir('artifacts/responsive-breakpoint', { recursive: true });
        await page.screenshot({ path: `artifacts/responsive-breakpoint/topic-rows-${width}.png` });
      }
    }
  }
});
