import { canComment } from "./market/model.ts";
import { validConversations } from "./messaging/model.ts";
import type {
  Attachment,
  Draft,
  ForumState,
  Topic,
  Reply,
  ReplySort,
} from "./types.ts";
import { boards, createSeed, ME } from "./seed.ts";
import { TITLE_LIMIT, titleLength } from "./format.ts";
import { categoryName, validCategory, UNCATEGORIZED } from "./categories.ts";
import {
  validPublishing,
  publishingErrors,
  draftKey,
} from "./publishing/model.ts";
export const STORAGE_KEY = "sustlink.forum.v1";
type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function validAttachments(
  value: unknown,
): value is Attachment[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 10 &&
      value.every(
        (a) =>
          a &&
          typeof a.id === "string" &&
          typeof a.name === "string" &&
          ["image", "video", "file"].includes(a.kind) &&
          typeof a.mime === "string" &&
          typeof a.size === "number" &&
          Number.isFinite(a.size) &&
          a.size > 0,
      ))
  );
}
// Keep existing content and bookmarks when replacing the old help category.
export function migrateState(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const s = value as Record<string, unknown>;
  const mapBoard = (item: unknown) =>
    item &&
    typeof item === "object" &&
    (item as { boardId?: string }).boardId === "help"
      ? { ...item, boardId: "life" }
      : item;
  return {
    ...s,
    topics: Array.isArray(s.topics) ? s.topics.map(mapBoard) : s.topics,
    draft: mapBoard(s.draft),
  };
}
export function validState(value: unknown): value is ForumState {
  if (!value || typeof value !== "object") return false;
  const s = value as ForumState;
  const str = (v: unknown) => typeof v === "string";
  const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  if (
    !validConversations(s.conversations) ||
    s.version !== 1 ||
    typeof s.loggedIn !== "boolean" ||
    !Array.isArray(s.users) ||
    !s.users.some((u) => u?.id === ME) ||
    !s.users.every(
      (u) =>
        u &&
        str(u.id) &&
        str(u.name) &&
        str(u.bio) &&
        str(u.color) &&
        (u.avatarId === undefined || str(u.avatarId)),
    )
  )
    return false;
  if (
    !Array.isArray(s.topics) ||
    !s.topics.every(
      (t) =>
        t &&
        str(t.id) &&
        str(t.title) &&
        str(t.body) &&
        (t.categoryId === undefined || str(t.categoryId)) &&
        s.users.some((u) => u.id === t.authorId) &&
        boards.some((b) => b.id === t.boardId) &&
        num(t.createdAt) &&
        num(t.updatedAt) &&
        num(t.views) &&
        num(t.baseLikes) &&
        (t.nextReplyFloor === undefined ||
          (Number.isInteger(t.nextReplyFloor) && t.nextReplyFloor >= 2)) &&
        (t.anonymousParticipants === undefined ||
          (Array.isArray(t.anonymousParticipants) &&
            t.anonymousParticipants.every((id) =>
              s.users.some((u) => u.id === id),
            ))) &&
        typeof t.pinned === "boolean" &&
        validAttachments(t.attachments) &&
        validPublishing(t.publishing, t.boardId) &&
        (!t.market || (
          (!t.market.commentPolicy || ["everyone", "seller"].includes(t.market.commentPolicy)) &&
          (!t.market.status || ["active", "withdrawn", "sold"].includes(t.market.status)) &&
          (t.market.demoImage === undefined || /^\/market-demo\/[a-z]+\.jpg$/.test(t.market.demoImage)) &&
          (t.market.baseSaves === undefined || (num(t.market.baseSaves) && t.market.baseSaves >= 0))
        )),
    )
  )
    return false;
  if (
    !Array.isArray(s.replies) ||
    !s.replies.every(
      (r) =>
        r &&
        str(r.id) &&
        str(r.body) &&
        s.topics.some((t) => t.id === r.topicId) &&
        s.users.some((u) => u.id === r.authorId) &&
        num(r.createdAt) &&
        (r.floor === undefined ||
          (Number.isInteger(r.floor) && r.floor >= 2)) &&
        (r.baseLikes === undefined || (num(r.baseLikes) && r.baseLikes >= 0)) &&
        (r.quoteId === undefined || str(r.quoteId)) &&
        validAttachments(r.attachments),
    )
  )
    return false;
  return (
    Array.isArray(s.notices) &&
    s.notices.every(
      (n) =>
        n &&
        str(n.id) &&
        ["reply", "system"].includes(n.kind) &&
        str(n.topicId) &&
        typeof n.read === "boolean" &&
        num(n.createdAt),
    ) &&
    Array.isArray(s.likes) &&
    s.likes.every(str) &&
    (s.replyLikes === undefined ||
      (Array.isArray(s.replyLikes) && s.replyLikes.every(str))) &&
    Array.isArray(s.saves) &&
    s.saves.every(str) &&
    !!s.draft &&
    str(s.draft.title) &&
    str(s.draft.body) &&
    (s.draft.categoryId === undefined || str(s.draft.categoryId)) &&
    boards.some((b) => b.id === s.draft.boardId) &&
    validAttachments(s.draft.attachments) &&
    validPublishing(s.draft.publishing, s.draft.boardId) &&
    (s.publishDrafts === undefined ||
      (s.publishDrafts &&
        typeof s.publishDrafts === "object" &&
        !Array.isArray(s.publishDrafts) &&
        Object.values(s.publishDrafts).every(
          (d) =>
            d &&
            str(d.title) &&
            str(d.body) &&
            boards.some((b) => b.id === d.boardId) &&
            validAttachments(d.attachments) &&
            validPublishing(d.publishing, d.boardId),
        )))
  );
}
export function loadState(storage?: StorageLike): {
  state: ForumState;
  warning: string;
} {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return { state: createSeed(), warning: "" };
    const parsed: unknown = migrateState(JSON.parse(raw));
    if (validState(parsed)) return { state: parsed, warning: "" };
    return {
      state: createSeed(),
      warning: "本地数据格式异常，已使用演示数据。原存储暂未覆盖。",
    };
  } catch {
    return {
      state: createSeed(),
      warning: "无法读取本地数据，已进入临时演示模式。",
    };
  }
}
export function persistState(
  storage: StorageLike | undefined,
  state: ForumState,
): string {
  try {
    if (!storage) throw new Error();
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return "";
  } catch {
    return "浏览器存储不可用或空间不足。更改仅在当前页面保留，刷新后可能丢失。";
  }
}
export function identity(state: ForumState, topic: Topic, userId: string) {
  const user = state.users.find((u) => u.id === userId);
  if (topic.boardId !== "tree")
    return {
      name: user?.name ?? "校园同学",
      color: user?.color ?? "#788c93",
      anonymous: false,
      author: userId === topic.authorId,
      avatarId: user?.avatarId,
    };
  const participants = [
    topic.authorId,
    ...(topic.anonymousParticipants ?? []),
    ...state.replies
      .filter((r) => r.topicId === topic.id)
      .map((r) => r.authorId),
  ].filter((id, index, all) => all.indexOf(id) === index);
  const index = participants.indexOf(userId);
  return {
    name:
      userId === topic.authorId ? "树洞楼主" : `匿名同学 ${Math.max(1, index)}`,
    color: "#7f9279",
    anonymous: true,
    author: userId === topic.authorId,
  };
}
export function selectTopics(
  state: ForumState,
  options: {
    board?: string;
    category?: string;
    query?: string;
    sort?: string;
  } = {},
) {
  const query = (options.query ?? "").trim().toLocaleLowerCase();
  return state.topics
    .filter(
      (t) =>
        (!options.board || t.boardId === options.board) &&
        (!options.category ||
          (options.category === UNCATEGORIZED
            ? !categoryName(t.boardId, t.categoryId)
            : !!categoryName(options.board, options.category) &&
              t.categoryId === options.category)) &&
        (!query || `${t.title}\n${t.body}`.toLocaleLowerCase().includes(query)),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (options.sort === "new"
          ? b.createdAt - a.createdAt
          : options.sort === "hot"
            ? b.baseLikes +
              state.replies.filter((r) => r.topicId === b.id).length * 4 -
              (a.baseLikes +
                state.replies.filter((r) => r.topicId === a.id).length * 4)
            : b.updatedAt - a.updatedAt),
    );
}
export function publishTopic(
  state: ForumState,
  draft: Draft,
  id = crypto.randomUUID(),
  now = Date.now(),
): ForumState {
  if (!state.loggedIn) throw new Error("请先演示登录");
  if (!boards.some((b) => b.id === draft.boardId))
    throw new Error("请选择有效板块");
  if (!validCategory(draft.boardId, draft.categoryId))
    throw new Error("请选择当前板块下的有效分类");
  const title = draft.title.trim(),
    body = draft.body.trim();
  if (!title || (!body && !draft.attachments?.length))
    throw new Error("请填写标题，并添加正文或文件");
  if (!validAttachments(draft.attachments)) throw new Error("附件信息无效");
  if (titleLength(title) > TITLE_LIMIT || body.length > 10000)
    throw new Error("标题最多 20 字，正文最多 10000 字");
  if (draft.publishing) {
    const error = Object.values(publishingErrors(draft, new Date(now)))[0];
    if (error) throw new Error(error);
  }
  return {
    ...state,
    topics: [
      {
        id,
        boardId: draft.boardId,
        ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
        authorId: ME,
        title,
        body,
        createdAt: now,
        updatedAt: now,
        views: 0,
        pinned: false,
        baseLikes: 0,
        attachments: draft.attachments ?? [],
        ...(draft.publishing
          ? { publishing: structuredClone(draft.publishing) }
          : {}),
      },
      ...state.topics,
    ],
    draft: { boardId: "life", title: "", body: "" },
    ...(state.publishDrafts
      ? {
          publishDrafts: Object.fromEntries(
            Object.entries(state.publishDrafts).filter(
              ([key]) => key !== draftKey(draft),
            ),
          ),
        }
      : {}),
  };
}
export function addReply(
  state: ForumState,
  topicId: string,
  body: string,
  quoteId?: string,
  id = crypto.randomUUID(),
  now = Date.now(),
  attachments: Attachment[] = [],
): ForumState {
  if (!state.loggedIn) throw new Error("请先演示登录");
  const topic = state.topics.find((t) => t.id === topicId);
  if (!topic) throw new Error("帖子不存在");
  if (!canComment(topic, ME)) throw new Error("卖家已关闭公开留言，可通过聊一聊咨询");
  if ((!body.trim() && !attachments.length) || body.trim().length > 3000)
    throw new Error("请填写 1–3000 字的回复");
  if (!validAttachments(attachments)) throw new Error("附件信息无效");
  if (
    quoteId &&
    quoteId !== topicId &&
    !state.replies.some((r) => r.id === quoteId && r.topicId === topicId)
  )
    throw new Error("引用的楼层不存在");
  const reply: Reply = {
    id,
    topicId,
    authorId: ME,
    body: body.trim(),
    createdAt: now,
    floor: Math.max(
      topic.nextReplyFloor ?? 2,
      ...state.replies
        .filter((r) => r.topicId === topicId)
        .map((r) => replyFloor(state, r) + 1),
    ),
    attachments,
    ...(quoteId ? { quoteId } : {}),
  };
  return {
    ...state,
    replies: [...state.replies, reply],
    topics: state.topics.map((t) =>
      t.id === topicId ? { ...t, updatedAt: now } : t,
    ),
  };
}

export function replyFloor(state: ForumState, reply: Reply): number {
  return (
    reply.floor ??
    state.replies
      .filter((r) => r.topicId === reply.topicId)
      .findIndex((r) => r.id === reply.id) + 2
  );
}
export function deleteReply(state: ForumState, id: string): ForumState {
  if (!state.loggedIn) throw new Error("请先演示登录");
  const target = state.replies.find((reply) => reply.id === id);
  if (!target) throw new Error("这条回复已不存在");
  const topic = state.topics.find((t) => t.id === target.topicId)!;
  if (target.authorId !== ME && topic.authorId !== ME)
    throw new Error("只能删除自己发布的回复，或自己笔记下的回复");
  const original = state.replies.filter(
    (reply) => reply.topicId === target.topicId,
  );
  const remaining = original.filter((reply) => reply.id !== id);
  return {
    ...state,
    replies: state.replies
      .filter((reply) => reply.id !== id)
      .map((reply) =>
        reply.topicId === target.topicId
          ? { ...reply, floor: replyFloor(state, reply) }
          : reply,
      ),
    replyLikes: state.replyLikes?.filter((value) => value !== id),
    notices: state.notices.filter((notice) => notice.replyId !== id),
    topics: state.topics.map((t) =>
      t.id !== topic.id
        ? t
        : {
            ...t,
            updatedAt: Math.max(
              t.createdAt,
              ...remaining.map((reply) => reply.createdAt),
            ),
            nextReplyFloor: Math.max(
              t.nextReplyFloor ?? 2,
              ...original.map((reply) => replyFloor(state, reply) + 1),
            ),
            ...(t.boardId === "tree"
              ? {
                  anonymousParticipants: [
                    ...new Set([
                      t.authorId,
                      ...(t.anonymousParticipants ?? []),
                      ...original.map((reply) => reply.authorId),
                    ]),
                  ],
                }
              : {}),
          },
    ),
  };
}

export function replyLikeCount(state: ForumState, reply: Reply) {
  return (
    (reply.baseLikes ?? 0) +
    Number(state.replyLikes?.includes(reply.id) ?? false)
  );
}
export function deleteTopic(state: ForumState, id: string): ForumState {
  if (!state.loggedIn) throw new Error("请先演示登录");
  const topic = state.topics.find((item) => item.id === id);
  if (!topic) throw new Error("这篇笔记已不存在");
  if (topic.authorId !== ME) throw new Error("只能删除自己发布的笔记");
  const removedReplies = new Set(
    state.replies
      .filter((reply) => reply.topicId === id)
      .map((reply) => reply.id),
  );
  return {
    ...state,
    topics: state.topics.filter((item) => item.id !== id),
    replies: state.replies.filter((reply) => reply.topicId !== id),
    likes: state.likes.filter((value) => value !== id),
    saves: state.saves.filter((value) => value !== id),
    replyLikes: state.replyLikes?.filter((value) => !removedReplies.has(value)),
    notices: state.notices.filter(
      (notice) =>
        notice.topicId !== id && !removedReplies.has(notice.replyId ?? ""),
    ),
  };
}

// Reused files in another note, reply, draft or avatar must survive deletion.
export function removedAttachmentIds(
  before: ForumState,
  after: ForumState,
): string[] {
  const references = (state: ForumState) =>
    new Set([
      ...state.topics.flatMap(
        (topic) => topic.attachments?.map((file) => file.id) ?? [],
      ),
      ...state.replies.flatMap(
        (reply) => reply.attachments?.map((file) => file.id) ?? [],
      ),
      ...(state.draft.attachments?.map((file) => file.id) ?? []),
      ...Object.values(state.publishDrafts ?? {}).flatMap(
        (d) => d.attachments?.map((file) => file.id) ?? [],
      ),
      ...state.users.flatMap((user) => (user.avatarId ? [user.avatarId] : [])),
    ]);
  const kept = references(after);
  return [...references(before)].filter((id) => !kept.has(id));
}
export function toggleReplyLike(state: ForumState, id: string): ForumState {
  if (!state.loggedIn) throw new Error("请先演示登录");
  if (!state.replies.some((reply) => reply.id === id))
    throw new Error("回复不存在");
  const likes = state.replyLikes ?? [];
  return {
    ...state,
    replyLikes: likes.includes(id)
      ? likes.filter((value) => value !== id)
      : [...likes, id],
  };
}
export function selectReplies(
  state: ForumState,
  topic: Topic,
  sort: ReplySort = "oldest",
  onlyAuthor = false,
) {
  const original = state.replies.filter((reply) => reply.topicId === topic.id);
  const order = new Map(original.map((reply, index) => [reply.id, index]));
  const chronological = (a: Reply, b: Reply) =>
    a.createdAt - b.createdAt || order.get(a.id)! - order.get(b.id)!;
  return original
    .filter((reply) => !onlyAuthor || reply.authorId === topic.authorId)
    .sort((a, b) =>
      sort === "likes"
        ? replyLikeCount(state, b) - replyLikeCount(state, a) ||
          chronological(a, b)
        : sort === "newest"
          ? -chronological(a, b)
          : chronological(a, b),
    );
}
