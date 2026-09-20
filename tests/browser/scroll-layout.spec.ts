import { test, expect, type Page } from "@playwright/test";
import { createSeed } from "../../src/seed";
import { addMarketExamples } from "../../src/market/model";
import { mkdir } from "node:fs/promises";

async function setup(page: Page, path = "/board/market") {
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    {
      ...addMarketExamples(createSeed()),
      loggedIn: true,
    },
  );
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
}

test("desktop wheel scrolls only the hovered column, including at its boundaries", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1468, height: 650 });
  await setup(page);
  const main = page.locator("#forum-main"),
    left = page.locator(".left-sidebar"),
    right = page.locator(".right-sidebar");
  await main.hover();
  await page.mouse.wheel(0, 450);
  await expect
    .poll(() => main.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(100);
  const mainY = await main.evaluate((e) => e.scrollTop);
  expect(await left.evaluate((e) => e.scrollTop)).toBe(0);
  expect(await right.evaluate((e) => e.scrollTop)).toBe(0);
  await right.hover();
  await page.mouse.wheel(0, 350);
  await expect
    .poll(() => right.evaluate((e) => e.scrollTop))
    .toBeGreaterThan(0);
  expect(await main.evaluate((e) => e.scrollTop)).toBe(mainY);
  await left.hover();
  await page.mouse.wheel(0, 350);
  await expect.poll(() => left.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
  expect(await main.evaluate((e) => e.scrollTop)).toBe(mainY);
  await main.evaluate((e) => (e.scrollTop = e.scrollHeight));
  const sideY = await right.evaluate((e) => e.scrollTop);
  await main.hover();
  await page.mouse.wheel(0, 450);
  expect(await right.evaluate((e) => e.scrollTop)).toBe(sideY);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await mkdir("artifacts/scroll-layout", { recursive: true });
  await page.screenshot({ path: "artifacts/scroll-layout/columns.png" });
});

test("list titles use 15px and browser back restores the center reading position", async ({
  page,
}) => {
  await setup(page, "/board/life");
  await expect(page.locator(".topic-title").first()).toHaveCSS(
    "font-size",
    "15px",
  );
  const main = page.locator("#forum-main");
  const title = page.locator(".topic-title").last();
  await title.scrollIntoViewIfNeeded();
  const y = await main.evaluate((e) => e.scrollTop);
  expect(y).toBeGreaterThan(0);
  await title.click();
  await expect(page).toHaveURL(/\/topic\//);
  await page.goBack();
  await expect.poll(() => main.evaluate((e) => e.scrollTop)).toBeCloseTo(y, 0);
});

test("chat scrolls history while the composer stays still and focus matches header search", async ({
  page,
}) => {
  await setup(page, "/topic/market-demo-0");
  await page.getByLabel("搜索全站帖子").focus();
  await expect(page.locator('.global-search')).toHaveCSS('border-color','rgb(108, 159, 189)');
  const searchShadow = await page.locator('.global-search').evaluate(
    (e) => getComputedStyle(e).boxShadow,
  );
  await page.getByRole("link", { name: "聊一聊", exact: true }).click();
  for (let n = 0; n < 10; n++)
    await page
      .getByRole("button", { name: "模拟卖家回复", exact: true })
      .click();
  const log = page.getByRole("log", { name: "聊天记录" }),
    input = page.getByLabel("消息", { exact: true });
  await input.focus();
  await expect(input).toHaveCSS("outline-style", "none");
  await expect(input).toHaveCSS("box-shadow", searchShadow);
  expect(searchShadow).not.toBe("none");
  const composer = await page.locator(".chat-composer").boundingBox();
  const bottom = await log.evaluate((e) => e.scrollTop);
  await log.hover();
  await page.mouse.wheel(0, -400);
  await expect
    .poll(() => log.evaluate((e) => e.scrollTop))
    .toBeLessThan(bottom - 50);
  expect(await page.locator(".chat-composer").boundingBox()).toEqual(composer);
  expect(await page.locator("#forum-main").evaluate((e) => e.scrollTop)).toBe(
    0,
  );
  const y = await log.evaluate((e) => e.scrollTop);
  await log.focus();
  await page.keyboard.press("Home");
  await expect.poll(() => log.evaluate((e) => e.scrollTop)).toBeLessThan(y);
  await mkdir("artifacts/scroll-layout", { recursive: true });
  await page.screenshot({ path: "artifacts/scroll-layout/chat-desktop.png" });
});

test("phone keeps document scrolling and publishing dropdowns work inside the desktop scroller", async ({
  page,
}) => {
  await setup(page, "/new?board=market");
  await page.locator("#pub-category").click();
  await expect(page.locator(".option-popover")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator("#pub-board").click();
  const y = await page.locator("#forum-main").evaluate((e) => e.scrollTop);
  await page.getByRole("option", { name: "失物招领", exact: true }).click();
  await expect
    .poll(() => page.locator("#forum-main").evaluate((e) => e.scrollTop))
    .toBe(y);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/board/market");
  await page.mouse.move(200, 500);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(100);
  expect(
    await page
      .locator("#forum-main")
      .evaluate((e) => getComputedStyle(e).overflowY),
  ).toBe("visible");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
