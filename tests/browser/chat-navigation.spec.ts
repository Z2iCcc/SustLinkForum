import { test, expect, type Page } from "@playwright/test";
import { createSeed, ME } from "../../src/seed";
import { addMarketExamples } from "../../src/market/model";
import { startConversation } from "../../src/messaging/model";

async function setup(page: Page) {
  let state = { ...addMarketExamples(createSeed()), loggedIn: true };
  for (const topic of state.topics.filter(
    (t) => t.boardId === "market" && t.authorId !== ME,
  )) {
    state = startConversation(state, topic);
  }
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    state,
  );
  await page.goto("/messages");
}

async function readingY(page: Page) {
  return page.evaluate(() =>
    innerWidth > 760
      ? document.querySelector("#forum-main")!.scrollTop
      : scrollY,
  );
}

for (const width of [1115, 715]) {
  test(`inbox product chat returns to the inbox reading position after reload at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 898 });
    await setup(page);
    const entry = page.locator(".conversation-list > a").last();
    await entry.scrollIntoViewIfNeeded();
    const y = await readingY(page);
    expect(y).toBeGreaterThan(0);
    await entry.click();
    await page.reload();
    await page.getByRole("link", { name: "返回", exact: true }).click();
    await expect(page).toHaveURL(/\/messages$/);
    await expect.poll(() => readingY(page)).toBeCloseTo(y, 0);
  });
}

test("the same product conversation follows its current entry and product card remains a separate action", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/board/market?price=asc");
  await page
    .locator('[data-product="market-demo-0"] .market-product-link')
    .click();
  await page.getByRole("link", { name: "聊一聊", exact: true }).click();
  await page.getByRole("link", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/topic\/market-demo-0$/);
  await page.locator(".notification-link").click();
  await page.locator('[data-conversation="market:market-demo-0"]').click();
  await page.getByRole("link", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await page.locator('[data-conversation="market:market-demo-0"]').click();
  await page.locator(".chat-product").click();
  await expect(page).toHaveURL(/\/topic\/market-demo-0$/);
  await page.getByRole("link", { name: "聊一聊", exact: true }).click();
  await page.reload();
  await page.getByRole("link", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/topic\/market-demo-0$/);
});

test("a direct chat URL and an inbox conversation with a deleted product safely return to messages", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/messages/chat/market-demo-0");
  await page.getByRole("link", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/messages$/);
  await page.locator('[data-conversation="market:market-demo-0"]').click();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("sustlink.forum.v1")!);
    state.topics = state.topics.filter(
      (t: { id: string }) => t.id !== "market-demo-0",
    );
    localStorage.setItem("sustlink.forum.v1", JSON.stringify(state));
  });
  await page.reload();
  await expect(page.locator(".chat-product.unavailable")).toBeVisible();
  await page.getByRole("link", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/messages$/);
});

test("browser back and forward retain the inbox entry for a product conversation", async ({
  page,
}) => {
  await setup(page);
  await page.locator('[data-conversation="market:market-demo-0"]').click();
  await page.goBack();
  await expect(page).toHaveURL(/\/messages$/);
  await page.goForward();
  await page.reload();
  await page.getByRole("link", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/messages$/);
});
