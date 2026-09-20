import { MarketHome, MarketDetailContent, MarketActions } from "./market/Market";
import { canComment } from "./market/model";
import { DetailAction, TopicReactions } from "./DetailActions";
import { ConversationList } from "./messaging/Messaging";
import { markAllMessagesRead, unreadMessageCount } from "./messaging/model";
import { readingScrollY, scrollReadingTo } from "./scroll";
import { useEffect, useState, useRef, type FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Search,
  Heart,
  MessageCircle,
  Quote,
  X,
  Eye,
  Send,
  Check,
  Bell,
  Pencil,
  Sprout,
  Trash2,
} from "lucide-react";
import { useForum } from "./context";
import { boards, ME } from "./seed";
import {
  addReply,
  identity,
  publishTopic,
  selectTopics,
  selectReplies,
  replyLikeCount,
  toggleReplyLike,
  deleteTopic,
  removedAttachmentIds,
  deleteReply,
  replyFloor,
} from "./store";
import { TITLE_LIMIT, titleLength, limitTitle } from "./format";
import {
  Avatar,
  AuthorName,
  BoardIcon,
  dateLabel,
  Empty,
  PageNav,
  relativeTime,
  TopicList,
  PostBody,
} from "./components";
import type {
  Attachment,
  BoardId,
  Draft,
  Topic,
  Reply,
  ReplySort,
} from "./types";
import { Attachments, UploadPicker, AvatarPicker } from "./Media";
import { useComposeExit, composeSourceName, useTopicExit } from "./navigation";
import { BoardPublisher } from "./publishing/BoardPublisher";
import { preserveComposeScroll } from "./publishing/preserveScroll";
import {
  isPublishBoard,
  publishingFor,
  switchPublishingDraft,
} from "./publishing/model";
import { TopicLink } from "./TopicLink";
import campusUrl from "./illustrations/campus.svg";
import libraryUrl from "./illustrations/library.svg";
import { ReplySortSelect } from "./ReplySortSelect";
import { deleteFile } from "./media-store";
import {
  categoriesFor,
  categoryName,
  validCategory,
  UNCATEGORIZED,
} from "./categories";
import { CategoryButton, CategoryPanel } from "./CategoryFilter";

export function ForumHome() {
  const { state } = useForum();
  const { boardId } = useParams();
  const [params, setParams] = useSearchParams();
  const board = boards.find((b) => b.id === boardId);
  const sort = params.get("sort") ?? "reply";
  const filterBoard = boardId ?? params.get("board") ?? "";
  const category = params.get("category") ?? "";
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const invalidCategory =
    !!category &&
    category !== UNCATEGORIZED &&
    !categoryName(filterBoard, category);
  const topics = selectTopics(state, { board: filterBoard, category, sort });
  function filterCategory(nextBoard: string, nextCategory: string) {
    const next = new URLSearchParams(params);
    if (!boardId) {
      if (nextBoard) next.set("board", nextBoard);
      else next.delete("board");
    }
    if (nextCategory) next.set("category", nextCategory);
    else next.delete("category");
    next.delete("page");
    setParams(next, { state: { restoreScroll: readingScrollY() } });
  }
  const page = Math.min(
    Math.max(1, Number(params.get("page")) || 1),
    Math.max(1, Math.ceil(topics.length / 20)),
  );
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key !== "page") next.delete("page");
    // Sorting changes the list in place; pagination still starts at the top.
    setParams(next, key === "sort" ? { state: { restoreScroll: readingScrollY() } } : undefined);
  }
  if (boardId && !board) return <NotFound />;
  if (boardId === "market") return <MarketHome />;
  return (
    <>
      <div className={`forum-banner ${board ? "board-banner" : ""}`}>
        <div>
          <p className="eyebrow">
            {board ? "FIND YOUR PEOPLE" : "GOOD TO SEE YOU HERE"}
          </p>
          <h1>{board ? board.name : "校园里的每一种声音。"}</h1>
          <p>
            {board
              ? board.description
              : "从今天的小事，到明天的可能。在这里，和同学聊聊。"}
          </p>
        </div>
        <img src={board?.id === "study" ? libraryUrl : campusUrl} alt="" />
      </div>
      {board?.id === "tree" && (
        <div className="inline-note">
          <Sprout size={17} />
          <span>本板块匿名发言。当前为本地演示，不提供真实身份保密。</span>
        </div>
      )}
      <section className="topics-panel">
        <div className="list-toolbar">
          <div className="list-tabs" aria-label="主题排序">
            {[
              ["reply", "最近回复"],
              ["new", "最新发布"],
              ["hot", "热门讨论"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={sort === id ? "active" : ""}
                onClick={() => setFilter("sort", id)}
                aria-pressed={sort === id}
              >
                {label}
              </button>
            ))}
          </div>
          <CategoryButton
            open={categoriesOpen}
            onClick={() => setCategoriesOpen(!categoriesOpen)}
            board={filterBoard}
            scoped={!!boardId}
            category={category}
            panelId="forum-categories"
          />
        </div>
        <CategoryPanel
          id="forum-categories"
          open={categoriesOpen}
          board={filterBoard}
          category={category}
          fixedBoard={!!boardId}
          onChange={filterCategory}
        />
        {topics.length ? (
          <TopicList
            topics={topics.slice((page - 1) * 20, page * 20)}
            showPreview={false}
            showBoard={!boardId}
          />
        ) : (
          <Empty
            title={invalidCategory ? "这个分类已不可用" : "这个分类还没有笔记"}
            description="可以查看全部内容，或发布第一篇笔记。"
            action={
              <button
                className="secondary"
                onClick={() => filterCategory(boardId ?? "", "")}
              >
                查看全部
              </button>
            }
          />
        )}
        <PageNav
          page={page}
          total={topics.length}
          onChange={(p) => {
            setFilter("page", String(p));
            scrollReadingTo(0);
          }}
        />
      </section>
    </>
  );
}
export function SearchPage() {
  const { state } = useForum();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "",
    board = params.get("board") ?? "";
  const category = params.get("category") ?? "";
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  function filterCategory(nextBoard: string, nextCategory: string) {
    const next = new URLSearchParams(params);
    if (nextBoard) next.set("board", nextBoard);
    else next.delete("board");
    if (nextCategory) next.set("category", nextCategory);
    else next.delete("category");
    next.delete("page");
    setParams(next, { state: { restoreScroll: readingScrollY() } });
  }
  const [input, setInput] = useState(query);
  useEffect(() => setInput(query), [query]);
  const topics = query.trim()
    ? selectTopics(state, { query, board, category })
    : [];
  const page = Math.min(
    Math.max(1, Number(params.get("page")) || 1),
    Math.max(1, Math.ceil(topics.length / 20)),
  );
  function search(e: FormEvent) {
    e.preventDefault();
    setParams({
      q: input.trim(),
      ...(board ? { board } : {}),
      ...(category ? { category } : {}),
    });
  }
  return (
    <section className="content-panel">
      <div className="page-heading">
        <p className="eyebrow">LOOK AROUND</p>
        <h1>找找你感兴趣的讨论</h1>
        <p>搜索笔记标题与正文，发现校园里的答案。</p>
      </div>
      <form className="search-form" onSubmit={search}>
        <label className="search-field">
          <Search size={19} />
          <input
            aria-label="搜索关键词"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入关键词，例如：图书馆"
          />
        </label>
        <button className="primary">搜索</button>
      </form>
      <div className="search-filters">
        {query.trim() && (
          <span aria-live="polite">找到 {topics.length} 个主题</span>
        )}
        <CategoryButton
          open={categoriesOpen}
          onClick={() => setCategoriesOpen(!categoriesOpen)}
          board={board}
          category={category}
          panelId="search-categories"
        />
      </div>
      <CategoryPanel
        id="search-categories"
        open={categoriesOpen}
        board={board}
        category={category}
        onChange={filterCategory}
      />
      {topics.length ? (
        <>
          <TopicList topics={topics.slice((page - 1) * 20, page * 20)} />
          <PageNav
            page={page}
            total={topics.length}
            onChange={(p) =>
              setParams({
                q: query,
                ...(board ? { board } : {}),
                ...(category ? { category } : {}),
                page: String(p),
              })
            }
          />
        </>
      ) : (
        <Empty
          title={query ? "没有找到相关主题" : "你想了解什么？"}
          description={
            query
              ? "换一个关键词，或试试其他板块。"
              : "课程经验、校园日常，或一个小小的疑问。"
          }
          action={
            board || category ? (
              <button
                className="secondary"
                onClick={() => filterCategory("", "")}
              >
                清除筛选
              </button>
            ) : undefined
          }
        />
      )}
    </section>
  );
}
function QuoteBlock({ topic, quoteId }: { topic: Topic; quoteId: string }) {
  const { state } = useForum();
  const source =
    quoteId === topic.id
      ? topic
      : state.replies.find((r) => r.id === quoteId && r.topicId === topic.id);
  if (!source)
    return <blockquote className="quoted">引用的内容已删除</blockquote>;
  const author = identity(state, topic, source.authorId);
  const floor = quoteId === topic.id ? 1 : replyFloor(state, source as Reply);
  return (
    <blockquote className="quoted content-hit-area">
      <TopicLink
        className="content-hit-link"
        to={`/topic/${topic.id}#${quoteId === topic.id ? "floor-1" : quoteId}`}
      >
        {author.name} #{floor}
        <ArrowUpRight size={12} />
      </TopicLink>
      <p>
        {source.body.length > 200
          ? source.body.slice(0, 200) + "…"
          : source.body ||
            `分享了 ${source.attachments?.length ?? 0} 个文件，点击查看`}
      </p>
    </blockquote>
  );
}
export function TopicPage() {
  const location = useLocation();
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const repliesHeading = useRef<HTMLHeadingElement>(null);
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const rawSort = params.get("replySort");
  const replySort: ReplySort =
    rawSort === "likes" || rawSort === "newest" ? rawSort : "oldest";
  const { state, update, requireLogin, toast, login } = useForum();
  const topic = state.topics.find((t) => t.id === id);
  const {
    exit: exitTopic,
    hasOrigin,
    sourceName,
  } = useTopicExit(topic?.boardId);
  const [onlyAuthor, setOnlyAuthor] = useState(false),
    [reply, setReply] = useState(""),
    [quoteId, setQuoteId] = useState<string>(),
    [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const [replyFiles, setReplyFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    setOnlyAuthor(false);
    deleteDialog.current?.close();
    setDeleteTarget(null);
    setReply("");
    setQuoteId(undefined);
    setError("");
    setReplyFiles([]);
  }, [id]);
  if (!topic) return <NotFound />;
  const board = boards.find((b) => b.id === topic.boardId)!,
    author = identity(state, topic, topic.authorId);
  const isMarket = topic.boardId === "market";
  const replyAllowed = canComment(topic, ME);
  const replies = state.replies.filter((r) => r.topicId === topic.id);
  const visible = selectReplies(state, topic, replySort, onlyAuthor);
  function quote(target: string) {
    if (!requireLogin() || !replyAllowed) return;
    setQuoteId(target);
    setTimeout(() => {
      input.current?.focus();
      input.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "center",
      });
    }, 0);
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!requireLogin()) return;
    if (uploading) return;
    if (!reply.trim() && !replyFiles.length) {
      setError("写一点内容再回复吧。");
      input.current?.focus();
      return;
    }
    const newId = crypto.randomUUID();
    if (
      update((s) =>
        addReply(s, topic!.id, reply, quoteId, newId, Date.now(), replyFiles),
      )
    ) {
      setReply("");
      setReplyFiles([]);
      setQuoteId(undefined);
      setError("");
      setOnlyAuthor(false);
      toast("回复已保存");
      setTimeout(
        () =>
          document.getElementById(newId)?.scrollIntoView({ block: "center" }),
        0,
      );
    }
  }
  return (
    <>
      {hasOrigin ? (
        <button className="breadcrumb compose-back" onClick={exitTopic}>
          <ArrowLeft size={14} />
          {isMarket ? "返回" : sourceName}
        </button>
      ) : (
        <Link className="breadcrumb" to={`/board/${board.id}`}>
          <ArrowLeft size={14} />
          {isMarket ? "返回" : board.name}
        </Link>
      )}
      <article className={`content-panel topic-detail ${isMarket ? "market-detail" : ""}`}>
        <header className="detail-heading">
          <div className="detail-tags">
            <span className="board-tag" style={{ color: board.color }}>
              <BoardIcon id={board.id} size={14} />
              {board.name}
            </span>
            {topic.pinned && <span className="pin-label">置顶</span>}
          </div>
          <h1>{topic.title}</h1>
          <div className="detail-counts">
            <span>
              <Eye size={14} />
              {topic.views} 次浏览
            </span>
            <span>
              <MessageCircle size={14} />
              {replies.length} 条回复
            </span>
          </div>
        </header>
        <section className="original-post" id="floor-1">
          <div className="floor-header">
            <Avatar {...author} />
            <div>
              <strong>{author.name}</strong>
              <span className="author-badge">{isMarket ? "卖家" : "楼主"}</span>
              <small>
                <time
                  dateTime={new Date(topic.createdAt).toISOString()}
                  title="发布时间"
                >
                  {dateLabel(topic.createdAt)}
                </time>
              </small>
            </div>
            <span className="floor-number">#1</span>
          </div>
          {isMarket ? <MarketDetailContent topic={topic}/> : <><PostBody body={topic.body}/><Attachments items={topic.attachments} /></>}
          {isMarket && <MarketActions topic={topic}/>}
          <div className="post-actions">
            {!isMarket && <><TopicReactions topic={topic}/>
            <DetailAction icon={Quote} label="引用" onClick={() => quote(topic.id)} />
            </>}
            {state.loggedIn && topic.authorId === ME && (
              <DetailAction icon={Trash2} label="删除"
                className="delete-note"
                onClick={() => {
                  setDeleteTarget(null);
                  deleteDialog.current?.showModal();
                }}
              />
            )}
          </div>
        </section>
        <div className="replies-heading">
          <h2 ref={repliesHeading} tabIndex={-1}>
            {isMarket ? "留言" : "回复"} <span>{replies.length}</span>
          </h2>
          <div className="reply-view-controls">
            <ReplySortSelect
              value={replySort}
              onChange={(value) => {
                const next = new URLSearchParams(params);
                if (value === "oldest") next.delete("replySort");
                else next.set("replySort", value);
                setParams(next, {
                  state: { ...location.state, restoreScroll: readingScrollY() },
                });
              }}
            />
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={onlyAuthor}
                onChange={(e) => setOnlyAuthor(e.target.checked)}
              />
              {isMarket ? "只看卖家" : "只看楼主"}
            </label>
          </div>
        </div>
        {visible.map((r) => {
          const who = identity(state, topic, r.authorId);
          const floor = replyFloor(state, r);
          return (
            <section className="reply-floor" id={r.id} key={r.id}>
              <div className="floor-header">
                <Avatar {...who} />
                <div>
                  <strong>{who.name}</strong>
                  {who.author && <span className="author-badge">楼主</span>}
                  <small>
                    <time
                      dateTime={new Date(r.createdAt).toISOString()}
                      title="回复时间"
                    >
                      {dateLabel(r.createdAt)}
                    </time>
                  </small>
                </div>
                <span className="floor-number">#{floor}</span>
              </div>
              {r.quoteId && <QuoteBlock topic={topic} quoteId={r.quoteId} />}
              <PostBody body={r.body}/>
              <Attachments items={r.attachments} />
              <div className="reply-actions post-actions">
                <DetailAction icon={Heart}
                  className={`reaction-like ${state.replyLikes?.includes(r.id) ? "is-active" : ""}`}
                  label={`点赞回复 #${floor}，${replyLikeCount(state, r)} 个赞`}
                  aria-pressed={state.replyLikes?.includes(r.id) ?? false}
                  onClick={() => {
                    if (requireLogin()) update((s) => toggleReplyLike(s, r.id));
                  }}
                />
                <DetailAction icon={Quote} label="引用回复"
                  className="reply-quote text-button"
                  disabled={!replyAllowed}
                  onClick={() => quote(r.id)}
                />
                {state.loggedIn &&
                  (r.authorId === ME || topic.authorId === ME) && (
                    <DetailAction icon={Trash2} label="删除"
                      className="delete-note"
                      onClick={() => {
                        setDeleteTarget(r.id);
                        deleteDialog.current?.showModal();
                      }}
                    />
                  )}
              </div>
            </section>
          );
        })}
        {replyAllowed ? <form className="reply-editor" onSubmit={submit}>
          <h3>
            {isMarket ? "向卖家留言" : topic.boardId === "tree" ? "留下一条匿名回复" : "加入这场讨论"}
          </h3>
          {quoteId && (
            <div className="reply-quote-preview">
              <QuoteBlock topic={topic} quoteId={quoteId} />
              <button
                type="button"
                className="icon-button"
                aria-label="取消引用"
                onClick={() => setQuoteId(undefined)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <textarea
            ref={input}
            aria-label="回复内容"
            value={reply}
            onChange={(e) => {
              setReply(e.target.value);
              setError("");
            }}
            maxLength={3000}
            placeholder={
              state.loggedIn
                ? "分享你的想法，友善交流…"
                : "先写下想法，登录演示账号后即可回复…"
            }
          />
          <UploadPicker
            label="回复"
            items={replyFiles}
            onAdd={(files) =>
              setReplyFiles((current) => [...current, ...files])
            }
            onRemove={(id) =>
              setReplyFiles((current) =>
                current.filter((file) => file.id !== id),
              )
            }
            onBusy={setUploading}
            disabled={!state.loggedIn}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="editor-footer">
            <span>{reply.length} / 3000 · 仅本地保存</span>
            {state.loggedIn ? (
              <button className="primary" disabled={uploading}>
                <Send size={15} />
                发布回复
              </button>
            ) : (
              <button className="primary" type="button" onClick={login}>
                登录后回复
                <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </form> : <p className="market-comments-closed">卖家已关闭公开留言，可通过「聊一聊」咨询。</p>}
        <dialog
          ref={deleteDialog}
          className="delete-dialog"
          aria-labelledby="delete-note-title"
        >
          <h2 id="delete-note-title">
            {deleteTarget ? "是否确认删除回复？" : "是否确认删除笔记？"}
          </h2>
          <div className="delete-dialog-actions">
            <button
              className="secondary"
              autoFocus
              onClick={() => deleteDialog.current?.close()}
            >
              取消
            </button>
            <button
              className="danger-button"
              onClick={() => {
                let fileIds: string[] = [];
                const deleted = update(
                  (current) => {
                    const next = deleteTarget
                      ? deleteReply(current, deleteTarget)
                      : deleteTopic(current, topic.id);
                    fileIds = removedAttachmentIds(current, next);
                    return next;
                  },
                  { requirePersistence: true },
                );
                if (!deleted) return;
                deleteDialog.current?.close();
                if (deleteTarget) {
                  if (quoteId === deleteTarget) setQuoteId(undefined);
                  setDeleteTarget(null);
                  requestAnimationFrame(() =>
                    repliesHeading.current?.focus({ preventScroll: true }),
                  );
                } else exitTopic();
                void Promise.allSettled(fileIds.map(deleteFile)).then(
                  (results) => {
                    if (results.some((result) => result.status === "rejected"))
                      toast("内容已删除，部分本地附件未能清理");
                  },
                );
              }}
            >
              确认删除
            </button>
          </div>
        </dialog>
      </article>
    </>
  );
}
export function NewTopic() {
  const location = useLocation();
  const { state, update, requireLogin, toast, login, storageWarning } =
    useForum();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { exit: exitCompose, sourcePath } = useComposeExit();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false),
    [error, setError] = useState("");
  const composingTitle = useRef(false);
  useEffect(() => {
    if (location.state?.composeInitialized) return;
    const board = params.get("board");
    if (
      board &&
      boards.some((b) => b.id === board) &&
      board !== state.draft.boardId &&
      (isPublishBoard(board) || isPublishBoard(state.draft.boardId))
    ) {
      const category = params.get("category");
      const mode =
        board === "lost" && category === "found"
          ? "found"
          : board === "clubs" && category === "recruitment"
            ? "recruit"
            : board === "clubs" && category === "recaps"
              ? "recap"
              : undefined;
      update((s) => {
        const next = switchPublishingDraft(s, board as BoardId, mode);
        if (
          isPublishBoard(board) &&
          !next.draft.title &&
          !next.draft.body &&
          categoryName(board, category ?? "")
        ) {
          const selected = { ...next.draft, categoryId: category! };
          // Initialize the source filter only for a fresh form, never overwrite saved fields.
          if (!next.draft.publishing?.category) {
            const initial = publishingFor({
              ...selected,
              publishing: undefined,
            });
            next.draft = { ...selected, publishing: initial };
          }
        }
        return next;
      });
    }
    if (
      board &&
      !(
        board !== state.draft.boardId &&
        (isPublishBoard(board) || isPublishBoard(state.draft.boardId))
      ) &&
      boards.some((b) => b.id === board) &&
      !state.draft.title &&
      !state.draft.body &&
      !state.draft.attachments?.length
    )
      update((s) => ({
        ...s,
        draft: {
          ...s.draft,
          boardId: board as BoardId,
          categoryId: categoryName(board, params.get("category") ?? "")
            ? params.get("category")!
            : undefined,
        },
      }));
    navigate(location.pathname + location.search, {
      replace: true,
      state: {
        ...location.state,
        composeInitialized: true,
        restoreScroll: readingScrollY(),
      },
    });
  }, []);
  const draft = state.draft;
  const titleCount = titleLength(draft.title);
  if (isPublishBoard(draft.boardId))
    return (
      <BoardPublisher
        key={`${draft.boardId}:${publishingFor(draft).mode}`}
        exit={exitCompose}
        source={composeSourceName(sourcePath, state.topics)}
      />
    );
  function change(patch: Partial<Draft>) {
    setError("");
    update((s) => ({ ...s, draft: { ...s.draft, ...patch } }));
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!requireLogin()) return;
    if (uploading) return;
    if (
      !draft.title.trim() ||
      (!draft.body.trim() && !draft.attachments?.length)
    ) {
      setError("请填写标题，并添加正文、图片或附件后再发布。");
      return;
    }
    const id = crypto.randomUUID();
    if (update((s) => publishTopic(s, s.draft, id))) {
      toast("笔记已发布并保存到本浏览器");
      navigate(`/topic/${id}`);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={exitCompose}
        className="breadcrumb compose-back"
      >
        <ArrowLeft size={14} />
        {composeSourceName(sourcePath, state.topics)}
      </button>
      <section className="content-panel compose-panel">
        <div className="page-heading">
          <p className="eyebrow">START A CONVERSATION</p>
          <h1>发布新笔记</h1>
          <p>一个想法、一段日常，或一个等待解答的问题。</p>
        </div>
        <form onSubmit={submit}>
          <div className="compose-top">
            <label>
              发布到
              <select
                value={draft.boardId}
                onChange={(e) => {
                  const board = e.target.value as BoardId;
                  preserveComposeScroll(() =>
                    isPublishBoard(board)
                      ? update((s) => switchPublishingDraft(s, board))
                      : change({
                          boardId: board,
                          categoryId: undefined,
                          publishing: undefined,
                        }),
                  );
                }}
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            {!!categoriesFor(draft.boardId).length && (
              <label>
                分类（选填）
                <select
                  aria-label="笔记二级分类"
                  value={draft.categoryId ?? ""}
                  onChange={(e) =>
                    change({ categoryId: e.target.value || undefined })
                  }
                >
                  <option value="">未分类</option>
                  {!validCategory(draft.boardId, draft.categoryId) && (
                    <option value={draft.categoryId}>分类已失效，请重选</option>
                  )}
                  {categoriesFor(draft.boardId).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="draft-status">
              <Check size={14} />
              {storageWarning ? "草稿暂存本页" : "草稿自动保存"}
            </span>
          </div>
          {draft.boardId === "tree" && (
            <div className="inline-note">
              <Sprout size={16} />
              本主题将匿名展示。此为本地演示，不提供真实身份保密。
            </div>
          )}
          <label className="field-label" htmlFor="topic-title">
            笔记标题
          </label>
          <input
            id="topic-title"
            className="title-input"
            value={draft.title}
            onChange={(e) =>
              change({
                title: composingTitle.current
                  ? e.target.value
                  : limitTitle(e.target.value),
              })
            }
            onCompositionStart={() => {
              composingTitle.current = true;
            }}
            onCompositionEnd={(e) => {
              composingTitle.current = false;
              change({ title: limitTitle(e.currentTarget.value) });
            }}
            aria-describedby="title-count"
            aria-invalid={titleCount > TITLE_LIMIT}
            placeholder="给你的话题起一个清楚的标题"
          />
          <span
            id="title-count"
            className={`field-count ${titleCount > TITLE_LIMIT ? "title-limit-error" : ""}`}
          >
            {titleCount} / {TITLE_LIMIT}
            {titleCount > TITLE_LIMIT
              ? " · 原草稿超过 20 字，请缩短后发布"
              : ""}
          </span>
          <div className="editor-tabs">
            <button
              type="button"
              className={!preview ? "active" : ""}
              onClick={() => setPreview(false)}
            >
              <Pencil size={14} />
              编辑正文
            </button>
            <button
              type="button"
              className={preview ? "active" : ""}
              onClick={() => setPreview(true)}
            >
              <Eye size={14} />
              预览
            </button>
            <small>文字 · 图片 · 视频 · 附件</small>
          </div>
          {preview ? (
            <div className="compose-preview">
              <h2>{draft.title || "还没有标题"}</h2>
              <div className="post-body">
                {draft.body ||
                  (!draft.attachments?.length ? "正文预览会显示在这里。" : "")}
              </div>
              <Attachments items={draft.attachments} />
            </div>
          ) : (
            <textarea
              className="body-input"
              aria-label="笔记正文"
              value={draft.body}
              onChange={(e) => change({ body: e.target.value })}
              maxLength={10000}
              placeholder="慢慢写，大家在听。"
            />
          )}
          <UploadPicker
            items={draft.attachments}
            onAdd={(files) =>
              update((s) => ({
                ...s,
                draft: {
                  ...s.draft,
                  attachments: [...(s.draft.attachments ?? []), ...files],
                },
              }))
            }
            onRemove={(id) =>
              update((s) => ({
                ...s,
                draft: {
                  ...s.draft,
                  attachments: s.draft.attachments?.filter(
                    (file) => file.id !== id,
                  ),
                },
              }))
            }
            onBusy={setUploading}
            disabled={!state.loggedIn}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="editor-footer">
            <span>{draft.body.length} / 10000 · 友善交流，保护隐私</span>
            {state.loggedIn ? (
              <div className="compose-submit">
                <button
                  type="button"
                  className="secondary"
                  onClick={exitCompose}
                >
                  保存草稿并返回
                </button>
                <button
                  className="primary"
                  disabled={uploading || titleCount > TITLE_LIMIT}
                >
                  <Send size={15} />
                  发布笔记
                </button>
              </div>
            ) : (
              <button type="button" className="primary" onClick={login}>
                演示登录后发布
              </button>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
function LoginRequired() {
  const { login } = useForum();
  return (
    <section className="content-panel">
      <Empty
        title="你的校园故事，从这里开始"
        description="登录演示账号，查看消息与个人记录。"
        action={
          <button className="primary" onClick={login}>
            演示登录
            <ArrowUpRight size={15} />
          </button>
        }
      />
    </section>
  );
}
export function Messages() {
  const { state, update } = useForum();
  if (!state.loggedIn) return <LoginRequired />;
  return (
    <section className="content-panel messages-panel">
      <ConversationList />
      <div className="page-heading messages-heading">
        <div>
          <p className="eyebrow">YOU HAVE A LITTLE MAIL</p>
          <h1>消息</h1>
          <p>每一次回应，都值得被看见。</p>
        </div>
        <button
          className="text-button"
          disabled={unreadMessageCount(state) === 0}
          onClick={() => update(markAllMessagesRead)}
        >
          <Check size={15} />
          全部已读
        </button>
      </div>
      <p className="notification-demo">
        以下为示例通知，不接收其他用户的真实消息。
      </p>
      {state.notices.map((n) => {
        const topic = state.topics.find((t) => t.id === n.topicId);
        const who =
          topic && n.actorId ? identity(state, topic, n.actorId) : null;
        return (
          <Link
            className={`notice-row ${n.read ? "" : "unread"}`}
            key={n.id}
            to={
              topic
                ? `/topic/${topic.id}${n.replyId ? `#${n.replyId}` : ""}`
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
              {n.kind === "reply" ? (
                <MessageCircle size={20} />
              ) : (
                <Bell size={20} />
              )}
            </span>
            <div>
              <strong>
                {n.kind === "reply"
                  ? `${who?.name ?? "校园同学"} 回复了你的主题`
                  : "欢迎来到 SustLink 校园社区"}
              </strong>
              <p>{topic?.title ?? "原主题已不可用"}</p>
              <small>{relativeTime(n.createdAt)} · 示例通知</small>
            </div>
            {!n.read && <i className="unread-dot" />}
            <ArrowUpRight size={15} />
          </Link>
        );
      })}
    </section>
  );
}
export function Profile() {
  const { state, update, toast } = useForum();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "topics";
  const me = state.users.find((u) => u.id === ME)!;
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(me.name),
    [bio, setBio] = useState(me.bio),
    [error, setError] = useState("");
  if (!state.loggedIn) return <LoginRequired />;
  const mine = state.topics.filter((t) => t.authorId === ME);
  const saved = state.topics.filter((t) => state.saves.includes(t.id));
  const liked = state.topics.filter(
    (t) => t.boardId !== "market" && state.likes.includes(t.id),
  );
  const myReplies = state.replies
    .filter((r) => r.authorId === ME)
    .sort((a, b) => b.createdAt - a.createdAt);
  const selected = tab === "saves" ? saved : tab === "likes" ? liked : mine;
  const total = tab === "replies" ? myReplies.length : selected.length;
  const page = Math.min(
    Math.max(1, Math.floor(Number(params.get("page")) || 1)),
    Math.max(1, Math.ceil(total / 20)),
  );
  function save(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("昵称不能为空");
      return;
    }
    update((s) => ({
      ...s,
      users: s.users.map((u) =>
        u.id === ME ? { ...u, name: name.trim(), bio: bio.trim() } : u,
      ),
    }));
    setEditing(false);
    toast("个人资料已保存");
  }
  return (
    <section className="content-panel">
      <div className="profile-cover">
        <img src={campusUrl} alt="" />
      </div>
      <div className="profile-intro">
        <AvatarPicker
          onSaved={(id) => {
            update((s) => ({
              ...s,
              users: s.users.map((user) =>
                user.id === ME ? { ...user, avatarId: id } : user,
              ),
            }));
            toast("头像已更新");
          }}
        >
          <Avatar
            name={me.name}
            color={me.color}
            avatarId={me.avatarId}
            large
          />
        </AvatarPicker>
        <div>
          <h1>{me.name}</h1>
          <p>陕西科技大学 · 演示账号</p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setEditing(!editing);
            setName(me.name);
            setBio(me.bio);
            setError("");
          }}
        >
          <Pencil size={14} />
          {editing ? "取消编辑" : "编辑资料"}
        </button>
      </div>
      {editing ? (
        <form className="profile-form" onSubmit={save}>
          <label>
            昵称
            <input
              value={name}
              maxLength={20}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
          </label>
          <label>
            个人简介
            <textarea
              value={bio}
              maxLength={160}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary">保存资料</button>
        </form>
      ) : (
        <p className="profile-bio">{me.bio || "还没有写下个人简介。"}</p>
      )}
      <div className="profile-stats">
        <span>
          <strong>{mine.length}</strong>发布
        </span>
        <span>
          <strong>{myReplies.length}</strong>回复
        </span>
        <span>
          <strong>{liked.length}</strong>喜欢
        </span>
        <span>
          <strong>{saved.length}</strong>收藏
        </span>
      </div>
      <div className="list-toolbar">
        <div className="list-tabs">
          {[
            ["topics", "笔记"],
            ["replies", "回复"],
            ["likes", "喜欢"],
            ["saves", "收藏"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setParams({ tab: id })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {total > 0 ? (
        <>
          {tab === "replies" ? (
            <div className="reply-history">
              {myReplies.slice((page - 1) * 20, page * 20).map((reply) => {
                const topic = state.topics.find((t) => t.id === reply.topicId)!;
                const who = identity(state, topic, reply.authorId);
                const floor = replyFloor(state, reply);
                return (
                  <article
                    key={reply.id}
                    className="reply-history-item content-hit-area"
                  >
                    <TopicLink
                      className="content-hit-link"
                      to={`/topic/${topic.id}#${reply.id}`}
                    >
                      {topic.title}
                      <ArrowUpRight size={15} />
                    </TopicLink>
                    <p>
                      {reply.body ||
                        `分享了 ${reply.attachments?.length ?? 0} 个文件`}
                    </p>
                    <small className="reply-history-meta">
                      <AuthorName name={who.name} />
                      <span>#{floor}</span>
                    </small>
                  </article>
                );
              })}
            </div>
          ) : (
            <TopicList topics={selected.slice((page - 1) * 20, page * 20)} />
          )}
          <PageNav
            page={page}
            total={total}
            onChange={(p) => setParams({ tab, page: String(p) })}
          />
        </>
      ) : (
        <Empty
          title={
            tab === "saves"
              ? "还没有收藏的笔记"
              : tab === "likes"
                ? "还没有喜欢的笔记"
                : tab === "replies"
                  ? "还没有参与讨论"
                  : "还没有发布笔记"
          }
          description="去校园里逛逛，找到你的第一个话题。"
          action={
            <Link className="secondary" to="/forum">
              浏览讨论
              <ArrowUpRight size={14} />
            </Link>
          }
        />
      )}
    </section>
  );
}
export function NotFound() {
  return (
    <section className="content-panel">
      <Empty
        title="这个话题好像走丢了"
        description="笔记可能已删除，或链接不正确。回到社区看看新的讨论吧。"
        action={
          <Link className="primary" to="/forum">
            返回论坛
            <ArrowUpRight size={15} />
          </Link>
        }
      />
    </section>
  );
}
