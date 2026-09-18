import { test, expect, type Page } from "@playwright/test";
import { createSeed } from "../../src/seed";
import {
  emptyPublishing,
  legacyCategory,
  type PublishingData,
} from "../../src/publishing/model";
import type { PublishBoard } from "../../src/publishing/model";
import { mkdir } from "node:fs/promises";
async function setup(
  page: Page,
  board: PublishBoard,
  fields: Partial<PublishingData> = {},
  filled = false,
) {
  const state = { ...createSeed(), loggedIn: true };
  const publishing = { ...emptyPublishing(board), ...fields };
  state.draft = {
    boardId: board,
    title: filled ? "校园活动测试" : "",
    body: filled ? "填写具体内容，用于测试发布。" : "",
    publishing,
    categoryId: legacyCategory(publishing),
  };
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    state,
  );
  await page.goto("/new?board=" + board);
}
async function choose(page: Page, key: string, value: string) {
  await page.locator("#pub-" + key).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7fQAAAAASUVORK5CYII=",
  "base64",
);
test("market creates a real local topic with metadata and persistent image, while modes keep their own drafts", async ({
  page,
}) => {
  await setup(page, "market");
  await page.locator("#topic-title").fill("转让高数教材");
  await page.locator("#pub-body").fill("有少量笔记，封面完整。");
  await choose(page, "category", "教材书籍");
  await page.locator("#pub-price").fill("18");
  await page.locator("#pub-place").fill("图书馆附近");
  await page.getByRole("button", { name: "发布闲置", exact: true }).click();
  await expect(page.getByText("请至少添加 1 张实物图片")).toBeVisible();
  await page.getByLabel("添加图片或视频", { exact: true }).setInputFiles({
    name: "book.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await expect(page.locator(".pub-media-tile")).toHaveCount(1);
  await expect(page.locator(".pub-cover")).toHaveText("封面");
  await page.getByRole("button", { name: "求购", exact: true }).click();
  await page.locator("#topic-title").fill("求购计算器");
  await page.getByRole("button", { name: "闲置", exact: true }).click();
  await expect(page.locator("#topic-title")).toHaveValue("转让高数教材");
  await expect(page.locator("#pub-price")).toHaveValue("18");
  await page.reload();
  await expect(page.locator(".pub-media-tile img")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(page.locator("#pub-category")).toContainText("教材书籍");
  await expect(page.locator(".pub-required:visible")).toHaveCount(0);
  await page.getByRole("button", { name: "发布闲置", exact: true }).click();
  await expect(page).toHaveURL(/\/topic\//);
  await expect(page.locator(".post-body").first()).toHaveText(
    "有少量笔记，封面完整。",
  );
  await expect(page.locator(".publishing-panel")).toHaveCount(0);
  const topic = await page.evaluate(
    () => JSON.parse(localStorage.getItem("sustlink.forum.v1")!).topics[0],
  );
  expect(topic.publishing.price).toBe("18");
  expect(topic.attachments).toHaveLength(1);
  expect(topic.categoryId).toBe("books");
});
test("lost form uses shared dropdown and six-row calendar, privacy tooltip, and persists selection", async ({
  page,
}) => {
  await setup(page, "lost", { date: "2026-09-08" });
  await page.locator("#pub-date").click();
  await expect(page.locator(".calendar-grid tbody tr")).toHaveCount(6);
  const height = (await page.locator(".calendar-popover").boundingBox())!
    .height;
  await page.locator(".calendar-year-toggle").click();
  await expect(page.getByRole("button", { name: "返回日历" })).toHaveCount(0);
  expect(
    (await page.locator(".calendar-popover").boundingBox())!.height,
  ).toBeCloseTo(height, 0);
  await page.locator(".year-grid button.selected").click();
  await expect(page.locator(".calendar-grid")).toBeVisible();
  await page.locator(".calendar-prev").click();
  await expect(page.locator(".calendar-grid tbody tr")).toHaveCount(6);
  expect(
    (await page.locator(".calendar-popover").boundingBox())!.height,
  ).toBeCloseTo(height, 0);
  await page.locator(".calendar-clear").click();
  await expect(page.locator("#pub-date-label .pub-required")).toBeVisible();
  await page.locator("#pub-date").click();
  await page.locator(".calendar-today").click();
  await expect(page.locator("#pub-date-label .pub-required")).toBeHidden();
  await choose(page, "period", "晚上");
  await choose(page, "category", "生活用品");
  await page.reload();
  await expect(page.locator("#pub-period")).toContainText("晚上");
  await page.locator("#pub-period").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(page.locator("#pub-period")).toContainText("不确定");
  await page.getByRole("button", { name: "发布内容提示" }).click();
  await expect(page.getByRole("tooltip")).toHaveText("请勿发布敏感信息");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(page.locator("[data-help]")).toHaveCount(1);
});
test("clubs time picker commits, constrains and supports drag; all three modes recover correctly", async ({
  page,
}) => {
  await setup(
    page,
    "clubs",
    {
      category: "文体活动",
      organizer: "摄影社",
      start: "2030-09-12T16:00",
      end: "2030-09-12T18:00",
      place: "科大湖",
    },
    true,
  );
  await page.locator("#pub-end").click();
  await expect(page.locator('[data-day="2030-09-11"]')).toBeDisabled();
  await page.locator('[data-day="2030-09-12"]').click();
  await expect(
    page
      .getByRole("listbox", { name: "小时", exact: true })
      .getByRole("option", { name: "15", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await page.locator('[data-day="2030-09-13"]').click();
  const wheel = page.getByRole("listbox", { name: "小时", exact: true });
  const r = (await wheel.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + 90);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2, r.y + 18, { steps: 8 });
  await page.mouse.up();
  await expect(wheel.getByRole("option", { selected: true })).toHaveText("20");
  await page.locator(".datetime-confirm").click();
  await expect(page.locator("#pub-end")).toContainText("2030 / 09 / 13 20:00");
  await page.locator("#pub-start").click();
  await page.locator('[data-day="2030-09-14"]').click();
  await page.locator(".datetime-confirm").click();
  await expect(page.locator("#pub-end")).toContainText("选择日期和时间");
  await page.getByRole("button", { name: "链接报名", exact: true }).click();
  await page.locator("#pub-deadline").click();
  await page.locator(".calendar-year-toggle").click();
  await page.locator(".years-next").click();
  await page.locator('[data-year="2030"]').click();
  await expect(page.locator('[data-day="2030-09-15"]')).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "招新", exact: true }).click();
  await expect(page.locator("#pub-start")).toHaveCount(0);
  await expect(page.locator("#pub-deadline")).toBeVisible();
  await page.locator("#topic-title").fill("摄影社招新");
  await page.getByRole("button", { name: "回顾", exact: true }).click();
  await expect(page.getByRole("group", { name: "报名方式" })).toHaveCount(0);
  await page.getByRole("button", { name: "招新", exact: true }).click();
  await expect(page.locator("#topic-title")).toHaveValue("摄影社招新");
  await choose(page, "board", "失物招领");
  await expect(
    page.getByRole("heading", { name: "发布寻物", exact: true }),
  ).toBeVisible();
});
test("publishing layouts align to the existing panel and all dropdowns stay inside the viewport", async ({
  page,
}) => {
  await mkdir("artifacts/publishing-integrated", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const board of ["market", "clubs", "lost"] as const) {
    await setup(page, board);
    for (const width of [1440, 1024, 655, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.locator(".pub-media input[type=file]")).toBeHidden();
      await page.evaluate(() => document.fonts.ready);
      const heading = await page
        .locator(".publishing-panel .page-heading")
        .evaluate(
          (e) =>
            e.getBoundingClientRect().left +
            parseFloat(getComputedStyle(e).paddingLeft),
        );
      const field = (await page.locator("#pub-board").boundingBox())!;
      expect(Math.abs(field.x - heading)).toBeLessThan(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.locator("#pub-category").click();
      const popup = (await page.locator(".option-popover").boundingBox())!;
      expect(popup.x).toBeGreaterThanOrEqual(0);
      expect(popup.x + popup.width).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
      await page.evaluate(() => scrollTo(0, 0));
      if (width === 1440 || width === 1024)
        await page.screenshot({
          path: `artifacts/publishing-integrated/${board}-${width}.png`,
          fullPage: true,
        });
    }
  }
  expect(errors).toEqual([]);
});
test("board publish entry opens the requested form while retaining another board draft", async ({
  page,
}) => {
  await setup(page, "market");
  await page.locator("#topic-title").fill("未完成的闲置");
  await choose(page, "board", "学习交流");
  await page.getByLabel("笔记标题").fill("未完成的学习笔记");
  await page.goto("/board/lost?category=found");
  await page.getByRole("button", { name: "发布新笔记", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "发布招领", exact: true }),
  ).toBeVisible();
  await choose(page, "board", "跳蚤市场");
  await expect(page.locator("#topic-title")).toHaveValue("未完成的闲置");
  await choose(page, "board", "学习交流");
  await expect(page.getByLabel("笔记标题")).toHaveValue("未完成的学习笔记");
});
