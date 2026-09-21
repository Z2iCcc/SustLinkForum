import test from "node:test";
import assert from "node:assert/strict";
import { createSeed, ME } from "../src/seed.ts";
import { validState } from "../src/store.ts";
import {
  startConversation,
  startDirectConversation,
  sendDirectChat,
  publicChatUsers,
  unreadMessageCount,
  markAllMessagesRead,
} from "../src/messaging/model.ts";

test("direct chats persist independently of product threads and do not send on creation", () => {
  let state = { ...createSeed(), loggedIn: true };
  const peer = publicChatUsers(state)[0];
  state = startDirectConversation(state, peer.id);
  assert.equal(state.directConversations![0].messages.length, 0);
  assert.equal(startDirectConversation(state, peer.id), state);
  const product = state.topics.find(
    (t) => t.boardId === "market" && t.authorId === peer.id,
  )!;
  state = startConversation(state, product);
  state.directConversations![0].draft = "明天一起去图书馆吗？";
  state = sendDirectChat(state, peer.id, "你好", "one");
  assert.equal(state.directConversations![0].draft, "");
  assert.equal(sendDirectChat(state, peer.id, "你好", "one"), state);
  assert.equal(state.conversations![0].messages.length, 0);
  state.directConversations![0].draft = "还没发出的草稿";
  state = sendDirectChat(state, peer.id, "演示回复", "two", true);
  assert.equal(state.directConversations![0].draft, "还没发出的草稿");
  assert.equal(state.directConversations![0].messages[1].authorId, peer.id);
  assert.ok(validState(JSON.parse(JSON.stringify(state))));
  assert.ok(validState(createSeed()));
});

test("direct chats reject guests, self, unknown and anonymous-only identities", () => {
  const state = { ...createSeed(), loggedIn: true };
  const peer = publicChatUsers(state)[0].id;
  assert.throws(
    () => startDirectConversation({ ...state, loggedIn: false }, peer),
    /登录/,
  );
  assert.throws(() => startDirectConversation(state, ME), /自己/);
  assert.throws(() => startDirectConversation(state, "missing"), /无法/);
  const anonymous = {
    ...state,
    topics: state.topics.filter((t) => t.boardId === "tree"),
    replies: [],
  };
  assert.deepEqual(publicChatUsers(anonymous), []);
  assert.throws(() => startDirectConversation(anonymous, peer), /无法/);
  const created = startDirectConversation(state, peer);
  assert.throws(() => sendDirectChat(created, peer, "  ", "bad"), /1–3000/);
  assert.throws(
    () => sendDirectChat({ ...created, loggedIn: false }, peer, "hello", "bad"),
    /登录/,
  );
  assert.throws(
    () =>
      sendDirectChat(
        { ...created, users: created.users.filter((u) => u.id !== peer) },
        peer,
        "hello",
        "bad",
      ),
    /不可用/,
  );
  const bad = JSON.parse(JSON.stringify(created));
  bad.directConversations[0].messages.push({
    id: "invalid",
    body: "hello",
    authorId: "intruder",
    createdAt: Date.now(),
  });
  assert.equal(validState(bad), false);
});

test("all read covers direct, product and interaction notices while retaining drafts", () => {
  let state = { ...createSeed(), loggedIn: true };
  const peer = publicChatUsers(state)[0].id;
  state = startDirectConversation(state, peer);
  state.directConversations![0].draft = "待发送";
  state.directConversations![0].messages = [
    {
      id: "incoming",
      authorId: peer,
      body: "你好",
      createdAt: Date.now() + 1000,
    },
  ];
  state.notices.push({
    id: "liked",
    kind: "like",
    actorId: peer,
    topicId: "topic-2",
    read: false,
    createdAt: Date.now(),
  });
  assert.equal(
    unreadMessageCount(state),
    state.notices.filter((n) => !n.read).length + 1,
  );
  const read = markAllMessagesRead(state);
  assert.equal(unreadMessageCount(read), 0);
  assert.equal(read.directConversations![0].draft, "待发送");
  assert.ok(validState(read));
});
