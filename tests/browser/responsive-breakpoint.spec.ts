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
