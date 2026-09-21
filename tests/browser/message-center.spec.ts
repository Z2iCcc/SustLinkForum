import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createSeed, ME } from "../../src/seed";
import { addMarketExamples } from "../../src/market/model";
import {
  startConversation,
  sendChat,
  startDirectConversation,
  sendDirectChat,
  publicChatUsers,
} from "../../src/messaging/model";

async function setup(page: Page) {
  let state = { ...addMarketExamples(createSeed()), loggedIn: true };
  const peer = publicChatUsers(state)[0];
  state = startConversation(
    state,
    state.topics.find((t) => t.id === "market-demo-0")!,
  );
  state = sendChat(
    state,
    "market-demo-0",
    "你好，教材还在，明天下午可以在图书馆面交。",
    "product-incoming",
    true,
  );
  state = startDirectConversation(state, peer.id);
  state = sendDirectChat(
    state,
    peer.id,
    "你分享的学习方法很有帮助，一起去图书馆吗？",
    "direct-incoming",
    true,
  );
  state.conversations![0].readAt = 0;
  state.directConversations![0].readAt = 0;
  state.notices.push({
    id: "received-like",
    kind: "like",
    topicId: "topic-2",
    actorId: peer.id,
    read: false,
    createdAt: Date.now(),
  });
  await page.goto("/forum");
  await page.evaluate(
    (s) => localStorage.setItem("sustlink.forum.v1", JSON.stringify(s)),
    state,
  );
  await page.goto("/messages");
  return { state, peer };
}

test("message hub groups received notifications and preserves avatars and previews on narrow screens", async ({
  page,
}) => {
  await setup(page);
  await mkdir("artifacts/message-center", { recursive: true });
  for (const width of [1468, 715, 421, 320]) {
    await page.setViewportSize({ width, height: 897 });
    await expect(page.locator(".message-shortcuts > a")).toHaveCount(2);
    await expect(page.locator(".conversation-list > a")).toHaveCount(2);
    await expect(
      page.locator(".conversation-list .avatar").first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/message-center/inbox-${width}.png`,
    });
  }
  await page.locator(".message-shortcuts a").first().click();
  await expect(
    page.getByRole("heading", { name: "赞和收藏", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".notice-row")).toHaveCount(1);
  await expect(page.locator(".notice-row")).toContainText("赞了你的主题");
  await page.locator(".notice-row").click();
  await expect(page).toHaveURL(/topic\/topic-2/);
  await page.locator(".notification-link").click();
  await expect(
    page.locator(".message-shortcuts a").first().locator(".message-unread"),
  ).toHaveCount(0);
});

test("classmate chat opens from a public author, preserves draft and messages and appears in inbox", async ({
  page,
}) => {
  const { state, peer } = await setup(page);
  const topic = state.topics.find(
    (t) =>
      t.authorId === peer.id && t.boardId !== "tree" && t.boardId !== "market",
  )!;
  await page.goto("/topic/" + topic.id);
  await page
    .locator(".original-post")
    .getByRole("link", { name: "私聊" + peer.name, exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp("/messages/people/" + peer.id));
  await expect(page.locator(".chat-product")).toHaveCount(0);
  await page.getByLabel("消息", { exact: true }).fill("明天十点见，如何？");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator(".chat-message.mine")).toContainText(
    "明天十点见，如何？",
  );
  await page.getByRole("button", { name: "模拟同学回复", exact: true }).click();
  await page.getByLabel("消息", { exact: true }).fill("这是一条未发送的草稿");
  await page.reload();
  await expect(page.getByLabel("消息", { exact: true })).toHaveValue(
    "这是一条未发送的草稿",
  );
  await expect(page.locator(".chat-message")).toHaveCount(3);
  await page.getByRole("link", { name: "返回", exact: true }).click();
  await expect(page).toHaveURL(/\/messages$/);
  const entry = page.locator(`[data-conversation="person:${peer.id}"]`);
  await expect(entry).toContainText("[草稿] 这是一条未发送的草稿");
  await expect(entry.locator(".message-unread")).toHaveCount(0);
  await page.getByRole("button", { name: "发起私聊", exact: true }).click();
  await page.getByLabel("搜索同学昵称").fill(peer.name);
  await expect(page.locator(".classmate-choice")).toHaveCount(1);
  await page.locator(".classmate-choice").click();
  await expect(page.locator(".chat-message")).toHaveCount(3);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("sustlink.forum.v1")!),
  );
  expect(stored.directConversations).toHaveLength(1);
  expect(stored.conversations[0].messages).toHaveLength(1);
});

test("starting a new classmate chat creates one empty thread before the first send", async ({ page }) => {
  const { state, peer } = await setup(page);
  const other = publicChatUsers(state).find(user => user.id !== peer.id)!;
  await page.getByRole('button', { name: '发起私聊', exact: true }).click();
  await page.getByLabel('搜索同学昵称').fill('不存在的昵称');
  await expect(page.locator('.classmate-choice')).toHaveCount(0);
  await page.getByLabel('搜索同学昵称').fill(other.name);
  await page.locator('.classmate-choice').click();
  await expect(page.locator('.chat-person h1')).toHaveText(other.name);
  await expect(page.locator('.chat-message')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '发送', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.locator('.chat-message')).toHaveCount(0);
  await page.getByLabel('消息', { exact: true }).fill('你好，很高兴认识你');
  await page.getByRole('button', { name: '发送', exact: true }).click();
  await expect(page.locator('.chat-message')).toHaveCount(1);
  await page.getByRole('link', { name: '返回', exact: true }).click();
  await expect(page.locator(`[data-conversation="person:${other.id}"]`)).toContainText('你好，很高兴认识你');
});

test("all read clears all notification groups and both kinds of conversations across reloads", async ({
  page,
}) => {
  await setup(page);
  await expect(page.locator(".notification-link i")).toBeVisible();
  await page.getByRole("button", { name: "全部已读", exact: true }).click();
  await expect(
    page.locator(".message-unread, .notification-link i"),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".notification-link")).toHaveAccessibleName(
    "消息，0 条未读",
  );
  await expect(
    page.getByRole("button", { name: "全部已读", exact: true }),
  ).toBeDisabled();
});

test("anonymous posts have no identity-revealing chat entry; guests and self chats are gated", async ({
  page,
}) => {
  const { peer, state } = await setup(page);
  await page.goto(
    "/topic/" + state.topics.find((t) => t.boardId === "tree")!.id,
  );
  await expect(page.locator(".author-chat-link")).toHaveCount(0);
  await page.goto("/messages/people/" + ME);
  await expect(page.getByText("无需与自己聊天。")).toBeVisible();
  await page.goto("/messages/people/no-such-user");
  await expect(page.getByText("暂时无法与这位同学发起私聊。")).toBeVisible();
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("sustlink.forum.v1")!);
    s.loggedIn = false;
    localStorage.setItem("sustlink.forum.v1", JSON.stringify(s));
  });
  await page.goto("/messages/people/" + peer.id);
  await expect(
    page
      .locator("#forum-main")
      .getByRole("button", { name: "演示登录", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".chat-history")).toHaveCount(0);
});

test("failed message persistence retains the draft without pretending the message was sent", async ({
  page,
}) => {
  const { peer } = await setup(page);
  await page.goto("/messages/people/" + peer.id);
  await page.getByLabel("消息", { exact: true }).fill("必须保留的草稿");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.locator('.chat-composer [role="alert"]')).toContainText(
    "消息未能保存",
  );
  await expect(page.getByLabel("消息", { exact: true })).toHaveValue(
    "必须保留的草稿",
  );
  await expect(page.locator(".chat-message")).toHaveCount(1);
});
