import type { ForumState, Topic } from "../types.ts";
import { ME } from "../seed.ts";
export interface ChatMessage {
  id: string;
  authorId: string;
  body: string;
  createdAt: number;
}
export interface Conversation {
  topicId: string;
  sellerId: string;
  title: string;
  messages: ChatMessage[];
  draft: string;
  readAt: number;
}
export interface DirectConversation {
  peerId: string;
  messages: ChatMessage[];
  draft: string;
  readAt: number;
  createdAt: number;
}
type ChatHistory = Pick<Conversation, "messages" | "draft" | "readAt">;
export function unreadChatCount(chat: ChatHistory): number {
  return chat.messages.filter(
    (m) => m.authorId !== ME && m.createdAt > chat.readAt,
  ).length;
}
export function readChat<T extends ChatHistory>(chat: T): T {
  return {
    ...chat,
    readAt: chat.messages.reduce(
      (time, m) => Math.max(time, m.createdAt),
      Math.max(Date.now(), chat.readAt),
    ),
  };
}
export function unreadMessageCount(state: ForumState): number {
  return (
    state.notices.filter((n) => !n.read).length +
    [
      ...(state.conversations ?? []),
      ...(state.directConversations ?? []),
    ].reduce((sum, c) => sum + unreadChatCount(c), 0)
  );
}
export function markAllMessagesRead(state: ForumState): ForumState {
  return {
    ...state,
    notices: state.notices.map((n) => ({ ...n, read: true })),
    conversations: state.conversations?.map(readChat),
    directConversations: state.directConversations?.map(readChat),
  };
}
export function validDirectConversations(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      new Set(value.map((c) => c?.peerId)).size === value.length &&
      value.every(
        (c) =>
          c &&
          typeof c.peerId === "string" &&
          c.peerId !== ME &&
          typeof c.draft === "string" &&
          Number.isFinite(c.createdAt) &&
          Number.isFinite(c.readAt) &&
          Array.isArray(c.messages) &&
          c.messages.every(
            (m: ChatMessage) =>
              m &&
              typeof m.id === "string" &&
              [ME, c.peerId].includes(m.authorId) &&
              typeof m.body === "string" &&
              m.body.trim().length > 0 &&
              m.body.length <= 3000 &&
              Number.isFinite(m.createdAt),
          ),
      ))
  );
}
// Only public participants can be discovered; anonymous-board identities stay private.
export function publicChatUsers(state: ForumState) {
  const topics = state.topics.filter((t) => t.boardId !== "tree");
  const topicIds = new Set(topics.map((t) => t.id));
  const ids = new Set([
    ...topics.map((t) => t.authorId),
    ...state.replies
      .filter((r) => topicIds.has(r.topicId))
      .map((r) => r.authorId),
  ]);
  return state.users.filter((u) => u.id !== ME && ids.has(u.id));
}
export function startDirectConversation(
  state: ForumState,
  peerId: string,
): ForumState {
  if (!state.loggedIn) throw new Error("请先登录");
  if (peerId === ME) throw new Error("无需与自己聊天");
  if (state.directConversations?.some((c) => c.peerId === peerId)) return state;
  if (!publicChatUsers(state).some((u) => u.id === peerId))
    throw new Error("暂时无法与这位同学发起私聊");
  return {
    ...state,
    directConversations: [
      ...(state.directConversations ?? []),
      {
        peerId,
        messages: [],
        draft: "",
        readAt: Date.now(),
        createdAt: Date.now(),
      },
    ],
  };
}
function appendChat<T extends ChatHistory>(
  chat: T,
  peerId: string,
  body: string,
  id: string,
  simulate: boolean,
): T {
  if (!body.trim() || body.trim().length > 3000)
    throw new Error("请输入 1–3000 字");
  if (chat.messages.some((m) => m.id === id)) return chat;
  const message = {
    id,
    authorId: simulate ? peerId : ME,
    body: body.trim(),
    createdAt: Date.now(),
  };
  return {
    ...chat,
    messages: [...chat.messages, message],
    draft: simulate ? chat.draft : "",
    readAt: Date.now(),
  };
}
export function sendDirectChat(
  state: ForumState,
  peerId: string,
  body: string,
  id: string,
  simulate = false,
): ForumState {
  if (!state.loggedIn) throw new Error("请先登录");
  const chat = state.directConversations?.find((c) => c.peerId === peerId);
  if (!chat || peerId === ME || !state.users.some((u) => u.id === peerId))
    throw new Error("会话参与者不可用");
  const next = appendChat(chat, peerId, body, id, simulate);
  return next === chat
    ? state
    : {
        ...state,
        directConversations: state.directConversations!.map((c) =>
          c === chat ? next : c,
        ),
      };
}
export function validConversations(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (c) =>
          c &&
          typeof c.topicId === "string" &&
          typeof c.sellerId === "string" &&
          typeof c.title === "string" &&
          typeof c.draft === "string" &&
          Number.isFinite(c.readAt) &&
          Array.isArray(c.messages) &&
          c.messages.every(
            (m: ChatMessage) =>
              m &&
              typeof m.id === "string" &&
              [ME, c.sellerId].includes(m.authorId) &&
              typeof m.body === "string" &&
              m.body.trim().length > 0 &&
              m.body.length <= 3000 &&
              Number.isFinite(m.createdAt),
          ),
      ))
  );
}
export function startConversation(state: ForumState, topic: Topic): ForumState {
  if (!state.loggedIn) throw new Error("请先登录");
  if (topic.boardId !== "market" || topic.authorId === ME)
    throw new Error("无法与自己创建商品会话");
  if (state.conversations?.some((c) => c.topicId === topic.id)) return state;
  return {
    ...state,
    conversations: [
      ...(state.conversations ?? []),
      {
        topicId: topic.id,
        sellerId: topic.authorId,
        title: topic.title,
        messages: [],
        draft: "",
        readAt: Date.now(),
      },
    ],
  };
}
export function sendChat(
  state: ForumState,
  topicId: string,
  body: string,
  id: string,
  simulateSeller = false,
): ForumState {
  if (!state.loggedIn) throw new Error("请先登录");
  const topic = state.topics.find((t) => t.id === topicId),
    conversation = state.conversations?.find((c) => c.topicId === topicId);
  if (!conversation || !topic)
    throw new Error("商品已不可查看，无法发送新消息");
  if (topic.authorId !== conversation.sellerId || conversation.sellerId === ME)
    throw new Error("会话参与者不匹配");
  const next = appendChat(
    conversation,
    conversation.sellerId,
    body,
    id,
    simulateSeller,
  );
  return next === conversation
    ? state
    : {
        ...state,
        conversations: state.conversations!.map((c) =>
          c === conversation ? next : c,
        ),
      };
}
