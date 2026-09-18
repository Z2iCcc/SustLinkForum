import { test, expect, type Page } from "@playwright/test";
import { createSeed } from "../../src/seed";
async function login(page: Page) {
  await page.getByRole("button", { name: "演示登录", exact: true }).click();
  await page.getByRole("button", { name: "使用演示账号", exact: true }).click();
}

test("compose focus uses a subtle background; title input enforces 20 graphemes including IME and emoji", async ({
  page,
}) => {
  await page.goto("/forum");
  await login(page);
  await page.goto("/new");
  const title = page.getByLabel("笔记标题");
  await title.fill("科".repeat(21));
  await expect(title).toHaveValue("科".repeat(20));
  await expect(page.locator("#title-count")).toHaveText("20 / 20");
  await title.fill("科".repeat(19) + "👨‍👩‍👧‍👦");
  await expect(page.locator("#title-count")).toHaveText("20 / 20");
  await title.dispatchEvent("compositionstart");
  await title.fill("校".repeat(21));
  await title.dispatchEvent("compositionend");
  await expect(title).toHaveValue("校".repeat(20));
  await page.getByLabel("笔记正文").fill("正文");
  for (const control of [
    page.getByLabel("发布到"),
    title,
    page.getByLabel("笔记正文"),
  ]) {
    await control.focus();
    expect(
      await control.evaluate((e) => getComputedStyle(e).outlineStyle),
    ).toBe("none");
    expect(await control.evaluate((e) => getComputedStyle(e).boxShadow)).toBe(
      "none",
    );
    expect(
      await control.evaluate((e) => getComputedStyle(e).borderTopWidth),
    ).toBe("1px");
  }
  for (const label of ["主题添加图片", "主题添加视频", "主题添加附件"]) {
    const upload = page.getByLabel(label, { exact: true });
    await upload.focus();
    const wrapper = upload.locator("..");
    await expect(wrapper).toHaveCSS("outline-style", "none");
    await expect(wrapper).toHaveCSS("box-shadow", "none");
    await expect(wrapper).toHaveCSS("background-color", "rgb(237, 243, 247)");
    await wrapper.hover();
    await page.mouse.down();
    await expect(wrapper).toHaveCSS("transform", "none");
    await expect(wrapper).toHaveCSS("background-color", "rgb(227, 237, 243)");
    await page.mouse.move(1, 1);
    await page.mouse.up();
  }
  await page.screenshot({ path: "test-results/compose-feedback-1440.png" });
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.screenshot({ path: "test-results/compose-feedback-1024.png" });
  await page.getByRole("button", { name: "发布笔记", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "校".repeat(20), exact: true }),
  ).toBeVisible();
});

test("legacy long draft is retained and requests shortening before publication", async ({
  page,
}) => {
  const seed = createSeed();
  seed.loggedIn = true;
  seed.draft = { boardId: "life", title: "旧".repeat(30), body: "原草稿正文" };
  await page.addInitScript(
    (seed) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(seed)),
    seed,
  );
  await page.goto("/new");
  await expect(page.getByLabel("笔记标题")).toHaveValue("旧".repeat(30));
  await expect(page.locator("#title-count")).toContainText("请缩短后发布");
  await expect(
    page.getByRole("button", { name: "发布笔记", exact: true }),
  ).toBeDisabled();
});

test("reply likes toggle, sort survives refresh and floor/quote identities stay stable", async ({
  page,
}) => {
  await page.goto("/topic/topic-1");
  await page
    .locator("#reply-0-2")
    .getByRole("button", { name: /点赞回复/ })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "使用演示账号", exact: true }).click();
  const like = page
    .locator("#reply-0-2")
    .getByRole("button", { name: /点赞回复/ });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("回复排序", { exact: true }).click();
  await page.getByRole("option", { name: "点赞最多" }).click();
  await expect(page.locator(".reply-floor").first()).toHaveAttribute(
    "id",
    "reply-0-2",
  );
  await expect(
    page.locator(".reply-floor").first().locator(".floor-number"),
  ).toHaveText("#3");
  await page.reload();
  await expect(page.getByLabel("回复排序", { exact: true })).toHaveText(
    "点赞最多",
  );
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("只看楼主").check();
  await expect(page.locator(".reply-floor")).toHaveCount(1);
  await page.getByLabel("只看楼主").uncheck();
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".reply-floor").first()).toHaveAttribute(
    "id",
    "reply-0-1",
  );
  await page.getByLabel("回复排序", { exact: true }).click();
  await page.getByRole("option", { name: "时间倒序" }).click();
  await expect(page.locator(".reply-floor").first()).toHaveAttribute(
    "id",
    "reply-0-2",
  );
  await page
    .locator("#reply-0-2")
    .getByRole("button", { name: "引用回复", exact: true })
    .click();
  await expect(page.locator(".reply-quote-preview")).toContainText("#3");
  await page.getByLabel("回复内容").fill("按点赞排序后也能正确引用");
  await page.getByRole("button", { name: "发布回复", exact: true }).click();
  await expect(
    page.locator(".reply-floor").first().locator(".floor-number"),
  ).toHaveText("#4");
  await expect(
    page.locator(".reply-floor").first().locator(".quoted"),
  ).toContainText("#3");
  await page.getByLabel("回复排序", { exact: true }).click();
  await page.getByRole("option", { name: "时间正序" }).click();
  await expect(page.locator(".reply-floor").first()).toHaveAttribute(
    "id",
    "reply-0-1",
  );
  await page.locator(".replies-heading").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/reply-controls-1440.png" });
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.screenshot({ path: "test-results/reply-controls-1024.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("reply/view columns align across large numbers without showing body previews", async ({
  page,
}) => {
  const seed = createSeed();
  seed.topics[0].views = 17000;
  seed.topics[1].views = 18000;
  seed.topics[2].views = 9999;
  seed.topics[3].views = 100000000;
  await page.addInitScript(
    (seed) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(seed)),
    seed,
  );
  await page.goto("/forum");
  await expect(page.locator(".topic-excerpt")).toHaveCount(0);
  await expect(page.locator(".topic-activity")).toContainText(["1.7万"]);
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    const labels = await page.locator(".topic-row").evaluateAll((rows) =>
      rows.slice(0, 5).map((row) => {
        const stats = row.querySelectorAll(".topic-stat");
        return Array.from(stats).map((stat) => {
          const label = stat.lastElementChild!.getBoundingClientRect();
          return { x: label.x, right: label.right };
        });
      }),
    );
    for (const row of labels) expect(row).toEqual(labels[0]);
    for (const row of await page.locator(".topic-row").all()) {
      const rowBox = (await row.boundingBox())!,
        stats = (await row.locator(".topic-activity").boundingBox())!;
      expect(stats.x + stats.width).toBeLessThan(rowBox.x + rowBox.width - 10);
    }
    await page.screenshot({ path: `test-results/aligned-counts-${width}.png` });
  }
});
