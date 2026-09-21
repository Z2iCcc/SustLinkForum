import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Check,
  Heart,
  MessageCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useForum } from "../context";
import { Avatar, Empty, relativeTime } from "../components";
import { identity } from "../store";
import {
  markAllMessagesRead,
  publicChatUsers,
  unreadChatCount,
  unreadMessageCount,
} from "./model";
import type { Notice } from "../types";
import { ChatEntryLink } from "./navigation";
import { SourceLink } from "./navigation";

function Unread({ count }: { count: number }) {
  return count > 0 ? (
    <span className="message-unread" aria-label={`${count} 条未读`}>
      {count > 99 ? "99+" : count}
    </span>
  ) : null;
}

function ClassmatePicker() {
  const { state } = useForum();
  const [query, setQuery] = useState("");
  const users = publicChatUsers(state).filter((u) =>
    u.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <section
      className="classmate-picker"
      id="classmate-picker"
      aria-label="选择私聊同学"
    >
      <label className="message-search">
        <Search size={16} aria-hidden="true" />
        <input
          autoFocus
          aria-label="搜索同学昵称"
          placeholder="搜索同学昵称"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="classmate-results">
        {users.map((user) => (
          <ChatEntryLink
            source="messages"
            className="classmate-choice"
            key={user.id}
            to={"/messages/people/" + encodeURIComponent(user.id)}
          >
            <Avatar {...user} />
            <span>
              <strong>{user.name}</strong>
              <small>{user.bio || "校园同学"}</small>
            </span>
            <MessageCircle size={16} aria-hidden="true" />
          </ChatEntryLink>
        ))}
        {!users.length && (
          <p className="message-empty">没有找到这位同学，换个昵称试试。</p>
        )}
      </div>
    </section>
  );
}

export function ConversationList() {
  const { state } = useForum();
  const entries = [
    ...(state.conversations ?? []).map((c) => ({
      key: "market:" + c.topicId,
      to: "/messages/chat/" + encodeURIComponent(c.topicId),
      peerId: c.sellerId,
      context: state.topics.find((t) => t.id === c.topicId)?.title ?? c.title,
      preview: c.draft
        ? "[草稿] " + c.draft
        : (c.messages.at(-1)?.body ?? "还没有发送消息"),
      time: c.messages.at(-1)?.createdAt ?? 0,
      unread: unreadChatCount(c),
    })),
    ...(state.directConversations ?? []).map((c) => ({
      key: "person:" + c.peerId,
      to: "/messages/people/" + encodeURIComponent(c.peerId),
      peerId: c.peerId,
      context: "",
      preview: c.draft
        ? "[草稿] " + c.draft
        : (c.messages.at(-1)?.body ?? "还没有发送消息"),
      time: c.messages.at(-1)?.createdAt ?? c.createdAt,
      unread: unreadChatCount(c),
    })),
  ].sort((a, b) => b.time - a.time);
  return (
    <div className="conversation-list">
      {entries.map((entry) => {
        const user = state.users.find((u) => u.id === entry.peerId);
        return (
          <ChatEntryLink
            source="messages"
            className={`conversation-row ${entry.unread ? "has-unread" : ""}`}
            to={entry.to}
            key={entry.key}
            data-conversation={entry.key}
          >
            <Avatar
              name={user?.name ?? "校园同学"}
              color={user?.color ?? "#7796a1"}
              avatarId={user?.avatarId}
            />
            <div className="conversation-copy">
              <div className="conversation-title">
                <strong>{user?.name ?? "校园同学"}</strong>
                {entry.time > 0 && (
                  <time dateTime={new Date(entry.time).toISOString()}>
                    {relativeTime(entry.time)}
                  </time>
                )}
              </div>
              {entry.context && (
                <small className="conversation-context" title={entry.context}>
                  商品 · {entry.context}
                </small>
              )}
              <div className="conversation-preview">
                <p>{entry.preview}</p>
                <Unread count={entry.unread} />
              </div>
            </div>
          </ChatEntryLink>
        );
      })}
      {!entries.length && (
        <Empty
          title="还没有私聊消息"
          description="从上方选择一位同学，或在商品详情点击「聊一聊」。"
        />
      )}
    </div>
  );
}

function NoticeList({ notices }: { notices: Notice[] }) {
  const { state, update } = useForum();
  return (
    <div className="message-notices">
      {notices.map((n) => {
        const topic = state.topics.find((t) => t.id === n.topicId);
        const who =
          topic && n.actorId ? identity(state, topic, n.actorId) : null;
        const Icon =
          n.kind === "reply"
            ? MessageCircle
            : n.kind === "system"
              ? Bell
              : Heart;
        const action =
          n.kind === "reply"
            ? "回复了你的主题"
            : n.kind === "save"
              ? "收藏了你的主题"
              : "赞了你的主题";
        return (
          <SourceLink
            className={`notice-row ${n.read ? "" : "unread"}`}
            key={n.id}
            to={
              topic
                ? `/topic/${topic.id}${n.replyId ? "#" + n.replyId : ""}`
                : "/forum"
            }
            onClick={() =>
              update((s) => ({
                ...s,
                notices: s.notices.map((item) =>
                  item.id === n.id ? { ...item, read: true } : item,
                ),
              }))
            }
          >
            <span className="notice-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <div>
              <strong>
                {n.kind === "system"
                  ? "欢迎来到 SustLink 校园社区"
                  : `${who?.name ?? "校园同学"} ${action}`}
              </strong>
              <p>{topic?.title ?? "原主题已不可用"}</p>
              <small>{relativeTime(n.createdAt)}</small>
            </div>
            {!n.read && <i className="unread-dot" aria-label="未读" />}
            <ArrowUpRight size={15} aria-hidden="true" />
          </SourceLink>
        );
      })}
    </div>
  );
}

export function MessageCenter() {
  const { state, update } = useForum();
  const [params] = useSearchParams();
  const [choosing, setChoosing] = useState(false);
  const tab = params.get("tab");
  const kinds =
    tab === "likes"
      ? ["like", "save"]
      : tab === "replies"
        ? ["reply"]
        : tab === "system"
          ? ["system"]
          : [];
  const title =
    tab === "likes" ? "赞和收藏" : tab === "replies" ? "回复" : "系统通知";
  const notices = state.notices
    .filter((n) => kinds.includes(n.kind))
    .sort((a, b) => b.createdAt - a.createdAt);
  const unreadFor = (types: string[]) =>
    state.notices.filter((n) => !n.read && types.includes(n.kind)).length;
  const system = state.notices
    .filter((n) => n.kind === "system")
    .sort((a, b) => b.createdAt - a.createdAt);
  return (
    <section className="content-panel message-center">
      <header className="message-center-heading">
        {kinds.length ? (
          <div>
            <Link className="message-back" to="/messages">
              <ArrowLeft size={14} />
              消息
            </Link>
            <h1>{title}</h1>
          </div>
        ) : (
          <h1>消息</h1>
        )}
        <button
          className="text-button"
          disabled={unreadMessageCount(state) === 0}
          onClick={() => update(markAllMessagesRead)}
        >
          <Check size={15} />
          全部已读
        </button>
      </header>
      {kinds.length ? (
        <>
          {notices.length ? (
            <NoticeList notices={notices} />
          ) : (
            <Empty
              title={
                tab === "likes"
                  ? "还没有收到赞和收藏"
                  : tab === "replies"
                    ? "还没有收到回复"
                    : "暂无系统通知"
              }
              description="新的互动会出现在这里。"
            />
          )}
        </>
      ) : (
        <>
          <nav className="message-shortcuts" aria-label="互动消息">
            <Link to="/messages?tab=likes">
              <span className="message-shortcut-icon likes">
                <Heart size={25} fill="currentColor" aria-hidden="true" />
                <Unread count={unreadFor(["like", "save"])} />
              </span>
              <span>赞和收藏</span>
            </Link>
            <Link to="/messages?tab=replies">
              <span className="message-shortcut-icon replies">
                <MessageCircle size={25} aria-hidden="true" />
                <Unread count={unreadFor(["reply"])} />
              </span>
              <span>回复</span>
            </Link>
          </nav>
          <div className="conversation-heading">
            <h2>私聊</h2>
            <button
              className="text-button"
              aria-expanded={choosing}
              aria-controls="classmate-picker"
              onClick={() => setChoosing(!choosing)}
            >
              {choosing ? <X size={15} /> : <Plus size={15} />}
              {choosing ? "收起" : "发起私聊"}
            </button>
          </div>
          {choosing && <ClassmatePicker />}
          {system.length > 0 && (
            <Link
              className="conversation-row system-conversation"
              to="/messages?tab=system"
            >
              <span className="message-system-icon">
                <Bell size={21} aria-hidden="true" />
              </span>
              <div className="conversation-copy">
                <div className="conversation-title">
                  <strong>系统通知</strong>
                  <time dateTime={new Date(system[0].createdAt).toISOString()}>
                    {relativeTime(system[0].createdAt)}
                  </time>
                </div>
                <div className="conversation-preview">
                  <p>
                    {state.topics.find((t) => t.id === system[0].topicId)
                      ?.title ?? "查看校园通知"}
                  </p>
                  <Unread count={unreadFor(["system"])} />
                </div>
              </div>
            </Link>
          )}
          <ConversationList />
        </>
      )}
      <p className="message-demo-note">
        本地演示 · 消息仅保存在本浏览器，不会发送给其他同学。
      </p>
    </section>
  );
}
