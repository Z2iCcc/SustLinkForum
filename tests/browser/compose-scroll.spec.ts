import { test, expect } from "@playwright/test";
import { createSeed } from "../../src/seed";
import { emptyPublishing } from "../../src/publishing/model";
for (const viewport of [
  { width: 1436, height: 898 },
  { width: 1008, height: 694 },
  { width: 655, height: 694 },
  { width: 390, height: 898 },
])
  test(`switching publishing boards preserves scroll at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/forum");
    const state = { ...createSeed(), loggedIn: true };
    state.draft = {
      boardId: "market",
      title: "",
      body: "",
      publishing: emptyPublishing("market"),
    };
    await page.evaluate(
      (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
      state,
    );
    await page.goto("/new?board=market");
    await page.locator("#pub-board").waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const name of [
      "社团活动",
      "失物招领",
      "跳蚤市场",
      "失物招领",
      "社团活动",
      "校园资讯",
    ]) {
      await page.evaluate(() =>
        (innerWidth > 760
          ? document.getElementById("forum-main")!
          : window
        ).scrollTo(0, 60),
      );
      const before = await page.evaluate(() =>
        innerWidth > 760
          ? document.getElementById("forum-main")!.scrollTop
          : scrollY,
      );
      await page.locator("#pub-board").click();
      const opened = await page.evaluate(() =>
        innerWidth > 760
          ? document.getElementById("forum-main")!.scrollTop
          : scrollY,
      );
      await page.getByRole("option", { name, exact: true }).click();
      await page.waitForTimeout(250);
      const after = await page.evaluate(() =>
        innerWidth > 760
          ? document.getElementById("forum-main")!.scrollTop
          : scrollY,
      );
      expect(opened).toBe(before);
      expect(after).toBe(before);
    }
    const generic = page.getByRole("combobox", { name: "发布到", exact: true });
    const before = await page.evaluate(() =>
      innerWidth > 760
        ? document.getElementById("forum-main")!.scrollTop
        : scrollY,
    );
    await generic.selectOption("market");
    await expect(page.locator("#pub-board")).toBeVisible();
    expect(
      await page.evaluate(() =>
        innerWidth > 760
          ? document.getElementById("forum-main")!.scrollTop
          : scrollY,
      ),
    ).toBe(before);
    await page.locator("#pub-board").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(page.locator("#pub-board")).toContainText("失物招领");
    await expect(page.locator("#pub-board")).toBeFocused();
    expect(
      await page.evaluate(() =>
        innerWidth > 760
          ? document.getElementById("forum-main")!.scrollTop
          : scrollY,
      ),
    ).toBe(before);
  });
