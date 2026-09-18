import { test, expect, type Page } from "@playwright/test";
import { createSeed } from "../../src/seed";
import { publishTopic } from "../../src/store";
import { categories } from "../../src/categories";

async function setup(page: Page) {
  let state = createSeed();
  state.loggedIn = true;
  for (let i = 0; i < 23; i++)
    state = publishTopic(
      state,
      {
        boardId: "study",
        categoryId: "resources",
        title: `分类资料${i}`,
        body: "课程资料正文",
      },
      `category-${i}`,
    );
  state = publishTopic(
    state,
    {
      boardId: "life",
      categoryId: "sports",
      title: "运动分享",
      body: "运动的日常",
    },
    "sports-note",
  );
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    state,
  );
}
test("category icon opens compact filters, preserves sort/page on navigation and shows legacy notes", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/forum?sort=new&page=2");
  const trigger = page.getByRole("button", { name: "分类筛选", exact: true });
  await trigger.hover();
  await expect(page.locator("#forum-categories")).toBeHidden();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "学习交流", exact: true }).click();
  await page.getByRole("button", { name: "资料分享", exact: true }).click();
  await expect(page).toHaveURL(/sort=new&board=study&category=resources/);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.locator(".topic-row")).toHaveCount(20);
  await expect(trigger).toHaveText("分类");
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const stat = await page.locator(".topic-activity").first().boundingBox();
    const row = await page.locator(".topic-row").first().boundingBox();
    expect(stat!.x + stat!.width).toBeLessThanOrEqual(row!.x + row!.width);
    await page.screenshot({ path: `test-results/categories-${width}.png` });
  }
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.locator(".topic-row")).toHaveCount(3);
  const source = new URL(page.url()).pathname + new URL(page.url()).search;
  await page
    .locator(".topic-row")
    .first()
    .click({ position: { x: 8, y: 8 } });
  await page.getByRole("combobox", { name: "回复排序" }).click();
  await page.getByRole("option", { name: "时间倒序" }).click();
  await page.reload();
  await page.locator(".forum-main > .breadcrumb").click();
  await expect(page).toHaveURL(source);
  await page.reload();
  await expect(trigger).toHaveText("分类");
  await trigger.click();
  await page.getByRole("button", { name: "未分类", exact: true }).click();
  await expect(page.locator(".topic-row")).not.toHaveCount(0);
  await page.getByRole("button", { name: "日常生活", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("category")).toBe(false);
});
test("all boards expose the correct categories and invalid links have a clear recovery", async ({
  page,
}) => {
  await setup(page);
  for (const [board, options] of Object.entries(categories)) {
    await page.goto(`/board/${board}`);
    await page.getByRole("button", { name: "分类筛选", exact: true }).click();
    for (const option of options)
      await expect(
        page.getByRole("button", { name: option.name, exact: true }),
      ).toBeVisible();
    if (!options.length)
      await expect(page.getByText("本板块暂不细分")).toBeVisible();
  }
  await page.goto("/board/study?category=sports");
  await expect(
    page.getByRole("heading", { name: "这个分类已不可用" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "查看全部", exact: true }).click();
  await expect(page).toHaveURL("/board/study");
});
test("compose inherits category, retains changed draft after reload and published categories stay read-only", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/board/study?category=resources&sort=new");
  await page.getByRole("button", { name: "发布新笔记", exact: true }).click();
  await expect(page.getByLabel("笔记二级分类")).toHaveValue("resources");
  await page.getByLabel("笔记二级分类").selectOption("exams");
  await page.reload();
  await expect(page.getByLabel("笔记二级分类")).toHaveValue("exams");
  await page.getByLabel("发布到").selectOption("life");
  await expect(page.getByLabel("笔记二级分类")).toHaveValue("");
  await page.getByLabel("笔记二级分类").selectOption("food");
  await page.getByLabel("笔记标题").fill("分类草稿验证");
  await page.getByLabel("笔记正文").fill("食堂里的小发现");
  await page.reload();
  await expect(page.getByLabel("笔记二级分类")).toHaveValue("food");
  await page.screenshot({ path: "test-results/category-compose-1440.png" });
  await page.getByRole("button", { name: "发布笔记", exact: true }).click();
  await expect(page.getByLabel("调整笔记分类")).toHaveCount(0);
  await expect(page.locator(".detail-tags .category-tag")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".detail-tags .category-tag")).toHaveCount(0);
  await expect(page.locator(".detail-heading time")).toHaveCount(0);
  await expect(page.locator(".original-post .floor-header time")).toHaveCount(
    1,
  );
  await page.goto("/board/life?category=food");
  await expect(
    page.getByRole("link", { name: "分类草稿验证", exact: true }),
  ).toBeVisible();
});
test("search combines keyword and category and preserves pagination", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/search?q=资料&board=study");
  await page.getByRole("button", { name: "分类筛选", exact: true }).click();
  await page.getByRole("button", { name: "资料分享", exact: true }).click();
  await expect(page.locator(".topic-row")).toHaveCount(20);
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.locator(".topic-row")).toHaveCount(3);
  expect(new URL(page.url()).searchParams.get("category")).toBe("resources");
  await page.getByLabel("搜索关键词").fill("课程资料");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  expect(new URL(page.url()).searchParams.get("category")).toBe("resources");
  await page.getByRole("button", { name: "日常生活", exact: true }).click();
  expect(new URL(page.url()).searchParams.has("category")).toBe(false);
});

test("quiet lists retain categories in details and collapsed filters can be cleared in context", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/forum?board=study&category=resources&sort=new&page=2");
  await expect(page.locator(".category-summary")).toHaveText(
    "当前筛选：学习交流 / 资料分享",
  );
  await expect(page.locator(".topic-meta .category-tag")).toHaveCount(0);
  await expect(page.locator(".topic-meta .board-tag")).toHaveCount(3);
  await expect(page.locator(".pagination")).not.toContainText("共");
  await page.getByRole("button", { name: "清除分类筛选", exact: true }).click();
  await expect(page).toHaveURL("/forum?sort=new");
  await expect(
    page.getByRole("button", { name: "分类筛选", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".category-summary")).toHaveCount(0);
  await page.goto("/board/study?category=resources&sort=new&page=2");
  await expect(page.locator(".category-summary")).toHaveText(
    "当前筛选：资料分享",
  );
  await expect(page.locator(".topic-meta .board-tag")).toHaveCount(0);
  await expect(page.locator(".topic-excerpt")).toHaveCount(0);
  await page.getByRole("button", { name: "分类筛选", exact: true }).click();
  await expect(page.locator(".category-summary")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "资料分享", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "分类筛选", exact: true }).click();
  await page.getByRole("button", { name: "清除分类筛选", exact: true }).click();
  await expect(page).toHaveURL("/board/study?sort=new");
  await page.goto("/board/life?category=sports");
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator(".pagination")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "test-results/quiet-board-" + width + ".png",
    });
  }
  await page.locator(".topic-row").click({ position: { x: 8, y: 8 } });
  await expect(page.getByLabel("调整笔记分类")).toHaveCount(0);
  await expect(page.locator(".detail-tags .category-tag")).toHaveCount(0);
  await page.locator(".forum-main > .breadcrumb").click();
  await expect(page).toHaveURL("/board/life?category=sports");
  await expect(page.locator(".category-summary")).toHaveText(
    "当前筛选：运动健身",
  );
  await page.goto("/search?q=运动&board=life&category=sports");
  await expect(page.locator(".topic-meta .board-tag")).toHaveCount(1);
  await expect(page.locator(".topic-meta .category-tag")).toHaveCount(0);
  await expect(page.locator(".topic-excerpt")).toBeVisible();
  await page.getByRole("button", { name: "清除分类筛选", exact: true }).click();
  await expect(page).toHaveURL("/search?q=运动");
});

test("profile lists hide footer totals and paginate only when needed", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/profile?tab=topics");
  await expect(page.locator(".topic-meta .category-tag")).toHaveCount(0);
  await expect(page.locator(".pagination")).toBeVisible();
  await expect(page.locator(".pagination")).not.toContainText("共");
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator(".topic-row")).toHaveCount(5);
  await page.goto("/profile?tab=saves");
  await expect(page.locator(".pagination")).toHaveCount(0);
  await page.goto("/profile?tab=replies");
  await expect(page.locator(".pagination")).toHaveCount(0);
});

test("search uses one category entry and shared search field feedback", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/search");
  await expect(
    page.getByText("输入关键词开始搜索", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("#search-board")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "分类筛选", exact: true }),
  ).toHaveCount(1);
  const field = page.locator(".search-field"),
    header = page.locator(".global-search");
  await header.hover();
  await expect(header).toHaveCSS("background-color", "rgb(237, 243, 247)");
  await field.hover();
  await expect(field).toHaveCSS("background-color", "rgb(237, 243, 247)");
  await field.click({ position: { x: 10, y: 15 } });
  await expect(page.getByLabel("搜索关键词")).toBeFocused();
  await expect(page.getByLabel("搜索关键词")).toHaveCSS(
    "outline-style",
    "none",
  );
  await expect(field).toHaveCSS("border-color", "rgb(108, 159, 189)");
  await expect
    .poll(() => field.evaluate((e) => getComputedStyle(e).boxShadow))
    .not.toBe("none");
  await page.getByRole("button", { name: "分类筛选", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "学习交流", exact: true }).click();
  await page.getByRole("button", { name: "资料分享", exact: true }).click();
  await page.getByRole("button", { name: "分类筛选", exact: true }).click();
  await expect(page.locator(".category-summary")).toHaveText(
    "当前筛选：学习交流 / 资料分享",
  );
  await page.getByLabel("搜索关键词").fill("课程资料");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page.locator(".topic-row")).toHaveCount(20);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByLabel("搜索关键词").focus();
    await page.screenshot({
      path: "test-results/merged-search-" + width + ".png",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "清除分类筛选", exact: true }).click();
  await expect(page).toHaveURL("/search?q=课程资料");
  await expect(page.locator(".category-summary")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#search-board")).toHaveCount(0);
});
