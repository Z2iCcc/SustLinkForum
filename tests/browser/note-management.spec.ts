import { test, expect, type Page } from "@playwright/test";
import { createSeed, ME } from "../../src/seed";
import { publishTopic, addReply } from "../../src/store";

async function seedOwn(page: Page) {
  const seed = createSeed();
  seed.loggedIn = true;
  let state = publishTopic(
    seed,
    { boardId: "study", title: "删除流程测试笔记", body: "仅用于自动测试" },
    "own-note",
  );
  state = addReply(state, "own-note", "相关回复测试", undefined, "own-reply");
  state.likes.push("own-note");
  state.saves.push("own-note");
  state.replyLikes = ["own-reply"];
  state.notices.push({
    id: "own-notice",
    kind: "reply",
    topicId: "own-note",
    replyId: "own-reply",
    actorId: ME,
    read: false,
    createdAt: Date.now(),
  });
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    state,
  );
  await page.goto("/topic/own-note");
  return seed;
}

test("deleting an own note confirms, cascades and persists across all entry points", async ({
  page,
}) => {
  const seed = await seedOwn(page);
  await page
    .locator(".original-post")
    .getByRole("button", { name: "删除", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "是否确认删除笔记？" });
  await expect(
    dialog.getByRole("button", { name: "取消", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "删除流程测试笔记" }),
  ).toBeVisible();
  await page
    .locator(".original-post")
    .getByRole("button", { name: "删除", exact: true })
    .click();
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  await page
    .locator(".original-post")
    .getByRole("button", { name: "删除", exact: true })
    .click();
  await page.screenshot({ path: "test-results/delete-note-1440.png" });
  await dialog.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page).toHaveURL("/board/study");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sustlink.forum.v1")!),
  );
  expect(stored.topics).toHaveLength(seed.topics.length);
  expect(stored.replies).toEqual(seed.replies);
  expect(stored.likes).not.toContain("own-note");
  expect(stored.saves).not.toContain("own-note");
  expect(stored.replyLikes).not.toContain("own-reply");
  expect(stored.notices).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "own-notice" })]),
  );
  for (const url of [
    "/forum",
    "/search?q=删除流程测试笔记",
    "/profile?tab=topics",
    "/profile?tab=replies",
    "/profile?tab=saves",
    "/messages",
  ]) {
    await page.goto(url);
    await expect(
      page.getByText("删除流程测试笔记", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("相关回复测试", { exact: true })).toHaveCount(
      0,
    );
  }
  await expect(
    page.getByRole("button", { name: "发布新笔记", exact: true }),
  ).toBeVisible();
  await page.goto("/profile");
  for (const name of ["笔记", "回复", "收藏"])
    await expect(
      page.locator(".list-tabs").getByRole("button", { name, exact: true }),
    ).toBeVisible();
  await page.goto("/topic/own-note");
  await expect(
    page.getByText("笔记可能已删除", { exact: false }),
  ).toBeVisible();
  await page.goto(`/topic/${seed.topics.find((t) => t.authorId !== ME)!.id}`);
  await expect(
    page
      .locator(".original-post")
      .getByRole("button", { name: "删除", exact: true }),
  ).toHaveCount(0);
});

test("failed deletion persistence keeps the note and its interactions", async ({
  page,
}) => {
  await seedOwn(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "QuotaExceededError");
    };
  });
  await page
    .locator(".original-post")
    .getByRole("button", { name: "删除", exact: true })
    .click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("删除未保存");
  await expect(
    page.getByRole("dialog", { name: "是否确认删除笔记？" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "删除流程测试笔记" }),
  ).toBeVisible();
  await expect(page.locator(".original-post .reaction-save")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#own-reply")).toBeVisible();
});

test("reply sort follows popup direction and supports keyboard, dismissal and resize", async ({
  page,
}) => {
  await page.goto("/topic/topic-1");
  const trigger = page.getByRole("combobox", { name: "回复排序", exact: true });
  const root = page.locator(".reply-sort-select");
  await trigger.evaluate((e) =>
    document.querySelector('#forum-main')!.scrollBy(0, e.getBoundingClientRect().top - 220),
  );
  await trigger.click();
  await expect(root).toHaveAttribute("data-placement", "bottom");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveText("点赞最多");
  await expect(page).toHaveURL(/replySort=likes/);
  await trigger.click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveText("点赞最多");
  await page.setViewportSize({ width: 1024, height: 460 });
  await trigger.evaluate((e) =>
    document.querySelector('#forum-main')!.scrollBy(0, e.getBoundingClientRect().top - (innerHeight - 65)),
  );
  await trigger.click();
  await expect(root).toHaveAttribute("data-placement", "top");
  const menu = await page.getByRole("listbox").boundingBox();
  const button = await trigger.boundingBox();
  expect(menu!.y + menu!.height).toBeLessThan(button!.y);
  await expect(trigger.locator("svg")).toHaveCSS(
    "transform",
    "matrix(-1, 0, 0, -1, 0, 0)",
  );
  await page.screenshot({ path: "test-results/reply-sort-up-1024.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(root).toHaveAttribute("data-placement", "bottom");
  await page.getByRole("option", { name: "时间倒序" }).click();
  await expect(trigger).toHaveText("时间倒序");
  await trigger.click();
  await page.locator(".detail-heading").click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("只看楼主")).toBeFocused();
});
