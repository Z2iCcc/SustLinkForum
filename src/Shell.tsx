import { useState, useRef, type FormEvent } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Search,
  Bell,
  ArrowUpRight,
  Plus,
  LayoutGrid,
  UserRound,
  LogOut,
  Compass,
  Sprout,
  ChevronRight,
} from "lucide-react";
import { Avatar, BoardIcon, Logo } from "./components";
import { boards, ME } from "./seed";
import { useForum } from "./context";
import campusUrl from "./illustrations/campus.svg";
import { composeOrigin } from "./navigation";
import { categoryName } from "./categories";
export function Shell() {
  const { state, login, update, requireLogin } = useForum();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const me = state.users.find((u) => u.id === ME)!;
  const unread = state.notices.filter((n) => !n.read).length + (state.conversations??[]).reduce((sum,c)=>sum+c.messages.filter(m=>m.authorId!==ME&&m.createdAt>c.readAt).length,0);
  const board = boards.find((b) => location.pathname === `/board/${b.id}`);
  const detailTopic = state.topics.find(t=>location.pathname==='/topic/'+t.id);
  const isMarket = board?.id==='market' || detailTopic?.boardId==='market' || location.pathname.startsWith('/messages/chat/');
  const isChat = location.pathname.startsWith('/messages/chat/');
  function search(e: FormEvent) {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  }
  return (
    <div className={`forum-app ${isMarket?"market-shell":""}`}>
      <a className="skip-link" href="#forum-main">
        跳到主要内容
      </a>
      <header className="forum-header">
        <Logo to="/forum" />
        <span className="header-divider" />
        <Link to="/" className="campus-return">
          校园首页
          <ArrowUpRight size={13} />
        </Link>
        <form
          className="global-search"
          onSubmit={search}
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("button"))
              searchInput.current?.focus();
          }}
        >
          <Search size={17} />
          <input
            ref={searchInput}
            aria-label="搜索全站帖子"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索校园里的新鲜事…"
          />
          <button aria-label="提交全站搜索" type="submit">
            ↵
          </button>
        </form>
        <nav className="account-nav">
          <Link
            className="notification-link"
            to="/messages"
            aria-label={`消息${state.loggedIn ? `，${unread} 条未读` : ""}`}
          >
            <Bell size={19} />
            {state.loggedIn && unread > 0 && <i />}
          </Link>
          {state.loggedIn ? (
            <>
              <Link to="/profile" className="header-profile">
                <Avatar
                  name={me.name}
                  color={me.color}
                  avatarId={me.avatarId}
                />
                <span>{me.name}</span>
              </Link>
              <button
                className="icon-button logout"
                aria-label="退出演示账号"
                onClick={() => update((s) => ({ ...s, loggedIn: false }))}
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button className="primary small" onClick={login}>
              演示登录
              <ArrowUpRight size={15} />
            </button>
          )}
        </nav>
      </header>
      <div className="forum-layout">
        <aside className="left-sidebar">
          <div className="sidebar-title">你的校园，正在发生</div>
          <NavLink className="side-link" to="/forum">
            <LayoutGrid size={18} />
            全部讨论
          </NavLink>
          <NavLink className="side-link" to="/profile">
            <UserRound size={18} />
            个人主页
          </NavLink>
          <div className="sidebar-label">
            校园板块 <span>{String(boards.length).padStart(2, "0")}</span>
          </div>
          <nav aria-label="论坛板块">
            {boards.map((b) => (
              <NavLink to={`/board/${b.id}`} className="side-link" key={b.id}>
                <span style={{ color: b.color }}>
                  <BoardIcon id={b.id} />
                </span>
                {b.name}
              </NavLink>
            ))}
          </nav>
          <Link className="sidebar-campus" to="/">
            <img src={campusUrl} alt="" />
            <span>
              再逛一次校园
              <ArrowUpRight size={15} />
            </span>
          </Link>
          <div className="sidebar-foot">
            SustLink · 科大校园社区
            <br />
            交互原型 / 本浏览器保存
          </div>
        </aside>
        <main id="forum-main" className={`forum-main ${isChat ? 'chat-main' : ''}`} tabIndex={-1}>
          <Outlet />
        </main>
        <aside className="right-sidebar">
          <button
            className="primary full new-topic"
            onClick={() => {
              const params = new URLSearchParams(location.search);
              const selectedBoard = board?.id ?? detailTopic?.boardId ?? (isMarket?"market":null) ?? params.get("board") ?? "";
              const category = params.get("category") ?? "";
              const target = new URLSearchParams();
              if (boards.some((b) => b.id === selectedBoard))
                target.set("board", selectedBoard);
              if (categoryName(selectedBoard, category))
                target.set("category", category);
              if (requireLogin())
                navigate(`/new${target.size ? `?${target}` : ""}`, {
                  state:
                    location.pathname === "/new"
                      ? location.state
                      : { composeOrigin: composeOrigin(location) },
                });
            }}
          >
            <Plus size={18} />
            {isMarket ? "发布闲置" : "发布新笔记"}
          </button>
          <section className="side-panel welcome-panel">
            <p className="eyebrow">A PLACE TO BELONG</p>
            <h3>
              你好，科大同学<span>✳</span>
            </h3>
            <p>
              有趣的日常，认真的讨论。
              <br />
              总有一个话题，与你有关。
            </p>
            <div className="community-count">
              <span>
                <b>{state.topics.length}</b>个主题
              </span>
              <span>
                <b>{state.replies.length}</b>条回复
              </span>
              <small>演示社区</small>
            </div>
          </section>
          <section className="side-panel announcement-panel content-hit-area">
            <h3>
              <span className="tiny-dot" />
              社区公告
            </h3>
            <Link className="announcement content-hit-link" to="/topic/topic-7">
              欢迎来到 SustLink
              <ArrowUpRight size={14} />
            </Link>
            <p>第一次来？花一分钟认识这里，和我们一起维护友善的交流氛围。</p>
            <Link
              to="/board/notice"
              className="quiet-link content-hit-secondary"
            >
              查看公告
              <ChevronRight size={13} />
            </Link>
          </section>
          <section className="side-panel daily-prompt content-hit-area">
            <div className="prompt-icon">
              <Sprout size={22} />
            </div>
            <small>今日小话题</small>
            <h3>
              校园里哪个角落，
              <br />
              让你觉得很治愈？
            </h3>
            <Link to="/topic/topic-1" className="quiet-link content-hit-link">
              聊聊你的答案
              <ArrowUpRight size={14} />
            </Link>
          </section>
          <section className="side-panel board-intro">
            <h3>
              <Compass size={17} />
              {board ? board.name : "在这里，放心交流"}
            </h3>
            <p>
              {board
                ? board.description
                : "尊重不同的声音，分享真实的感受。请勿发布自己或他人的敏感信息。"}
            </p>
            {board?.id === "tree" && (
              <p className="anon-explainer">
                匿名为本地交互演示，浏览器存储不提供真实身份保密。
              </p>
            )}
          </section>
          <p className="right-foot">
            非学校官方网站
            <br />© 2026 SustLink · Made for campus.
          </p>
        </aside>
      </div>
    </div>
  );
}
