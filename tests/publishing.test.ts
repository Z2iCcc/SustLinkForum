import test from "node:test";
import assert from "node:assert/strict";
import { createSeed } from "../src/seed.ts";
import {
  publishTopic,
  loadState,
  persistState,
  removedAttachmentIds,
} from "../src/store.ts";
import {
  emptyPublishing,
  attachToPublishingDraft,
  publishingErrors,
  timeValid,
  reconcilePublishing,
  switchPublishingDraft,
} from "../src/publishing/model.ts";
import type { Draft } from "../src/types.ts";
const now = new Date("2026-09-10T12:00");
const image = {
  id: "test-image",
  name: "book.png",
  kind: "image" as const,
  mime: "image/png",
  size: 120,
};
test("special publishing validates each mode and preserves data without changing body presentation", () => {
  const state = { ...createSeed(), loggedIn: true };
  const p = {
    ...emptyPublishing("market"),
    category: "教材书籍",
    price: "18.50",
    place: "图书馆",
  };
  const draft: Draft = {
    boardId: "market",
    categoryId: "books",
    title: "高数教材",
    body: "少量笔记",
    publishing: p,
    attachments: [image],
  };
  assert.deepEqual(publishingErrors(draft, now), {});
  const next = publishTopic(state, draft, "market-new", +now);
  assert.deepEqual(next.topics[0].publishing, p);
  assert.equal(next.topics[0].body, draft.body);
  assert.throws(
    () => publishTopic(state, { ...draft, attachments: [] }, "bad", +now),
    /实物图片/,
  );
  for (const value of ["", "0", "-1", "1.234", "Infinity"])
    assert.ok(
      publishingErrors({ ...draft, publishing: { ...p, price: value } }, now)
        .price,
    );
  assert.ok(
    !publishingErrors(
      { ...draft, publishing: { ...p, free: true, price: "" } },
      now,
    ).price,
  );
  assert.ok(
    !publishingErrors(
      {
        ...draft,
        attachments: [],
        publishing: { ...p, mode: "wanted", budget: "20" },
      },
      now,
    ).media,
  );
  assert.throws(
    () =>
      publishTopic(
        state,
        { ...draft, publishing: { ...p, board: "clubs" } },
        "bad",
        +now,
      ),
    /发布信息/,
  );
  const lost: Draft = {
    boardId: "lost",
    title: "保温杯",
    body: "蓝色",
    publishing: {
      ...emptyPublishing("lost"),
      category: "生活用品",
      date: "2026-09-09",
      place: "图书馆",
    },
  };
  assert.deepEqual(publishingErrors(lost, now), {});
  assert.ok(
    publishingErrors(
      { ...lost, publishing: { ...lost.publishing!, date: "2026-09-11" } },
      now,
    ).date,
  );
  assert.ok(
    publishingErrors(
      { ...lost, publishing: { ...lost.publishing!, date: "2026-02-30" } },
      now,
    ).date,
  );
  let raw = "";
  persistState(
    {
      setItem: (_, v) => {
        raw = v;
      },
    },
    next,
  );
  assert.deepEqual(
    loadState({ getItem: () => raw }).state.topics[0].publishing,
    p,
  );
});
test("time ordering, deadline, recap, same-minute and cross-year constraints use one validator", () => {
  const p = {
    ...emptyPublishing("clubs"),
    category: "文体活动",
    organizer: "摄影社",
    place: "湖边",
    start: "2026-12-31T23:59",
    end: "2027-01-01T00:00",
    registration: "link",
    url: "https://example.com/join",
    deadline: "2026-12-31T23:59",
  };
  const draft: Draft = {
    boardId: "clubs",
    title: "摄影活动",
    body: "欢迎参加",
    publishing: p,
  };
  assert.deepEqual(publishingErrors(draft, now), {});
  assert.equal(timeValid(p, "end", p.start, now), false);
  assert.equal(timeValid(p, "end", "2027-01-01T00:00", now), true);
  assert.equal(timeValid(p, "deadline", "2027-01-01T00:00", now), false);
  const next = reconcilePublishing({ ...p, start: "2027-01-02T00:00" }, now);
  assert.equal(next.data.end, "");
  assert.equal(next.data.deadline, p.deadline);
  assert.deepEqual(reconcilePublishing({ ...p, start: "" }, now).cleared, [
    "end",
    "deadline",
  ]);
  assert.equal(
    timeValid({ ...p, mode: "recap" }, "end", "2027-01-01T00:00", now),
    false,
  );
  assert.ok(
    publishingErrors(
      { ...draft, publishing: { ...p, url: "javascript:alert(1)" } },
      now,
    ).url,
  );
  const recruit = {
    ...emptyPublishing("clubs", "recruit"),
    organizer: "摄影社",
    deadline: "2026-09-20T20:00",
    place: "活动中心",
  };
  assert.deepEqual(
    publishingErrors({ ...draft, publishing: recruit }, now),
    {},
  );
  const recap = {
    ...emptyPublishing("clubs", "recap"),
    organizer: "摄影社",
    start: "2026-09-09T16:00",
    end: "2026-09-09T18:00",
    place: "湖边",
  };
  assert.deepEqual(publishingErrors({ ...draft, publishing: recap }, now), {});
});
test("switching modes restores drafts and keeps cached attachment references alive", () => {
  let state = { ...createSeed(), loggedIn: true };
  state = switchPublishingDraft(state, "market");
  state = {
    ...state,
    draft: {
      ...state.draft,
      title: "教材",
      body: "有笔记",
      publishing: {
        ...emptyPublishing("market"),
        category: "教材书籍",
        price: "18",
        place: "图书馆",
      },
      attachments: [image],
    },
  };
  state = switchPublishingDraft(state, "market", "wanted");
  state = { ...state, draft: { ...state.draft, title: "求购计算器" } };
  state = switchPublishingDraft(state, "clubs");
  state = switchPublishingDraft(state, "market", "sale");
  assert.equal(state.draft.title, "教材");
  assert.equal(state.draft.publishing?.price, "18");
  const next = publishTopic(state, state.draft, "sale", +now);
  assert.equal(next.publishDrafts?.["market:sale"], undefined);
  assert.equal(next.publishDrafts?.["market:wanted"].title, "求购计算器");
  const withoutTopic = {
    ...next,
    topics: next.topics.filter((t) => t.id !== "sale"),
    publishDrafts: { ...next.publishDrafts, backup: state.draft },
  };
  assert.deepEqual(removedAttachmentIds(next, withoutTopic), []);
  let raw = "";
  persistState(
    {
      setItem: (_, v) => {
        raw = v;
      },
    },
    state,
  );
  assert.equal(
    loadState({ getItem: () => raw }).state.publishDrafts?.["market:wanted"]
      .title,
    "求购计算器",
  );
});
test("upload completion after navigating away updates its source draft only", () => {
  let state = { ...createSeed(), loggedIn: true };
  state = switchPublishingDraft(state, "market");
  const source = { ...state.draft, title: "上传中的教材" };
  state = { ...state, draft: source };
  state = switchPublishingDraft(state, "clubs");
  state = { ...state, draft: { ...state.draft, title: "社团活动" } };
  state = attachToPublishingDraft(state, source, [image]);
  assert.equal(state.draft.title, "社团活动");
  assert.equal(state.draft.attachments?.length ?? 0, 0);
  assert.equal(state.publishDrafts?.["market:sale"].title, "上传中的教材");
  assert.equal(
    state.publishDrafts?.["market:sale"].attachments?.[0].id,
    image.id,
  );
});
