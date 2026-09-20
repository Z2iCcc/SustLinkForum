import type { Attachment, BoardId, Draft, ForumState } from "../types.ts";
import { titleLength } from "../format.ts";

export type PublishBoard = "market" | "clubs" | "lost";
export type PublishMode =
  "sale" | "wanted" | "event" | "recruit" | "recap" | "missing" | "found";
export interface PublishingData {
  commentPolicy?: "everyone" | "seller";
  board: PublishBoard;
  mode: PublishMode;
  category: string;
  price: string;
  budget: string;
  free: boolean;
  negotiable: boolean;
  handover: string;
  organizer: string;
  start: string;
  end: string;
  deadline: string;
  audience: string;
  registration: string;
  url: string;
  capacity: string;
  date: string;
  period: string;
  place: string;
  custody: string;
}
export const modes: Record<PublishBoard, [PublishMode, string][]> = {
  market: [
    ["sale", "闲置"],
    ["wanted", "求购"],
  ],
  clubs: [
    ["event", "活动"],
    ["recruit", "招新"],
    ["recap", "回顾"],
  ],
  lost: [
    ["missing", "丢失"],
    ["found", "拾到"],
  ],
};
export const marketCategories = [
  "教材书籍",
  "数码电子",
  "生活用品",
  "服饰配件",
  "运动器材",
  "其他",
];
export const lostCategories = [
  "校园卡 / 证件",
  "数码电子",
  "钥匙",
  "生活用品",
  "书本文具",
  "其他",
];
export const eventCategories = [
  "文体活动",
  "学术交流",
  "公益志愿",
  "兴趣体验",
  "其他活动",
];
export const periods = ["不确定", "凌晨", "上午", "中午", "下午", "晚上"];
export const isPublishBoard = (board: string): board is PublishBoard =>
  ["market", "clubs", "lost"].includes(board);
export function emptyPublishing(
  board: PublishBoard,
  mode = modes[board][0][0],
): PublishingData {
  return {
    board,
    mode,
    category:
      mode === "recruit" ? "社团招新" : mode === "recap" ? "活动回顾" : "",
    price: "",
    budget: "",
    free: false,
    negotiable: false,
    handover: "校内面交",
    organizer: "",
    start: "",
    end: "",
    deadline: "",
    audience: "",
    registration: "none",
    url: "",
    capacity: "",
    date: "",
    period: "不确定",
    place: "",
    custody: "",
  };
}
export function validPublishing(
  value: unknown,
  board?: string,
): value is PublishingData | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;
  const p = value as PublishingData;
  if (
    (p.commentPolicy !== undefined && !["everyone", "seller"].includes(p.commentPolicy)) ||
    !isPublishBoard(p.board) ||
    (board && p.board !== board) ||
    !modes[p.board].some(([m]) => m === p.mode)
  )
    return false;
  return Object.entries(emptyPublishing(p.board)).every(
    ([key, initial]) =>
      typeof p[key as keyof PublishingData] === typeof initial,
  );
}
export function publishingFor(draft: Draft): PublishingData {
  const board = draft.boardId as PublishBoard;
  if (draft.publishing && validPublishing(draft.publishing, board))
    return draft.publishing;
  const p = emptyPublishing(
    board,
    board === "lost" && draft.categoryId === "found"
      ? "found"
      : board === "clubs" && draft.categoryId === "recruitment"
        ? "recruit"
        : board === "clubs" && draft.categoryId === "recaps"
          ? "recap"
          : undefined,
  );
  if (board === "market")
    p.category =
      (
        {
          books: "教材书籍",
          digital: "数码电子",
          essentials: "生活用品",
          other: "其他",
        } as Record<string, string>
      )[draft.categoryId ?? ""] ?? "";
  return p;
}
export function legacyCategory(p: PublishingData): string | undefined {
  if (p.board === "lost") return p.mode;
  if (p.board === "clubs")
    return p.mode === "recruit"
      ? "recruitment"
      : p.mode === "recap"
        ? "recaps"
        : "upcoming";
  return (
    {
      教材书籍: "books",
      数码电子: "digital",
      生活用品: "essentials",
      服饰配件: "other",
      运动器材: "other",
      其他: "other",
    } as Record<string, string>
  )[p.category];
}
export const localMinute = (d: Date) =>
  `${String(d.getFullYear()).padStart(4, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export function validMinute(value: string) {
  const d = new Date(value);
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
    Number.isFinite(+d) &&
    localMinute(d) === value
  );
}
export function timeBounds(p: PublishingData, id: string, now = new Date()) {
  let min = "1900-01-01T00:00",
    max = id === "start" ? "9999-12-31T23:58" : "9999-12-31T23:59";
  if (id === "end" && validMinute(p.start))
    min = localMinute(new Date(+new Date(p.start) + 60000));
  if (p.mode === "event" && id === "deadline" && validMinute(p.start))
    max = p.start;
  if (p.mode === "recap")
    max = localMinute(new Date(+now - (id === "start" ? 60000 : 0)));
  return { min, max };
}
export function timeValid(
  p: PublishingData,
  id: string,
  value: string,
  now = new Date(),
) {
  if (!validMinute(value)) return false;
  if (
    (id === "end" || (id === "deadline" && p.mode === "event")) &&
    !validMinute(p.start)
  )
    return false;
  const { min, max } = timeBounds(p, id, now);
  return value >= min && value <= max;
}
export function reconcilePublishing(p: PublishingData, now = new Date()) {
  const next = { ...p },
    cleared: string[] = [];
  if (p.board === "clubs")
    for (const key of (p.mode === "recruit"
      ? ["deadline"]
      : p.mode === "recap"
        ? ["start", "end"]
        : ["start", "end", "deadline"]) as ("start" | "end" | "deadline")[]) {
      if (next[key] && !timeValid(next, key, next[key], now)) {
        next[key] = "";
        cleared.push(key);
      }
    }
  return { data: next, cleared };
}
export function publishingErrors(
  draft: Draft,
  now = new Date(),
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.publishing || !validPublishing(draft.publishing, draft.boardId))
    return { publishing: "发布信息无效，请重新选择发布类型" };
  const p = draft.publishing;
  const need = (key: string, value: string, label: string) => {
    if (!value.trim()) errors[key] = `请填写${label}`;
  };
  const choice = (
    key: string,
    value: string,
    options: string[],
    label: string,
  ) => {
    if (!options.includes(value)) errors[key] = `请选择${label}`;
  };
  need("title", draft.title, "标题");
  if (titleLength(draft.title) > 20) errors.title = "标题最多 20 字";
  need("body", draft.body, "内容");
  if (draft.body.length > 3000) errors.body = "内容最多 3000 字";
  need(
    "place",
    p.place,
    p.board === "market"
      ? "交接区域"
      : p.board === "clubs"
        ? "地点"
        : "地点线索",
  );
  if ((draft.attachments?.length ?? 0) > 9) errors.media = "最多添加 9 个文件";
  if (p.board === "market") {
    choice("category", p.category, marketCategories, "物品类型");
    choice("handover", p.handover, ["校内面交", "双方协商"], "交接方式");
    const key = p.mode === "sale" ? "price" : "budget";
    if (
      !(p.mode === "sale" && p.free) &&
      (!/^\d+(\.\d{1,2})?$/.test(p[key]) ||
        !Number.isFinite(Number(p[key])) ||
        Number(p[key]) <= 0)
    )
      errors[key] = "请填写大于 0 的金额，最多两位小数";
    if (
      p.mode === "sale" &&
      !draft.attachments?.some((a) => a.kind === "image")
    )
      errors.media = "请至少添加 1 张实物图片";
  } else if (p.board === "lost") {
    choice("category", p.category, lostCategories, "物品类型");
    choice("period", p.period, periods, "大致时段");
    if (
      !validMinute(p.date + "T12:00") ||
      p.date < "1900-01-01" ||
      p.date > localMinute(now).slice(0, 10)
    )
      errors.date = "请选择不晚于今天的日期";
  } else {
    need("organizer", p.organizer, "主办社团");
    choice(
      "category",
      p.category,
      p.mode === "recruit"
        ? ["社团招新"]
        : p.mode === "recap"
          ? ["活动回顾"]
          : eventCategories,
      "内容类别",
    );
    for (const id of (p.mode === "recruit"
      ? ["deadline"]
      : ["start", "end"]) as ("start" | "end" | "deadline")[])
      if (!timeValid(p, id, p[id], now))
        errors[id] =
          id === "end"
            ? "结束时间必须晚于开始时间"
            : id === "deadline"
              ? "请选择招新截止时间"
              : "请选择有效的开始时间";
    if (p.mode !== "recap") {
      choice("registration", p.registration, ["none", "link"], "报名方式");
      if (p.registration === "link") {
        try {
          const url = new URL(p.url);
          if (!["http:", "https:"].includes(url.protocol) || !url.hostname)
            throw new Error();
        } catch {
          errors.url = "请填写有效的 http 或 https 报名链接";
        }
        if (p.mode === "event" && !timeValid(p, "deadline", p.deadline, now))
          errors.deadline = "报名截止不能晚于开始时间";
      }
    }
    if (
      p.mode === "event" &&
      p.capacity &&
      (!/^\d+$/.test(p.capacity) ||
        !Number.isSafeInteger(Number(p.capacity)) ||
        Number(p.capacity) < 1)
    )
      errors.capacity = "人数上限须为正整数";
  }
  return errors;
}
export const draftKey = (draft: Draft) =>
  `${draft.boardId}:${draft.publishing?.mode ?? "default"}`;
export function attachToPublishingDraft(
  state: ForumState,
  source: Draft,
  files: Attachment[],
): ForumState {
  const key = draftKey(source);
  const append = (draft: Draft) => ({
    ...draft,
    attachments: [...(draft.attachments ?? []), ...files],
  });
  if (draftKey(state.draft) === key)
    return { ...state, draft: append(state.draft) };
  return {
    ...state,
    publishDrafts: {
      ...state.publishDrafts,
      [key]: append(state.publishDrafts?.[key] ?? source),
    },
  };
}
export function switchPublishingDraft(
  state: ForumState,
  board: BoardId,
  mode?: PublishMode,
): ForumState {
  const old = state.draft;
  const current = isPublishBoard(old.boardId)
    ? { ...old, publishing: publishingFor(old) }
    : old;
  const cache = { ...state.publishDrafts, [draftKey(current)]: current };
  const p = isPublishBoard(board) ? emptyPublishing(board, mode) : undefined;
  const key = `${board}:${p?.mode ?? "default"}`;
  const draft = cache[key] ?? {
    boardId: board,
    title: "",
    body: "",
    attachments: [],
    ...(p ? { publishing: p, categoryId: legacyCategory(p) } : {}),
  };
  return { ...state, draft, publishDrafts: cache };
}
