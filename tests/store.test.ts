import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFile } from "../src/media-store.ts";
import { formatCount, titleLength, limitTitle } from "../src/format.ts";
import {
  selectReplies,
  toggleReplyLike,
  replyLikeCount,
} from "../src/store.ts";
import { createSeed, ME } from "../src/seed.ts";
import {
  addReply,
  deleteTopic,
  deleteReply,
  replyFloor,
  removedAttachmentIds,
  identity,
  loadState,
  persistState,
  publishTopic,
  selectTopics,
  STORAGE_KEY,
  validState,
} from "../src/store.ts";

test("secondary categories preserve legacy notes, enforce board membership and filter before sorting", () => {
  const seed = createSeed();
  seed.loggedIn = true;
  const original = structuredClone(seed);
  let s = publishTopic(
    seed,
    {
      boardId: "study",
      categoryId: "resources",
      title: "分类测试",
      body: "关键词",
    },
    "category-note",
  );
  assert.equal(
    selectTopics(s, {
      board: "study",
      category: "resources",
      query: "关键词",
    })[0].id,
    "category-note",
  );
  assert.equal(
    selectTopics(s, { board: "life", category: "resources" }).length,
    0,
  );
  assert.equal(
    selectTopics(s, { board: "study", category: "uncategorized" }).length,
    seed.topics.filter((t) => t.boardId === "study").length,
  );
  assert.equal(selectTopics(s, { board: "study", category: "bad" }).length, 0);
  assert.deepEqual(seed, original);
  assert.equal(
    loadState({ getItem: () => JSON.stringify(seed), setItem: () => {} })
      .warning,
    "",
  );
  assert.throws(
    () =>
      publishTopic(s, {
        boardId: "life",
        categoryId: "resources",
        title: "错误分类",
        body: "正文",
      }),
    /有效分类/,
  );
  const legacy = structuredClone(s);
  legacy.topics[0].categoryId = "retired";
  assert.equal(
    loadState({ getItem: () => JSON.stringify(legacy), setItem: () => {} })
      .warning,
    "",
  );
  assert.ok(
    selectTopics(legacy, { board: "study", category: "uncategorized" }).some(
      (t) => t.id === "category-note",
    ),
  );
});

test("reply deletion preserves floor identities, quotes, anonymous names and unrelated interactions", () => {
  const seed = createSeed();
  seed.loggedIn = true;
  const topic = seed.topics[0];
  topic.boardId = "tree";
  seed.replies = [
    {
      id: "first",
      topicId: topic.id,
      authorId: ME,
      body: "删除这条",
      createdAt: topic.createdAt + 1,
    },
    {
      id: "second",
      topicId: topic.id,
      authorId: seed.users.find((u) => u.id !== ME && u.id !== topic.authorId)!
        .id,
      body: "引用内容",
      createdAt: topic.createdAt + 2,
      quoteId: "first",
    },
  ];
  seed.replyLikes = ["first", "second"];
  seed.notices = [
    {
      id: "notice",
      kind: "reply",
      topicId: topic.id,
      replyId: "first",
      read: false,
      createdAt: 1,
    },
  ];
  const beforeName = identity(seed, topic, seed.replies[1].authorId).name;
  const next = deleteReply(seed, "first");
  assert.equal(next.replies.length, 1);
  assert.equal(replyFloor(next, next.replies[0]), 3);
  assert.equal(next.replies[0].quoteId, "first");
  assert.deepEqual(next.replyLikes, ["second"]);
  assert.equal(next.notices.length, 0);
  assert.deepEqual(next.likes, seed.likes);
  assert.deepEqual(next.saves, seed.saves);
  assert.equal(
    identity(next, next.topics[0], next.replies[0].authorId).name,
    beforeName,
  );
  const added = addReply(next, topic.id, "新回复", undefined, "third");
  assert.equal(replyFloor(added, added.replies[1]), 4);
  const removedLast = deleteReply(added, "third");
  const reAdded = addReply(
    removedLast,
    topic.id,
    "再回复",
    undefined,
    "fourth",
  );
  assert.equal(replyFloor(reAdded, reAdded.replies[1]), 5);
  assert.equal(validState(reAdded), true);
  assert.equal(
    loadState({ getItem: () => JSON.stringify(reAdded), setItem: () => {} })
      .warning,
    "",
  );
  assert.throws(
    () => deleteReply({ ...seed, loggedIn: false }, "first"),
    /登录/,
  );
  assert.throws(() => deleteReply(seed, "second"), /只能删除自己/);
  const ownerState = {
    ...seed,
    topics: seed.topics.map((t) =>
      t.id === topic.id ? { ...t, authorId: ME } : t,
    ),
  };
  assert.equal(
    deleteReply(ownerState, "second").replies.some((r) => r.id === "second"),
    false,
  );
  assert.throws(
    () => deleteReply({ ...ownerState, loggedIn: false }, "second"),
    /登录/,
  );
  assert.throws(() => deleteReply(next, "first"), /已不存在/);
});

test("deleting an own note cascades interactions, preserves unrelated data and enforces ownership", () => {
  const seed = createSeed();
  seed.loggedIn = true;
  const own = publishTopic(
    seed,
    { boardId: "tree", title: "待删除笔记", body: "正文" },
    "delete-me",
  );
  let state = addReply(own, "delete-me", "我的回复", undefined, "delete-reply");
  state = structuredClone(state);
  state.replies.push({
    id: "other-reply",
    topicId: "delete-me",
    authorId: seed.users.find((u) => u.id !== ME)!.id,
    body: "其他同学的回复",
    createdAt: Date.now(),
    quoteId: "delete-reply",
  });
  state.likes = ["delete-me", "topic-1"];
  state.saves = ["delete-me", "topic-2"];
  state.replyLikes = ["delete-reply", "other-reply", "reply-0-1"];
  state.notices.push({
    id: "delete-notice",
    kind: "reply",
    topicId: "delete-me",
    replyId: "delete-reply",
    read: false,
    createdAt: Date.now(),
  });
  const file = (id: string) => ({
    id,
    name: "资料.pdf",
    kind: "file" as const,
    mime: "application/pdf",
    size: 5,
  });
  state.topics[0].attachments = [
    file("only-note"),
    file("shared-draft"),
    file("avatar-file"),
  ];
  state.replies.find((r) => r.id === "delete-reply")!.attachments = [
    file("only-reply"),
  ];
  state.draft.attachments = [file("shared-draft")];
  state.users[0].avatarId = "avatar-file";
  const original = structuredClone(state);
  const next = deleteTopic(state, "delete-me");
  assert.deepEqual(state, original);
  assert.equal(next.topics.length, seed.topics.length);
  assert.deepEqual(next.replies, seed.replies);
  assert.deepEqual(next.likes, ["topic-1"]);
  assert.deepEqual(next.saves, ["topic-2"]);
  assert.deepEqual(next.replyLikes, ["reply-0-1"]);
  assert.deepEqual(next.notices, seed.notices);
  assert.deepEqual(next.draft, state.draft);
  assert.deepEqual(next.users, state.users);
  assert.deepEqual(removedAttachmentIds(state, next).sort(), [
    "only-note",
    "only-reply",
  ]);
  assert.equal(validState(next), true);
  assert.deepEqual(
    loadState({ getItem: () => JSON.stringify(next), setItem: () => {} }).state,
    next,
  );
  assert.throws(
    () => deleteTopic({ ...state, loggedIn: false }, "delete-me"),
    /登录/,
  );
  const other = seed.topics.find((t) => t.authorId !== ME)!;
  assert.throws(() => deleteTopic(state, other.id), /只能删除自己/);
  assert.throws(() => deleteTopic(next, "delete-me"), /已不存在/);
});

test("20-character title limit counts graphemes and preserves old stored content", () => {
  assert.equal(titleLength("科".repeat(19) + "👨‍👩‍👧‍👦"), 20);
  assert.equal(limitTitle("科".repeat(20) + "大"), "科".repeat(20));
  const s = createSeed();
  s.loggedIn = true;
  assert.throws(
    () =>
      publishTopic(s, {
        boardId: "life",
        title: "科".repeat(21),
        body: "正文",
      }),
    /20 字/,
  );
  assert.doesNotThrow(() =>
    publishTopic(s, {
      boardId: "life",
      title: "科".repeat(19) + "👨‍👩‍👧‍👦",
      body: "正文",
    }),
  );
  s.draft.title = "旧".repeat(30);
  s.topics[0].title = "旧".repeat(30);
  const loaded = loadState({
    getItem: () => JSON.stringify(s),
    setItem: () => {},
  });
  assert.equal(loaded.warning, "");
  assert.equal(loaded.state.draft.title.length, 30);
  assert.equal(loaded.state.topics[0].title.length, 30);
  assert.deepEqual([0, 9999, 10000, 17000, 18000, 100000000].map(formatCount), [
    "0",
    "9999",
    "1万",
    "1.7万",
    "1.8万",
    "1亿",
  ]);
});

test("reply likes persist independently and sorting does not change floor order", () => {
  let s = createSeed();
  const topic = s.topics[0];
  const original = s.replies.filter((r) => r.topicId === topic.id);
  const [first, second] = original;
  assert.throws(() => toggleReplyLike(s, second.id), /登录/);
  s.loggedIn = true;
  s = toggleReplyLike(s, second.id);
  assert.equal(replyLikeCount(s, second), 1);
  assert.deepEqual(s.likes, []);
  assert.equal(selectReplies(s, topic, "likes")[0].id, second.id);
  assert.equal(selectReplies(s, topic, "newest")[0].id, second.id);
  assert.equal(selectReplies(s, topic, "oldest")[0].id, first.id);
  assert.deepEqual(
    s.replies.filter((r) => r.topicId === topic.id),
    original,
  );
  assert.ok(
    selectReplies(s, topic, "likes", true).every(
      (r) => r.authorId === topic.authorId,
    ),
  );
  const loaded = loadState({
    getItem: () => JSON.stringify(s),
    setItem: () => {},
  }).state;
  assert.equal(replyLikeCount(loaded, second), 1);
  s = toggleReplyLike(s, second.id);
  assert.equal(replyLikeCount(s, second), 0);
  assert.equal(selectReplies(s, topic, "likes")[0].id, first.id);
  assert.throws(() => toggleReplyLike(s, "missing"), /不存在/);
  assert.equal(validState({ ...s, replyLikes: [123] }), false);
});

test("publishing and quoting preserve author, source, draft and chronological state", () => {
  const original = {
    ...createSeed(10000000),
    loggedIn: true,
    draft: {
      boardId: "study" as const,
      title: "  新主题  ",
      body: "  第一段\n\n第二段  ",
    },
  };
  const published = publishTopic(
    original,
    original.draft,
    "new-topic",
    11000000,
  );
  assert.equal(published.topics[0].title, "新主题");
  assert.equal(published.draft.body, "");
  assert.equal(original.topics.length + 1, published.topics.length);
  const replied = addReply(
    published,
    "new-topic",
    "引用这段内容",
    "new-topic",
    "new-reply",
    12000000,
  );
  assert.equal(replied.replies.at(-1)?.quoteId, "new-topic");
  assert.equal(replied.replies.at(-1)?.authorId, ME);
  assert.equal(replied.topics[0].updatedAt, 12000000);
  assert.ok(validState(replied));
});
test("guest writes, empty bodies and cross-topic quotes are rejected", () => {
  const state = createSeed();
  assert.throws(
    () => publishTopic(state, { boardId: "life", title: "测试", body: "正文" }),
    /登录/,
  );
  state.loggedIn = true;
  assert.throws(() => addReply(state, "missing", "回复"), /不存在/);
  assert.throws(() => addReply(state, "topic-1", " "), /填写/);
  assert.throws(() => addReply(state, "topic-1", "测试", "reply-1-1"), /引用/);
  assert.throws(
    () => publishTopic(state, { boardId: "life", title: "  ", body: "正文" }),
    /填写/,
  );
});
test("tree identities stay stable across replies and profile edits", () => {
  let state = { ...createSeed(), loggedIn: true };
  const topic = state.topics.find((t) => t.boardId === "tree")!;
  assert.equal(identity(state, topic, topic.authorId).name, "树洞楼主");
  state = addReply(state, topic.id, "第一条", undefined, "a");
  const name = identity(state, topic, ME).name;
  state = addReply(state, topic.id, "第二条", "a", "b");
  state.users.find((u) => u.id === ME)!.name = "不应泄露的昵称";
  assert.equal(identity(state, topic, ME).name, name);
  assert.ok(name.startsWith("匿名同学"));
  assert.equal(identity(state, topic, ME).anonymous, true);
});
test("search, board filtering and pin precedence operate together", () => {
  const state = createSeed();
  const list = selectTopics(state, {
    query: "图书馆",
    board: "study",
    sort: "new",
  });
  assert.ok(list.length > 0);
  assert.ok(
    list.every(
      (t) => t.boardId === "study" && `${t.title}${t.body}`.includes("图书馆"),
    ),
  );
  for (const sort of ["new", "reply", "hot"])
    assert.equal(selectTopics(state, { sort })[0].pinned, true);
  assert.equal(
    selectTopics(state, { query: "不可能存在的搜索关键字" }).length,
    0,
  );
});
test("storage round-trip, broken state and quota failure remain recoverable", () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
  const state = createSeed();
  state.saves = ["topic-1"];
  assert.equal(persistState(storage, state), "");
  assert.deepEqual(loadState(storage).state, state);
  storage.setItem(STORAGE_KEY, '{"version":1}');
  assert.ok(loadState(storage).warning);
  assert.equal(storage.getItem(STORAGE_KEY), '{"version":1}');
  assert.ok(
    persistState(
      {
        getItem: () => null,
        setItem: () => {
          throw Error("quota");
        },
      },
      state,
    ).includes("空间不足"),
  );
  assert.equal(validState({ ...state, topics: [{ id: "bad" }] }), false);
});

test("legacy categories migrate without losing content, draft, replies or saved posts", () => {
  const state = createSeed();
  state.loggedIn = true;
  state.saves = ["topic-1"];
  const legacy = {
    ...state,
    topics: state.topics.map((t, i) =>
      i === 0 ? { ...t, boardId: "help" } : t,
    ),
    draft: { boardId: "help", title: "旧草稿", body: "继续保留" },
  };
  const loaded = loadState({
    getItem: () => JSON.stringify(legacy),
    setItem: () => {
      throw Error("read must not write");
    },
  });
  assert.equal(loaded.warning, "");
  assert.equal(loaded.state.topics[0].boardId, "life");
  assert.equal(loaded.state.draft.boardId, "life");
  assert.equal(loaded.state.draft.title, "旧草稿");
  assert.deepEqual(loaded.state.saves, state.saves);
  assert.deepEqual(loaded.state.replies, state.replies);
  assert.equal(loaded.state.topics.length, state.topics.length);
});

test("media-only content validates, round-trips and keeps anonymous avatar private", () => {
  const state = createSeed();
  state.loggedIn = true;
  state.users.find((u) => u.id === ME)!.avatarId = "avatar-example";
  const attachments = [
    {
      id: "image-example",
      name: "校园.png",
      kind: "image" as const,
      mime: "image/png",
      size: 1024,
    },
  ];
  const published = publishTopic(
    state,
    { boardId: "tree", title: "图片分享", body: "", attachments },
    "media-topic",
  );
  const replied = addReply(
    published,
    "media-topic",
    "",
    undefined,
    "media-reply",
    Date.now(),
    attachments,
  );
  assert.ok(validState(replied));
  assert.deepEqual(replied.topics[0].attachments, attachments);
  assert.deepEqual(replied.replies.at(-1)?.attachments, attachments);
  assert.equal(identity(replied, replied.topics[0], ME).avatarId, undefined);
  assert.equal(
    identity(replied, { ...replied.topics[0], boardId: "life" }, ME).avatarId,
    "avatar-example",
  );
  assert.equal(
    validState({
      ...replied,
      draft: {
        ...replied.draft,
        attachments: [{ ...attachments[0], size: -1 }],
      },
    }),
    false,
  );
  assert.throws(
    () =>
      validateFile(
        { name: "huge.mp4", type: "video/mp4", size: 101 * 1024 * 1024 },
        "video",
      ),
    /100 MB/,
  );
  assert.throws(
    () =>
      validateFile(
        { name: "huge.png", type: "image/png", size: 11 * 1024 * 1024 },
        "image",
      ),
    /10 MB/,
  );
  assert.throws(
    () =>
      validateFile(
        { name: "huge.zip", type: "application/zip", size: 31 * 1024 * 1024 },
        "file",
      ),
    /30 MB/,
  );
});
