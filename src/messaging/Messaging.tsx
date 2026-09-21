import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { useForum } from "../context";
import { ME } from "../seed";
import { MarketImage } from "../market/Market";
import { priceLabel } from "../market/model";
import {
  startConversation,
  sendChat,
  startDirectConversation,
  sendDirectChat,
  publicChatUsers,
  readChat,
  unreadChatCount,
  type Conversation,
} from "./model";
import { listOriginFrom } from "../navigation";
import type { ForumState } from "../types";
import { Avatar } from "../components";
import { chatReturnTarget } from "./navigation";

type ChatHistory = Pick<Conversation, "messages" | "draft" | "readAt">;

export function ChatPage() {
  const { id = "", peerId } = useParams();
  const direct = peerId !== undefined;
  const { state, update, login, storageWarning } = useForum();
  const location = useLocation(),
    navigate = useNavigate();
  const topic = direct ? undefined : state.topics.find((t) => t.id === id);
  const chat = direct
    ? state.directConversations?.find((c) => c.peerId === peerId)
    : state.conversations?.find((c) => c.topicId === id);
  const recipientId = direct
    ? peerId
    : (state.conversations?.find((c) => c.topicId === id)?.sellerId ??
      topic?.authorId);
  const recipient = state.users.find((u) => u.id === recipientId);
  const available = direct
    ? !!recipient && recipient.id !== ME
    : !!topic && topic.boardId === "market" && topic.authorId !== ME;
  const canStart = direct
    ? publicChatUsers(state).some((u) => u.id === peerId)
    : available;
  const history = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const positionKey = direct
    ? "direct-chat-position:" + peerId
    : "market-chat-position:" + id;
  const unread = chat ? unreadChatCount(chat) : 0;

  function changeChat(
    s: ForumState,
    change: (chat: ChatHistory) => ChatHistory,
  ): ForumState {
    return direct
      ? {
          ...s,
          directConversations: s.directConversations?.map((c) =>
            c.peerId === peerId ? { ...c, ...change(c) } : c,
          ),
        }
      : {
          ...s,
          conversations: s.conversations?.map((c) =>
            c.topicId === id ? { ...c, ...change(c) } : c,
          ),
        };
  }
  useEffect(() => {
    setError("");
    if (state.loggedIn && canStart && !chat) {
      const ok = update(
        (s) =>
          direct
            ? startDirectConversation(s, peerId!)
            : startConversation(s, topic!),
        { requirePersistence: true },
      );
      if (!ok) setError("会话未能保存，请检查浏览器存储后重试。");
    }
  }, [id, peerId, state.loggedIn, canStart, !!chat]);
  useEffect(() => {
    if (chat && state.loggedIn && unread > 0)
      update((s) => changeChat(s, readChat));
  }, [id, peerId, unread, state.loggedIn]);
  useEffect(() => {
    const element = history.current;
    if (!element) return;
    let position: number | undefined;
    try {
      const stored = sessionStorage.getItem(positionKey);
      if (stored !== null && Number.isFinite(Number(stored)))
        position = Number(stored);
    } catch {}
    element.scrollTop = position ?? element.scrollHeight;
  }, [positionKey, !!chat]);

  function send(simulate = false) {
    setError("");
    const body = simulate
      ? direct
        ? "【演示回复】你好，很高兴和你交流！"
        : "【演示回复】你好，物品还在，具体情况可以继续询问。"
      : (chat?.draft ?? "");
    const ok = update(
      (s) =>
        direct
          ? sendDirectChat(s, peerId!, body, crypto.randomUUID(), simulate)
          : sendChat(s, id, body, crypto.randomUUID(), simulate),
      { requirePersistence: true },
    );
    if (ok)
      requestAnimationFrame(() => {
        if (history.current)
          history.current.scrollTop = history.current.scrollHeight;
      });
    else setError("消息未能保存，请重试，输入内容已保留。");
  }
  function openProduct(event: MouseEvent<HTMLAnchorElement>) {
    if (
      direct ||
      !topic ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate("/topic/" + id, {
      state: {
        listOrigin: listOriginFrom(location),
        restoreScroll: location.state?.restoreTopicY ?? 0,
      },
    });
  }
  if (!state.loggedIn)
    return (
      <section className="content-panel chat-login">
        <h1>聊一聊</h1>
        <p>登录演示账号后查看本机聊天记录。</p>
        <button className="primary" onClick={login}>
          演示登录
        </button>
      </section>
    );
  if (recipientId === ME)
    return (
      <section className="content-panel chat-login">
        <p>无需与自己聊天。</p>
        <Link to="/messages">返回消息</Link>
      </section>
    );
  if (!chat)
    return (
      <section className="content-panel chat-login">
        <p>
          {error ||
            (canStart
              ? "正在打开会话…"
              : direct
                ? "暂时无法与这位同学发起私聊。"
                : "商品已不可查看，无法创建会话。")}
        </p>
        <Link to="/messages">返回消息</Link>
      </section>
    );
  return (
    <>
      <Link
        className="breadcrumb"
        {...chatReturnTarget(location, topic?.id)}
        replace
      >
        <ArrowLeft size={14} />
        返回
      </Link>
      <section
        className={`content-panel market-chat ${direct ? "direct-chat" : ""}`}
      >
        <header className="chat-heading">
          <div className="chat-person">
            <Avatar
              name={recipient?.name ?? "校园同学"}
              color={recipient?.color ?? "#7796a1"}
              avatarId={recipient?.avatarId}
            />
            <h1>{recipient?.name ?? "校园同学"}</h1>
          </div>
          <p>私聊演示 · 消息仅保存在本浏览器，不会发送给对方</p>
        </header>
        {!direct &&
          (topic ? (
            <Link
              className="chat-product"
              to={"/topic/" + id}
              onClick={openProduct}
            >
              <div>
                <MarketImage topic={topic} />
              </div>
              <span>
                <strong>{topic.title}</strong>
                <small>
                  {priceLabel(topic)} ·{" "}
                  {topic.market?.status === "sold"
                    ? "已售出"
                    : topic.market?.status === "withdrawn"
                      ? "已下架"
                      : "查看商品详情"}{" "}
                  ↗
                </small>
              </span>
            </Link>
          ) : (
            <div className="chat-product unavailable">
              <span>
                <strong>{"title" in chat ? chat.title : ""}</strong>
                <small>商品已不可查看，已有聊天记录仍保留。</small>
              </span>
            </div>
          ))}
        <div
          className="chat-history"
          ref={history}
          role="log"
          tabIndex={0}
          aria-label="聊天记录"
          onScroll={(e) => {
            try {
              sessionStorage.setItem(
                positionKey,
                String(e.currentTarget.scrollTop),
              );
            } catch {}
          }}
        >
          {!chat.messages.length && (
            <p className="chat-empty">
              {direct ? "从一句你好，开始交流吧。" : "先和卖家打个招呼吧。"}
            </p>
          )}
          {chat.messages.map((m) => (
            <div
              className={`chat-message ${m.authorId === ME ? "mine" : ""}`}
              key={m.id}
            >
              <span className="chat-message-meta">
                <span>
                  {m.authorId === ME ? "我" : (recipient?.name ?? "校园同学")}
                </span>{" "}
                <time dateTime={new Date(m.createdAt).toISOString()}>
                  {new Date(m.createdAt).toLocaleTimeString("zh-CN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </span>
              <p>{m.body}</p>
              <small>本机已保存</small>
            </div>
          ))}
        </div>
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="chat-input">消息</label>
          <textarea
            id="chat-input"
            placeholder="输入消息…"
            maxLength={3000}
            disabled={!available}
            value={chat.draft}
            onChange={(e) => {
              setError("");
              const draft = e.target.value;
              update((s) => changeChat(s, (c) => ({ ...c, draft })));
            }}
          />
          {(error || storageWarning) && (
            <p className="form-error" role="alert">
              {error || storageWarning}
            </p>
          )}
          {!available && direct && (
            <p className="form-error">对方账号已不可用，已有记录仍保留。</p>
          )}
          <div>
            <button
              type="button"
              className="text-button"
              disabled={!available}
              onClick={() => send(true)}
            >
              {direct ? "模拟同学回复" : "模拟卖家回复"}
            </button>
            <button
              className="primary"
              disabled={!available || !chat.draft.trim()}
            >
              <Send size={15} />
              发送
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
