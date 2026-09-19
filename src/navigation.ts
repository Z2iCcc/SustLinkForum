import { useEffect, useLayoutEffect, useRef } from "react";
import {
  useLocation,
  useNavigate,
  useNavigationType,
  type Location,
} from "react-router-dom";
import { boards } from "./seed";
import type { Topic } from "./types";
type Origin = { path: string; key: string; y: number; index: number };
export function profileOriginFrom(location: Location): Origin | undefined {
  const origin = location.state?.profileOrigin as Origin | undefined;
  return origin &&
    /^\/profile([?#].*)?$/.test(origin.path) &&
    Number.isFinite(origin.y)
    ? origin
    : undefined;
}
export function useTopicExit(boardId?: string) {
  const location = useLocation(),
    navigate = useNavigate();
  const profileOrigin = profileOriginFrom(location);
  const origin = profileOrigin ?? listOriginFrom(location);
  function exit() {
    if (!origin) {
      navigate(`/board/${boardId}`, { replace: true });
      return;
    }
    positions.set(origin.key, origin.y);
    if (window.history.state?.idx === origin.index + 1) navigate(-1);
    else
      navigate(origin.path, {
        replace: true,
        state: { restoreScroll: origin.y },
      });
  }
  return {
    exit,
    fromProfile: !!profileOrigin,
    hasOrigin: !!origin,
    sourceName: profileOrigin
      ? "个人主页"
      : origin
        ? composeSourceName(origin.path)
        : "",
  };
}
export function listOriginFrom(location: Location): Origin | undefined {
  const origin = location.state?.listOrigin as Origin | undefined;
  return origin &&
    /^\/(forum|board\/[^/?#]+|search)([?#].*)?$/.test(origin.path) &&
    Number.isFinite(origin.y)
    ? origin
    : undefined;
}
const positions = new Map<string, number>();
export function composeOrigin(location: Location): Origin {
  return {
    path: location.pathname + location.search + location.hash,
    key: location.key,
    y: window.scrollY,
    index: window.history.state?.idx ?? 0,
  };
}
export function useComposeExit() {
  const location = useLocation(),
    navigate = useNavigate();
  const candidate = location.state?.composeOrigin as Origin | undefined;
  const origin =
    candidate &&
    /^\/(forum|board\/[^/?#]+|topic\/[^/?#]+|search|profile|messages)([?#].*)?$/.test(
      candidate.path,
    )
      ? candidate
      : undefined;
  useEffect(() => {
    if (origin) positions.set(origin.key, origin.y);
  }, [origin]);
  const exit = () => {
    if (origin) {
      positions.set(origin.key, origin.y);
      if (window.history.state?.idx === origin.index + 1) {
        navigate(-1);
        return;
      }
      navigate(origin.path, {
        replace: true,
        state: { restoreScroll: origin.y },
      });
    } else navigate("/forum", { replace: true });
  };
  return { exit, sourcePath: origin?.path ?? "/forum" };
}
export function composeSourceName(path: string, topics: Topic[] = []) {
  const url = new URL(path, "https://sustlink.local");
  const board = boards.find((item) => url.pathname === `/board/${item.id}`);
  if (board) return board.name;
  if (url.pathname === "/search") return "搜索结果";
  if (url.pathname === "/messages") return "消息中心";
  if (url.pathname === "/profile")
    return url.searchParams.get("tab") === "saves"
      ? "收藏"
      : url.searchParams.get("tab") === "replies"
        ? "回复"
        : "个人中心";
  if (url.pathname.startsWith("/topic/"))
    return (
      topics.find((topic) => url.pathname === `/topic/${topic.id}`)?.title ??
      "主题详情"
    );
  return "论坛首页";
}
export function RouteEffects() {
  const location = useLocation(),
    action = useNavigationType();
  const currentKey = useRef(location.key);
  const previousLocation = useRef(location);
  useEffect(() => {
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    const remember = () => positions.set(currentKey.current, scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => {
      history.scrollRestoration = previous;
      window.removeEventListener("scroll", remember);
    };
  }, []);
  useLayoutEffect(() => {
    const previous = previousLocation.current;
    const changedAnchor =
      previous.pathname === location.pathname &&
      previous.search === location.search &&
      previous.hash !== location.hash &&
      !!location.hash;
    previousLocation.current = location;
    currentKey.current = location.key;
    if (location.pathname !== "/") document.title = "SustLink · 科大校园社区";
    const frame = requestAnimationFrame(() => {
      const restore =
        (action === "POP" ? positions.get(location.key) : undefined) ??
        location.state?.restoreScroll;
      if (typeof restore === "number" && !changedAnchor) {
        window.scrollTo(0, restore);
        return;
      }
      if (location.hash) {
        let id = location.hash.slice(1);
        try {
          id = decodeURIComponent(id);
        } catch {}
        document.getElementById(id)?.scrollIntoView({ block: "center" });
      } else window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.pathname, location.hash, location.state, action]);
  return null;
}
