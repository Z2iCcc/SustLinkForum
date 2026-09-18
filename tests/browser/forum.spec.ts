import { test, expect } from "@playwright/test";
import { createSeed } from "../../src/seed";
async function login(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "演示登录", exact: true }).click();
  await page.getByRole("button", { name: "使用演示账号", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}
test("campus scroll, reduced motion, direct entry, desktop layouts and deep links", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /在这里，遇见科大的每一天/ }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/campus-1440.png" });
  for (const id of ["lake", "library", "teaching"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    await expect(page.locator(`#${id} .illustration svg`)).toBeVisible();
  }
  await page.screenshot({ path: "test-results/teaching-1440.png" });
  await page.locator("#library").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/library-1440.png" });
  await page.locator("#lake").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/lake-1440.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator("#lake [data-depth]")
      .first()
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  await page
    .locator(".landing-header")
    .getByRole("link", { name: "进入论坛" })
    .click();
  await expect(page).toHaveURL("/forum");
  await expect(page.locator(".topic-row")).toHaveCount(20);
  await page.screenshot({ path: "test-results/forum-1440.png" });
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.locator(".topic-row")).toHaveCount(6);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/forum");
  await page.screenshot({ path: "test-results/forum-1024.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/");
  await page.screenshot({ path: "test-results/campus-1024.png" });
  await page.goto("/topic/topic-1");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "今天的科大湖，是一整片温柔的蓝" }),
  ).toBeVisible();
  await page.goto("/topic/missing");
  await expect(
    page.getByRole("heading", { name: "这个话题好像走丢了" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("draft, posting, quoting, liking, saving, searching, profile and notices survive refresh", async ({
  page,
}) => {
  await page.goto("/forum");
  await login(page);
  await page.getByRole("button", { name: "发布新笔记" }).click();
  await page.getByLabel("笔记标题").fill("浏览器测试：校园的一天");
  await page
    .getByLabel("笔记正文")
    .fill("第一段：在科大湖边散步。\n\n第二段：<script>不执行</script>");
  await page.reload();
  await expect(page.getByLabel("笔记标题")).toHaveValue(
    "浏览器测试：校园的一天",
  );
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.locator(".compose-preview")).toContainText(
    "<script>不执行</script>",
  );
  await page.getByRole("button", { name: "发布笔记", exact: true }).click();
  await expect(page).toHaveURL(/\/topic\//);
  const topicURL = page.url();
  await page.getByRole("button", { name: "引用", exact: true }).click();
  await page.getByLabel("回复内容").fill("这是一条引用回复。");
  await page.getByRole("button", { name: "发布回复", exact: true }).click();
  await expect(page.locator(".reply-floor .quoted")).toContainText("湖边同学");
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  await page.getByRole("button", { name: "点赞 0", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "已收藏", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "点赞 1", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".reply-floor")).toContainText(
    "这是一条引用回复。",
  );
  await page.screenshot({ path: "test-results/topic-1440.png" });
  await page.goto("/profile?tab=saves");
  await expect(page.locator(".topic-list")).toContainText(
    "浏览器测试：校园的一天",
  );
  await page.getByRole("button", { name: "回复", exact: true }).click();
  await expect(page.locator(".reply-history")).toContainText(
    "这是一条引用回复。",
  );
  await page.locator(".reply-history-item>a").first().click();
  await expect(page).toHaveURL(/#.+/);
  await page.goto("/profile");
  await page.getByRole("button", { name: "编辑资料" }).click();
  await page.getByLabel("昵称", { exact: true }).fill("测试同学");
  await page.getByRole("button", { name: "保存资料" }).click();
  await page.reload();
  await expect(page.locator(".profile-intro h1")).toHaveText("测试同学");
  await page.goto("/search?q=浏览器测试");
  await expect(page.locator(".topic-row")).toHaveCount(1);
  await page.goto("/search?q=不存在的文字xyz");
  await expect(
    page.getByRole("heading", { name: "没有找到相关主题" }),
  ).toBeVisible();
  await page.goto("/messages");
  await page.getByRole("button", { name: "全部已读" }).click();
  await page.reload();
  await expect(page.locator(".notice-row.unread")).toHaveCount(0);
  await page.goto(topicURL);
  await page.getByLabel("只看楼主").check();
  await expect(page.locator(".reply-floor")).toHaveCount(1);
  await page.getByRole("button", { name: "发布回复", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("写一点内容");
});
test("anonymous author information is masked in lists, floors, quotes and notifications", async ({
  page,
}) => {
  const seed = createSeed();
  seed.loggedIn = true;
  seed.notices.push({
    id: "anonymous-notice",
    kind: "reply",
    topicId: "topic-6",
    actorId: "u3",
    read: false,
    createdAt: Date.now(),
  });
  await page.addInitScript(
    (seed) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(seed)),
    seed,
  );
  await page.goto("/board/tree");
  await expect(page.locator(".topic-list")).not.toContainText("晚风来信");
  await page.goto("/topic/topic-6");
  await expect(page.locator(".topic-detail")).not.toContainText("晚风来信");
  await expect(page.locator(".topic-detail")).not.toContainText("今天也早起");
  await page.getByRole("button", { name: "引用", exact: true }).click();
  await page.getByLabel("回复内容").fill("匿名讨论的回复");
  await page.getByRole("button", { name: "发布回复", exact: true }).click();
  await expect(page.locator(".reply-floor").last()).toContainText("匿名同学");
  await expect(page.locator(".reply-floor").last()).not.toContainText(
    "湖边同学",
  );
  await expect(
    page.locator(".reply-floor").last().locator(".quoted"),
  ).toContainText("树洞楼主");
  await page.goto("/messages");
  await expect(page.locator(".notice-row").last()).toContainText("树洞楼主");
  await expect(page.locator(".notice-row").last()).not.toContainText(
    "晚风来信",
  );
});
test("quota failure keeps current interaction alive and reports temporary draft state", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.goto("/forum");
  await login(page);
  await expect(page.getByRole("alert")).toContainText("存储不可用或空间不足");
  await page.goto("/new");
  await page.getByLabel("笔记标题").fill("临时草稿");
  await expect(page.getByLabel("笔记标题")).toHaveValue("临时草稿");
  await expect(page.locator(".draft-status")).toContainText("草稿暂存本页");
});
test("keyboard access, browser history, author filtering and rapid scroll remain usable", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".landing-header .brand")).toBeFocused();
  await page.mouse.wheel(0, 2000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await page.mouse.wheel(0, -1600);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(1000);
  await page.goto("/forum");
  await page.locator(".topic-title").first().click();
  await expect(page).toHaveURL("/topic/topic-7");
  await page.goBack();
  await expect(page).toHaveURL("/forum");
  await page.goForward();
  await expect(page).toHaveURL("/topic/topic-7");
  await page.goto("/topic/topic-1");
  await expect(page.locator(".reply-floor")).toHaveCount(2);
  await page.getByLabel("只看楼主").check();
  await expect(page.locator(".reply-floor")).toHaveCount(1);
  await expect(page.locator(".reply-floor .author-badge")).toHaveText("楼主");
});
test("malformed local data shows recovery feedback without overwriting the original", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("sustlink.forum.v1", '{"version":1}'),
  );
  await page.goto("/forum");
  await expect(page.getByRole("alert")).toContainText("本地数据格式异常");
  await expect(page.locator(".topic-row")).toHaveCount(20);
  expect(
    await page.evaluate(() => localStorage.getItem("sustlink.forum.v1")),
  ).toBe('{"version":1}');
});
