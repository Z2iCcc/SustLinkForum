import type { MarketData } from "./market/model";
import type { Conversation } from "./messaging/model";
import type { PublishingData } from "./publishing/model";
export type BoardId =
  "life" | "study" | "lost" | "clubs" | "market" | "tree" | "notice";
export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "video" | "file";
  mime: string;
  size: number;
}
export interface Board {
  id: BoardId;
  name: string;
  description: string;
  color: string;
}
export interface User {
  id: string;
  name: string;
  bio: string;
  color: string;
  avatarId?: string;
}
export interface Topic {
  market?: MarketData;
  publishing?: PublishingData;
  categoryId?: string;
  id: string;
  boardId: BoardId;
  authorId: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
  views: number;
  pinned: boolean;
  baseLikes: number;
  nextReplyFloor?: number;
  anonymousParticipants?: string[];
  attachments?: Attachment[];
}
export interface Reply {
  id: string;
  topicId: string;
  authorId: string;
  body: string;
  createdAt: number;
  quoteId?: string;
  attachments?: Attachment[];
  baseLikes?: number;
  floor?: number;
}
export type ReplySort = "oldest" | "newest" | "likes";
export interface Notice {
  id: string;
  kind: "reply" | "system";
  topicId: string;
  replyId?: string;
  actorId?: string;
  read: boolean;
  createdAt: number;
}
export interface Draft {
  publishing?: PublishingData;
  categoryId?: string;
  boardId: BoardId;
  title: string;
  body: string;
  attachments?: Attachment[];
}
export interface ForumState {
  conversations?: Conversation[];
  publishDrafts?: Record<string, Draft>;
  version: 1;
  users: User[];
  topics: Topic[];
  replies: Reply[];
  notices: Notice[];
  likes: string[];
  replyLikes?: string[];
  saves: string[];
  draft: Draft;
  loggedIn: boolean;
}
