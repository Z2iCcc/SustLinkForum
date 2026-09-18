import { test, expect, type Page } from "@playwright/test";
import { createSeed, ME } from "../../src/seed";
import { publishTopic, addReply } from "../../src/store";

async function setup(page: Page) {
  let state = createSeed();
  state.loggedIn = true;
  state.users.find((u) => u.id === ME)!.name = "在科大认真记录生活的同学";
  state = publishTopic(
    state,
    {
      boardId: "life",
      categoryId: "sports",
      title: "安静输入与列表验证",
      body: "保留详细内容。",
    },
    "quiet-note",
  );
  state = addReply(
    state,
    "quiet-note",
    "我的回复内容",
    undefined,
    "quiet-reply",
  );
  state.saves.push("quiet-note");
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    state,
  );
}

test("all content lists abbreviate names, hide dates and show only a static board label in details", async ({
  page,
}) => {
  await setup(page);
  for (const path of [
    "/forum",
    "/board/life",
    "/search?q=安静输入",
    "/profile?tab=topics",
    "/profile?tab=saves",
  ]) {
    await page.goto(path);
    const row = page.locator(".topic-row").filter({
      has: page.getByRole("link", {
        name: "安静输入与列表验证",
        exact: true,
      }),
    });
    const author = row.locator(".topic-author");
    await expect(author).toHaveText("在科大认真记录生活的同学");
    await expect(author).toHaveCSS("text-overflow", "ellipsis");
    expect(await author.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(
      true,
    );
    if (path === "/forum") {
      const siteName = page.locator('.topic-author[title="SustLink 小站"]');
      await expect(siteName).toHaveText("SustLink 小站");
      for (const width of [1440, 1024]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await siteName.evaluate((e) => e.scrollWidth <= e.clientWidth),
        ).toBe(true);
      }
    }
    await expect(row.locator("time, .meta-dot")).toHaveCount(0);
    await row.click({ position: { x: 8, y: 8 } });
    await expect(page.locator(".detail-tags .board-tag")).toHaveText(
      "日常生活",
    );
    await expect(
      page.locator(".detail-tags a, .detail-tags select"),
    ).toHaveCount(0);
    const label = page.locator(".detail-tags .board-tag");
    const background = await label.evaluate(
      (e) => getComputedStyle(e).backgroundColor,
    );
    await label.hover();
    await expect(label).toHaveCSS("background-color", background);
    await expect(label).toHaveCSS("cursor", "default");
    await expect(
      page.locator(".original-post .floor-header strong"),
    ).toHaveText("在科大认真记录生活的同学");
    await expect(page.locator(".original-post .floor-header time")).toHaveCount(
      1,
    );
    await expect(page.locator(".detail-heading time")).toHaveCount(0);
  }
  await page.goto("/profile?tab=replies");
  const reply = page
    .locator(".reply-history-item")
    .filter({ hasText: "我的回复内容" });
  await expect(reply.locator(".topic-author")).toHaveText(
    "在科大认真记录生活的同学",
  );
  expect(
    await reply
      .locator(".topic-author")
      .evaluate((e) => e.scrollWidth > e.clientWidth),
  ).toBe(true);
  await expect(reply.locator(".reply-history-meta")).not.toContainText(
    /\d{2}\/\d{2}|\d{2}:\d{2}/,
  );
  await reply.click({ position: { x: 8, y: 8 } });
  await expect(page.locator("#quiet-reply .floor-header time")).toHaveCount(1);
});

test("compose and reply fields keep a steady background through hover, typing and reload", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/new?board=life");
  for (const label of ["笔记标题", "笔记正文"]) {
    const input = page.getByLabel(label, { exact: true });
    await expect(input).toHaveCSS("background-color", "rgb(253, 254, 254)");
    await input.hover();
    await expect(input).toHaveCSS("background-color", "rgb(253, 254, 254)");
    await input.click();
    await input.fill(
      label === "笔记标题" ? "稳定编辑验证" : "输入时背景保持不变",
    );
    await expect(input).toHaveCSS("background-color", "rgb(253, 254, 254)");
    await expect(input).toHaveCSS("box-shadow", "none");
    await expect(input).toHaveCSS("outline-style", "none");
  }
  await page.reload();
  await expect(page.getByLabel("笔记正文", { exact: true })).toHaveValue(
    "输入时背景保持不变",
  );
  await page.getByRole("button", { name: "发布笔记", exact: true }).click();
  const reply = page.getByLabel("回复内容");
  await reply.hover();
  await expect(reply).toHaveCSS("background-color", "rgb(253, 254, 254)");
  await reply.fill("回复时背景也保持不变");
  await expect(reply).toHaveCSS("background-color", "rgb(253, 254, 254)");
  await page.getByRole("button", { name: "发布回复", exact: true }).click();
  await page.reload();
  await expect(page.locator(".reply-floor .post-body")).toHaveText(
    "回复时背景也保持不变",
  );
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await reply.hover();
    await page.screenshot({
      path: `test-results/quiet-editor-${width}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto("/profile");
  await page.getByRole("button", { name: "编辑资料", exact: true }).click();
  for (const input of await page
    .locator(".profile-form input, .profile-form textarea")
    .all()) {
    await input.hover();
    await expect(input).toHaveCSS("background-color", "rgb(253, 254, 254)");
    await input.focus();
    await expect(input).toHaveCSS("background-color", "rgb(253, 254, 254)");
  }
});
