import { test, expect, type Page } from "@playwright/test";
import { createSeed, ME } from "../../src/seed";
import { addReply, publishTopic } from "../../src/store";

async function setup(page: Page) {
  const seed = createSeed();
  seed.loggedIn = true;
  let state = seed;
  for (let i = 0; i < 24; i++)
    state = publishTopic(
      state,
      { boardId: "study", title: `个人笔记${i}`, body: "用于验证返回的位置" },
      `mine-${i}`,
    );
  state = addReply(state, "mine-23", "", undefined, "mine-reply", Date.now(), [
    {
      id: "test-file",
      name: "资料.pdf",
      kind: "file",
      mime: "application/pdf",
      size: 10,
    },
  ]);
  state.replies.push({
    id: "other-quote",
    topicId: "mine-23",
    body: "引用这份资料",
    quoteId: "mine-reply",
    authorId: state.users.find((u) => u.id !== ME)!.id,
    createdAt: Date.now() + 1,
  });
  state.saves = ["mine-23", "mine-22"];
  state.topics.find((topic) => topic.id === "mine-23")!.attachments = [
    ...state.replies.find((reply) => reply.id === "mine-reply")!.attachments!,
  ];
  state.replyLikes = ["mine-reply"];
  state.notices.push({
    id: "reply-notice",
    kind: "reply",
    topicId: "mine-23",
    replyId: "mine-reply",
    read: false,
    createdAt: Date.now(),
  });
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    state,
  );
}

test("personal entries return to the same tab, page and scroll, including after sort and reload", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/forum");
  await page
    .locator(".left-sidebar")
    .getByRole("link", { name: "个人主页", exact: true })
    .click();
  await expect(page).toHaveURL("/profile");
  await expect(page.locator(".list-tabs .active")).toHaveText("笔记");
  await page.screenshot({ path: "test-results/profile-entry-1440.png" });
  for (const [url, selector] of [
    ["/profile?tab=topics&page=2", ".topic-row"],
    ["/profile?tab=saves", ".topic-activity"],
    ["/profile?tab=replies", ".reply-history-item"],
  ]) {
    await page.goto(url);
    const entry = page.locator(selector).first();
    await entry.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() =>
      innerWidth > 760
        ? document.getElementById("forum-main")!.scrollTop
        : scrollY,
    );
    await entry.click({ position: { x: 8, y: 8 } });
    await expect(page.locator(".forum-main > .breadcrumb")).toHaveText(
      "个人主页",
    );
    await page.getByRole("combobox", { name: "回复排序" }).click();
    await page.getByRole("option", { name: "时间倒序" }).click();
    await page.reload();
    await page.locator(".forum-main > .breadcrumb").click();
    await expect(page).toHaveURL(url);
    await expect
      .poll(() =>
        page.evaluate(() =>
          innerWidth > 760
            ? document.getElementById("forum-main")!.scrollTop
            : scrollY,
        ),
      )
      .toBeCloseTo(y, 0);
    await expect(page.locator(".left-sidebar a[href='/profile']")).toHaveClass(
      /active/,
    );
  }
  await page.goto("/profile?tab=replies");
  await page.locator(".reply-history-item").first().click();
  await page.locator("#other-quote .quoted").click();
  await expect(page.locator(".forum-main > .breadcrumb")).toHaveText(
    "个人主页",
  );
  await page.locator(".forum-main > .breadcrumb").click();
  await expect(page).toHaveURL("/profile?tab=replies");
  await page.goto("/profile?tab=topics");
  await page.locator(".topic-attachment-hints").first().click();
  await expect(page.locator(".forum-main > .breadcrumb")).toHaveText(
    "个人主页",
  );
  await page.screenshot({ path: "test-results/profile-note-return-1440.png" });
  await page.locator(".original-post .delete-note").click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page).toHaveURL("/profile?tab=topics");
  await page.goto("/topic/mine-22");
  await expect(page.locator(".forum-main > .breadcrumb")).toHaveText(
    "学习交流",
  );
});

test("reply deletion cleans up likes and notices, keeps quoted replies and stable floors", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/topic/mine-23");
  await expect(page.locator("#other-quote .quoted")).toContainText("点击查看");
  await expect(page.locator("#other-quote .quoted")).not.toContainText(
    "点击楼层查看",
  );
  await expect(page.locator("#other-quote .delete-note")).toBeVisible();
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const selector of [".original-post", "#mine-reply"]) {
      const row = page.locator(selector);
      const remove = row.getByRole("button", { name: "删除", exact: true });
      await expect(remove).toBeVisible();
      const a = await remove.boundingBox(),
        b = await row.locator(".reaction-like").boundingBox();
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
      expect(a!.x).toBeGreaterThan(b!.x);
    }
  }
  const remove = page.locator("#mine-reply .delete-note");
  await remove.click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await expect(remove).toBeVisible();
  await remove.click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.locator("#mine-reply")).toHaveCount(0);
  await expect(page.locator("#other-quote .quoted")).toHaveText(
    "引用的内容已删除",
  );
  await expect(page.locator("#other-quote .floor-number")).toHaveText("#3");
  await page.getByLabel("回复内容").fill("删除后继续讨论");
  await page.getByRole("button", { name: "发布回复", exact: true }).click();
  await expect(
    page.locator(".reply-floor").last().locator(".floor-number"),
  ).toHaveText("#4");
  await page.reload();
  await expect(page.locator("#mine-reply")).toHaveCount(0);
  await page.locator("#other-quote").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/reply-delete-1024.png" });
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sustlink.forum.v1")!),
  );
  expect(stored.replyLikes).not.toContain("mine-reply");
  expect(
    stored.notices.some(
      (n: { replyId?: string }) => n.replyId === "mine-reply",
    ),
  ).toBe(false);
  await page.goto("/profile?tab=replies");
  await expect(page.locator("a[href='/topic/mine-23#mine-reply']")).toHaveCount(
    0,
  );
});

test("note owners can delete others' replies only on their own notes, without success toasts", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/topic/mine-23");
  await page.locator("#other-quote .delete-note").click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.locator("#other-quote")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#other-quote")).toHaveCount(0);
  await page.locator(".original-post .delete-note").click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page).toHaveURL("/board/study");
  await expect(page.locator(".toast")).toHaveCount(0);
  await page.goto("/topic/topic-1");
  const rights = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("sustlink.forum.v1")!);
    return s.replies
      .filter((r: { topicId: string }) => r.topicId === "topic-1")
      .map((r: { id: string; authorId: string }) => ({
        id: r.id,
        own: r.authorId === "me",
      }));
  });
  expect(rights.some((r: { own: boolean }) => !r.own)).toBe(true);
  for (const reply of rights)
    await expect(page.locator(`#${reply.id} .delete-note`)).toHaveCount(
      reply.own ? 1 : 0,
    );
});

test("failed reply deletion leaves the reply available after reload", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/topic/mine-23");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page.locator("#mine-reply .delete-note").click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("原内容仍保留");
  await page.reload();
  await expect(page.locator("#mine-reply")).toBeVisible();
  await expect(page.locator("#mine-reply .reaction-like")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
