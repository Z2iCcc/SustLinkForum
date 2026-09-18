import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function login(page: Page) {
  await page.getByRole("button", { name: "演示登录", exact: true }).click();
  await page.getByRole("button", { name: "使用演示账号", exact: true }).click();
}
async function picture(page: Page) {
  return {
    name: "校园.png",
    mimeType: "image/png",
    buffer: await page.screenshot(),
  };
}

test("image, playable video and document files persist through draft, publish, reply and download", async ({
  page,
}) => {
  await page.goto("/forum");
  await login(page);
  const png = await picture(page);
  const video = await readFile(
    new URL("../fixtures/campus.webm", import.meta.url),
  );
  await page.getByRole("button", { name: "发布新笔记" }).click();
  await page.getByLabel("笔记标题").fill("校园多媒体分享");
  await page.getByLabel("主题添加图片", { exact: true }).setInputFiles(png);
  await expect(page.locator(".upload-file")).toHaveCount(1);
  await page.getByLabel("主题添加视频", { exact: true }).setInputFiles({
    name: "湖边.webm",
    mimeType: "video/webm",
    buffer: video,
  });
  await expect(page.locator(".upload-file")).toHaveCount(2);
  const pdf = Buffer.from("%PDF-1.4\nCampus attachment test\n%%EOF");
  await page.getByLabel("主题添加附件", { exact: true }).setInputFiles([
    { name: "资料.pdf", mimeType: "application/pdf", buffer: pdf },
    {
      name: "资料.zip",
      mimeType: "application/zip",
      buffer: Buffer.from("PK\u0005\u0006" + "\0".repeat(18)),
    },
    {
      name: "笔记.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: Buffer.from("document download fixture"),
    },
  ]);
  await expect(page.locator(".upload-file")).toHaveCount(5);
  await page.reload();
  await expect(page.locator(".upload-file")).toHaveCount(5);
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.screenshot({
    path: "test-results/compose-files-1024.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.locator(".compose-preview .file-attachment")).toHaveCount(
    3,
  );
  await page
    .getByRole("button", { name: "放大图片 校园.png", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "图片预览 校园.png" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "发布笔记", exact: true }).click();
  await expect(page).toHaveURL(/\/topic\//);
  const url = page.url();
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator(".image-open img")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThan(0);
  await page.locator("video").evaluate(async (v: HTMLVideoElement) => {
    v.muted = true;
    await v.play();
  });
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(0);
  const downloaded = page.waitForEvent("download");
  await page
    .locator(".file-attachment")
    .filter({
      has: page.getByRole("link", { name: "下载 资料.pdf", exact: true }),
    })
    .click({ position: { x: 8, y: 8 } });
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("资料.pdf");
  expect(await readFile((await download.path())!)).toEqual(pdf);
  await page.getByLabel("回复添加图片", { exact: true }).setInputFiles(png);
  await expect(page.locator(".upload-file")).toHaveCount(1);
  await page.getByRole("button", { name: "发布回复", exact: true }).click();
  await expect(page.locator(".reply-floor .image-open")).toHaveCount(1);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    scrollTo(0, 0);
  });
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({
    path: "test-results/media-1440.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.screenshot({
    path: "test-results/media-1024.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/search?q=校园多媒体分享");
  await expect(page.locator(".topic-media-summary")).toContainText("1 张图片");
  await expect(page.locator(".topic-media-summary")).toContainText("1 个视频");
  await expect(page.locator(".topic-media-summary")).toContainText("3 个附件");
  await page.goto(url);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("sustlink.media.v1");
      r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  });
  await page.reload();
  await expect(page.locator(".media-placeholder").first()).toContainText(
    "本地文件已不存在",
  );
});

test("avatar changes persist and anonymous posts do not reveal the uploaded avatar", async ({
  page,
}) => {
  await page.goto("/forum");
  await login(page);
  const png = await picture(page);
  await page.goto("/profile");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "更换头像" }).click();
  await (await chooser).setFiles(png);
  await expect(page.locator(".change-avatar img")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator(".change-avatar img")
        .evaluate((i: HTMLImageElement) => i.naturalWidth),
    )
    .toBe(256);
  await page.reload();
  await expect(page.locator(".change-avatar img")).toHaveCount(1);
  await expect(page.locator(".header-profile .avatar img")).toHaveCount(1);
  await page.screenshot({ path: "test-results/profile-avatar-1440.png" });
  await page.goto("/new?board=tree");
  await page.getByLabel("笔记标题").fill("匿名头像测试");
  await page.getByLabel("笔记正文").fill("这是匿名主题");
  await page.getByRole("button", { name: "发布笔记", exact: true }).click();
  await expect(page.locator(".topic-detail .avatar img")).toHaveCount(0);
});

test("compose returns to source with search, pagination and scroll intact, including after refresh", async ({
  page,
}) => {
  await page.goto("/forum");
  await login(page);
  for (const source of [
    "/forum?page=2&sort=new",
    "/search?q=图书馆&board=study",
    "/profile?tab=saves",
    "/topic/topic-1",
  ]) {
    await page.goto(source);
    await page.getByRole("button", { name: "发布新笔记" }).click();
    await expect(page).toHaveURL(/\/new/);
    await page.reload();
    await page.locator(".compose-back").click();
    await expect(page).toHaveURL(source);
  }
  await page.goto("/forum?page=2&sort=new");
  await page.evaluate(() => scrollTo(0, 40));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(40);
  await page.getByRole("button", { name: "发布新笔记" }).click();
  await page.getByLabel("笔记标题").fill("继续写的草稿");
  await page
    .getByRole("button", { name: "保存草稿并返回", exact: true })
    .click();
  await expect(page).toHaveURL("/forum?page=2&sort=new");
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(40);
  await page.goForward();
  await expect(page.getByLabel("笔记标题")).toHaveValue("继续写的草稿");
});

test("seven categories, whole-card navigation, focus ring and reaction states are clear at desktop widths", async ({
  page,
}) => {
  await page.goto("/forum");
  await login(page);
  const expected = [
    "校园资讯",
    "日常生活",
    "学习交流",
    "社团活动",
    "跳蚤市场",
    "失物招领",
    "匿名树洞",
  ];
  const links = page.locator('.left-sidebar a[href^="/board/"]');
  expect(await links.allTextContents()).toEqual(expected);
  const card = page.locator(".topic-row").first();
  await page.mouse.move(0, 0);
  await expect
    .poll(async () => {
      const rect = (await card.boundingBox())!;
      const next = (await page.locator(".topic-row").nth(1).boundingBox())!;
      return next.y - (rect.y + rect.height);
    })
    .toBe(0);
  expect(
    (await page.locator(".forum-layout").boundingBox())!.width,
  ).toBeLessThanOrEqual(1200);
  expect((await card.boundingBox())!.height).toBeLessThan(90);
  await expect(page.locator(".topic-list .topic-excerpt")).toHaveCount(0);
  await expect(page.locator(".topic-list .topic-media-summary")).toHaveCount(0);
  const rest = await card.boundingBox();
  await card.hover();
  expect(await card.boundingBox()).toEqual(rest);
  expect(await card.evaluate((e) => getComputedStyle(e).transform)).toBe(
    "none",
  );
  expect(await card.evaluate((e) => getComputedStyle(e).boxShadow)).toBe(
    "none",
  );
  await card.locator(".topic-title").focus();
  await expect(card.locator(".topic-title")).toBeFocused();
  const target = await card.locator(".topic-title").getAttribute("href");
  await card.click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL(target!);
  await page
    .locator(".original-post")
    .getByRole("button", { name: /^点赞/ })
    .click();
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  for (const cls of ["reaction-like", "reaction-save"]) {
    await expect(page.locator(".original-post ." + cls)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      await page
        .locator(".original-post ." + cls + " svg")
        .evaluate((e) => getComputedStyle(e).fill),
    ).not.toBe("none");
  }
  await page.screenshot({ path: "test-results/reactions-1440.png" });
  await page.reload();
  await expect(page.locator(".reaction-save")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .locator(".original-post .reaction-like svg")
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page.goto("/forum");
  await page.locator(".global-search").click({ position: { x: 8, y: 20 } });
  await expect(page.locator(".global-search input")).toBeFocused();
  expect(
    await page
      .locator(".global-search input")
      .evaluate((e) => getComputedStyle(e).outlineStyle),
  ).toBe("none");
  expect(
    await page
      .locator(".global-search")
      .evaluate((e) => getComputedStyle(e).boxShadow),
  ).not.toBe("none");
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    const rowBox = (await page.locator(".topic-row").first().boundingBox())!;
    const activityBox = (await page
      .locator(".topic-activity")
      .first()
      .boundingBox())!;
    expect(activityBox.x + activityBox.width).toBeLessThan(
      rowBox.x + rowBox.width - 12,
    );
    expect(
      await page
        .locator(".topic-activity")
        .first()
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/refined-forum-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const link of await links.all()) {
      expect(await link.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
        true,
      );
    }
  }
  await page.locator(".topic-row").first().locator(".board-tag").click();
  await expect(page).toHaveURL("/board/notice");
  await page.goto("/board/help");
  await expect(page).toHaveURL("/board/life");
});

test("unsupported and empty uploads show errors without breaking the draft", async ({
  page,
}) => {
  await page.goto("/forum");
  await login(page);
  await page.goto("/new");
  await page.getByLabel("笔记标题").fill("保留草稿");
  await page.getByLabel("主题添加附件", { exact: true }).setInputFiles({
    name: "test.html",
    mimeType: "text/html",
    buffer: Buffer.from("<h1>test</h1>"),
  });
  await expect(page.getByRole("alert")).toContainText("支持的附件格式");
  await page.getByLabel("主题添加附件", { exact: true }).setInputFiles({
    name: "空.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(0),
  });
  await expect(page.getByRole("alert")).toContainText("空文件");
  await expect(page.locator(".upload-file")).toHaveCount(0);
  await expect(page.getByLabel("笔记标题")).toHaveValue("保留草稿");
  await page.getByLabel("主题添加附件", { exact: true }).setInputFiles({
    name: "可移除.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("pdf"),
  });
  await expect(page.locator(".upload-file")).toHaveCount(1);
  await page
    .getByRole("button", { name: "移除 可移除.pdf", exact: true })
    .click();
  await expect(page.locator(".upload-file")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".upload-file")).toHaveCount(0);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByLabel("主题添加附件", { exact: true }).setInputFiles({
    name: "存储失败.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("pdf"),
  });
  await expect(page.getByRole("alert")).toContainText("文件未保存");
  await expect(page.locator(".upload-file")).toHaveCount(0);
  await expect(page.getByLabel("笔记标题")).toHaveValue("保留草稿");
});
