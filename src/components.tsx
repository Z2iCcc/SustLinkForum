import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Waves,
  ArrowUpRight,
  MessageCircle,
  BookOpen,
  MapPin,
  Sprout,
  ShoppingBag,
  Megaphone,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { BoardId, Topic } from "./types";
import { boards } from "./seed";
import { useForum } from "./context";
import { identity } from "./store";
import { AttachmentSummary, AttachmentIndicators, useAssetUrl } from "./Media";
import { formatCount } from "./format";
import { TopicLink } from "./TopicLink";
export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link className="brand" to={to} aria-label="SustLink 校园首页">
      <span className="brand-symbol">
        <Waves size={23} strokeWidth={1.8} />
      </span>
      <span>
        SustLink<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function BoardIcon({ id, size = 18 }: { id: BoardId; size?: number }) {
  const Icon = {
    life: MessageCircle,
    study: BookOpen,
    lost: MapPin,
    clubs: Users,
    market: ShoppingBag,
    tree: Sprout,
    notice: Megaphone,
  }[id];
  return <Icon size={size} strokeWidth={1.7} />;
}
export function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}
export function AuthorName({ name }: { name: string }) {
  return (
    <span className="topic-author" title={name}>
      {name}
    </span>
  );
}
export function relativeTime(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  return minutes < 1
    ? "刚刚"
    : minutes < 60
      ? `${minutes} 分钟前`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} 小时前`
        : dateLabel(timestamp);
}
export function Avatar({
  name,
  color,
  anonymous = false,
  large = false,
  avatarId,
}: {
  name: string;
  color: string;
  anonymous?: boolean;
  large?: boolean;
  avatarId?: string;
}) {
  const { url } = useAssetUrl(anonymous ? undefined : avatarId);
  const [failed, setFailed] = useState<string>();
  return (
    <span
      className={`avatar ${large ? "large" : ""}`}
      style={{ background: color }}
      aria-hidden="true"
    >
      {anonymous ? (
        <Sprout size={large ? 27 : 17} />
      ) : url && failed !== url ? (
        <img src={url} alt="" onError={() => setFailed(url)} />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}
export function Empty({
  title = "这里还很安静",
  description = "新的故事，等你来开启。",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <MessageCircle size={28} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageNav({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const count = Math.max(1, Math.ceil(total / 20));
  if (count <= 1) return null;
  return (
    <nav className="pagination" aria-label="分页">
      <div>
        <button
          aria-label="上一页"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: count }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === count || Math.abs(p - page) <= 1)
          .map((p, i, all) => (
            <span key={p}>
              {i > 0 && p - all[i - 1] > 1 && (
                <span className="page-ellipsis">…</span>
              )}
              <button
                className={page === p ? "selected" : ""}
                aria-current={page === p ? "page" : undefined}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          aria-label="下一页"
          disabled={page === count}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
export function TopicList({
  topics,
  showPreview = true,
  showBoard = true,
}: {
  topics: Topic[];
  showPreview?: boolean;
  showBoard?: boolean;
}) {
  const { state } = useForum();
  return (
    <div className={`topic-list ${showPreview ? "" : "title-only"}`}>
      {topics.map((topic) => {
        const author = identity(state, topic, topic.authorId),
          board = boards.find((b) => b.id === topic.boardId)!;
        const replies = state.replies.filter((r) => r.topicId === topic.id);
        return (
          <article
            className={`topic-row ${topic.pinned ? "pinned" : ""}`}
            key={topic.id}
          >
            <Avatar {...author} />
            <div className="topic-summary">
              <div className="topic-title-line">
                {topic.pinned && <span className="pin-label">置顶</span>}
                <TopicLink className="topic-title" to={`/topic/${topic.id}`}>
                  {topic.title}
                </TopicLink>
                <AttachmentIndicators
                  items={topic.attachments}
                  topicId={topic.id}
                />
              </div>
              {showPreview && topic.body && (
                <p className="topic-excerpt">
                  {topic.body.replace(/\s+/g, " ").trim()}
                </p>
              )}
              {showPreview && <AttachmentSummary items={topic.attachments} />}
              <div className="topic-meta">
                <div className="topic-context">
                  {showBoard && (
                    <Link
                      className="board-tag"
                      to={`/board/${board.id}`}
                      style={{ color: board.color }}
                    >
                      {board.name}
                    </Link>
                  )}
                  <div className="topic-byline">
                    <AuthorName name={author.name} />
                  </div>
                </div>
                <TopicLink
                  className="topic-activity"
                  to={`/topic/${topic.id}`}
                  tabIndex={-1}
                  aria-label={`${replies.length} 条回复，${topic.views} 次浏览，查看主题`}
                >
                  <span
                    className="topic-stat"
                    title={`${replies.length} 条回复`}
                    aria-label={`${replies.length} 条回复`}
                  >
                    <span className="stat-number">
                      {formatCount(replies.length)}
                    </span>
                    <span>回复</span>
                  </span>
                  <span
                    className="topic-stat"
                    title={`${topic.views} 次浏览`}
                    aria-label={`${topic.views} 次浏览`}
                  >
                    <span className="stat-number">
                      {formatCount(topic.views)}
                    </span>
                    <span>浏览</span>
                  </span>
                </TopicLink>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
export function EnterLink({
  children = "进入论坛",
  className = "primary",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link to="/forum" className={className}>
      {children}
      <ArrowUpRight size={18} />
    </Link>
  );
}
