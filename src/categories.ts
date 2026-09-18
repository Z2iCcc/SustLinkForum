import type { BoardId } from "./types.ts";
export const categories: Record<BoardId, { id: string; name: string }[]> = {
  notice: [
    { id: "notices", name: "校园通知" },
    { id: "lectures", name: "讲座会议" },
    { id: "services", name: "设施服务" },
  ],
  life: [
    { id: "sports", name: "运动健身" },
    { id: "games", name: "游戏娱乐" },
    { id: "food", name: "美食探店" },
    { id: "daily", name: "校园日常" },
    { id: "help", name: "生活求助" },
  ],
  study: [
    { id: "courses", name: "课程答疑" },
    { id: "resources", name: "资料分享" },
    { id: "exams", name: "考试升学" },
    { id: "experience", name: "经验交流" },
  ],
  clubs: [
    { id: "recruitment", name: "招新报名" },
    { id: "upcoming", name: "活动预告" },
    { id: "recaps", name: "活动回顾" },
    { id: "discussion", name: "社团交流" },
  ],
  market: [
    { id: "books", name: "书籍教材" },
    { id: "digital", name: "数码设备" },
    { id: "essentials", name: "生活用品" },
    { id: "other", name: "其他闲置" },
  ],
  lost: [
    { id: "missing", name: "寻物启事" },
    { id: "found", name: "拾物招领" },
  ],
  tree: [],
};
export const UNCATEGORIZED = "uncategorized";
export function categoriesFor(board?: string) {
  return categories[board as BoardId] ?? [];
}
export function categoryName(board?: string, id?: string) {
  return categoriesFor(board).find((c) => c.id === id)?.name;
}
export function validCategory(board: string, id?: string) {
  return !id || !!categoryName(board, id);
}
