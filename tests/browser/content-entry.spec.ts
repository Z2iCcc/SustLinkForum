import { test, expect } from "@playwright/test";
import { createSeed, ME } from "../../src/seed";

test("compose back label identifies its source and keeps the original route after reload", async ({
  page,
}) => {
  const seed = createSeed();
  seed.loggedIn = true;
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    seed,
  );
  for (const [source, label] of [
    ["/board/study", "学习交流"],
    ["/board/life", "日常生活"],
    ["/forum?page=2", "论坛首页"],
    ["/search?q=图书馆", "搜索结果"],
    ["/profile?tab=saves", "收藏"],
    ["/topic/topic-1", seed.topics[0].title],
  ]) {
    await page.goto(source);
    await page.getByRole("button", { name: "发布新笔记" }).click();
    await expect(page.locator(".compose-back")).toHaveText(label);
    await page.reload();
    await expect(page.locator(".compose-back")).toHaveText(label);
    await page.locator(".compose-back").click();
    await expect(page).toHaveURL(source);
  }
  await page.goto("/board/study");
  await page.getByRole("button", { name: "发布新笔记" }).click();
  await page.screenshot({ path: "test-results/source-label-1440.png" });
});

test("attachment indicators remain compact, descriptive and clickable without previews", async ({
  page,
}) => {
  const seed = createSeed();
  seed.topics[0].attachments = [
    { id: "a", name: "湖.png", kind: "image", mime: "image/png", size: 123 },
    { id: "b", name: "路.png", kind: "image", mime: "image/png", size: 123 },
    { id: "c", name: "湖.mp4", kind: "video", mime: "video/mp4", size: 123 },
    {
      id: "d",
      name: "资料.pdf",
      kind: "file",
      mime: "application/pdf",
      size: 123,
    },
  ];
  await page.addInitScript(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    seed,
  );
  await page.goto("/forum");
  const row = page
    .locator(".topic-row")
    .filter({ has: page.locator('.topic-title[href="/topic/topic-1"]') });
  const hints = row.locator(".topic-attachment-hints");
  await expect(hints).toHaveAttribute("title", "2 张图片、1 个视频、1 个附件");
  await expect(hints.locator("svg")).toHaveCount(3);
  await expect(page.locator(".topic-thumbnails,.topic-excerpt")).toHaveCount(0);
  await expect(page.locator(".topic-attachment-hints")).toHaveCount(1);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    const label = (await row.locator(".topic-title").boundingBox())!,
      icons = (await hints.boundingBox())!,
      box = (await row.boundingBox())!;
    expect(icons.x).toBeGreaterThanOrEqual(label.x + label.width);
    expect(icons.x + icons.width).toBeLessThan(box.x + box.width);
    await page.screenshot({
      path: `test-results/attachment-hints-${width}.png`,
    });
  }
  await hints.click();
  await expect(page).toHaveURL("/topic/topic-1");
  await page.goBack();
  await row.click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL("/topic/topic-1");
});

test("reply controls use background feedback instead of outline rings for pointer and keyboard focus", async ({
  page,
}) => {
  const seed = createSeed();
  seed.loggedIn = true;
  await page.addInitScript(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    seed,
  );
  await page.goto("/topic/topic-1");
  for (const item of [
    page.getByLabel("回复排序", { exact: true }),
    page.getByLabel("回复内容"),
    page.getByLabel("回复添加图片", { exact: true }),
    page.getByRole("button", { name: "发布回复", exact: true }),
    page.locator("#reply-0-1 .reaction-like"),
  ]) {
    await item.focus();
    expect(await item.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
      "none",
    );
    expect(await item.evaluate((e) => getComputedStyle(e).boxShadow)).toBe(
      "none",
    );
  }
  await page.getByLabel("回复添加图片", { exact: true }).focus();
  expect(
    await page
      .locator(".reply-editor .upload-action")
      .first()
      .evaluate((e) => getComputedStyle(e).outlineStyle),
  ).toBe("none");
  await page.getByLabel("回复内容").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("回复添加图片", { exact: true })).toBeFocused();
  expect(
    await page
      .locator(".reply-editor .upload-action")
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  await page.locator(".reply-editor").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/reply-subtle-focus.png" });
  await page.getByLabel("回复排序", { exact: true }).click();
  await page.getByRole("option", { name: "时间倒序" }).click();
  await expect(page.locator(".reply-floor").first()).toHaveAttribute(
    "id",
    "reply-0-2",
  );
});

test("content containers navigate from empty padding while secondary actions keep their own targets", async ({
  page,
}) => {
  const seed = createSeed();
  seed.loggedIn = true;
  seed.replies.push({
    id: "mine",
    topicId: "topic-1",
    authorId: ME,
    body: "自己的回复",
    createdAt: Date.now(),
    quoteId: "topic-1",
  });
  await page.addInitScript(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    seed,
  );
  await page.goto("/profile?tab=replies");
  await page
    .locator(".reply-history-item")
    .first()
    .click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL("/topic/topic-1#mine");
  await page.locator("#mine .quoted").click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL("/topic/topic-1#floor-1");
  await page.goto("/messages");
  await page
    .locator(".notice-row")
    .first()
    .click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL("/topic/topic-2#reply-1-1");
  await page.goto("/forum");
  await page.locator(".daily-prompt").click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL("/topic/topic-1");
  await page.goto("/forum");
  await page.locator(".announcement-panel").click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL("/topic/topic-7");
  await page.goto("/forum");
  await page
    .locator(".announcement-panel")
    .getByRole("link", { name: "查看公告" })
    .click();
  await expect(page).toHaveURL("/board/notice");
  await page.goto("/forum");
  await page.locator(".topic-row").first().locator(".board-tag").click();
  await expect(page).toHaveURL("/board/notice");
  await page.goto("/search?q=科大湖");
  await page
    .locator(".topic-row")
    .first()
    .click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL("/topic/topic-1");
});
