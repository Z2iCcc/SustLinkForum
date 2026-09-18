import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { boards } from "./seed";
import { categoriesFor, categoryName, UNCATEGORIZED } from "./categories";

export function CategoryButton({
  open,
  onClick,
  board,
  category,
  panelId,
  scoped = false,
}: {
  open: boolean;
  onClick: () => void;
  board?: string;
  category?: string;
  panelId: string;
  scoped?: boolean;
}) {
  return (
    <div className="category-tools">
      <button
        type="button"
        className={`category-trigger ${category || (!scoped && board) ? "is-filtered" : ""}`}
        onClick={onClick}
        aria-label="分类筛选"
        aria-expanded={open}
        aria-controls={panelId}
        title="分类"
      >
        <SlidersHorizontal size={14} />
        <span>分类</span>
        <ChevronDown size={12} className={open ? "is-open" : ""} />
      </button>
    </div>
  );
}
export function CategoryPanel({
  id,
  open,
  board,
  category,
  fixedBoard = false,
  onChange,
}: {
  id: string;
  open: boolean;
  board: string;
  category: string;
  fixedBoard?: boolean;
  onChange: (board: string, category: string) => void;
}) {
  const options = categoriesFor(board);
  const summary = [
    !fixedBoard && board
      ? (boards.find((b) => b.id === board)?.name ?? "板块已不可用")
      : "",
    category === UNCATEGORIZED
      ? "未分类"
      : category
        ? (categoryName(board, category) ?? "分类已不可用")
        : "",
  ]
    .filter(Boolean)
    .join(" / ");
  return (
    <>
      <div
        id={id}
        hidden={!open}
        className="category-panel"
        role="region"
        aria-label="分类筛选选项"
      >
        {!fixedBoard && (
          <div className="category-filter-row">
            <span>板块</span>
            <div className="category-options">
              <button
                type="button"
                aria-pressed={!board}
                onClick={() => onChange("", "")}
              >
                全部板块
              </button>
              {boards.map((b) => (
                <button
                  type="button"
                  key={b.id}
                  aria-pressed={board === b.id}
                  onClick={() => onChange(b.id, "")}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {board && (
          <div className="category-filter-row">
            <span>分类</span>
            <div className="category-options">
              <button
                type="button"
                aria-pressed={!category}
                onClick={() => onChange(board, "")}
              >
                全部
              </button>
              {options.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  aria-pressed={category === c.id}
                  onClick={() => onChange(board, c.id)}
                >
                  {c.name}
                </button>
              ))}
              {!!options.length && (
                <button
                  type="button"
                  aria-pressed={category === UNCATEGORIZED}
                  onClick={() => onChange(board, UNCATEGORIZED)}
                >
                  未分类
                </button>
              )}
              {!options.length && <small>本板块暂不细分</small>}
            </div>
          </div>
        )}
      </div>
      {!open && summary && (
        <div className="category-summary">
          <span>当前筛选：{summary}</span>
          <button
            type="button"
            aria-label="清除分类筛选"
            title="清除分类筛选"
            onClick={() => {
              onChange(fixedBoard ? board : "", "");
              document
                .querySelector<HTMLButtonElement>(`[aria-controls="${id}"]`)
                ?.focus();
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  );
}
