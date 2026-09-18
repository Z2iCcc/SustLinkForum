import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ReplySort } from "./types";

const options: { value: ReplySort; label: string }[] = [
  { value: "oldest", label: "时间正序" },
  { value: "newest", label: "时间倒序" },
  { value: "likes", label: "点赞最多" },
];

export function ReplySortSelect({
  value,
  onChange,
}: {
  value: ReplySort;
  onChange: (value: ReplySort) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [active, setActive] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  function expand() {
    setActive(selected);
    setOpen(true);
  }
  function choose(index: number) {
    setOpen(false);
    onChange(options[index].value);
  }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const height = menu.current!.scrollHeight + 8;
      const below = window.innerHeight - rect.bottom - 12;
      const aboveSpace = rect.top - 88;
      setAbove(below < height && aboveSpace > below);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div className="reply-sort-label">
      <span id={`${id}-label`}>排序</span>
      <div
        ref={root}
        className="reply-sort-select"
        data-placement={open && above ? "top" : "bottom"}
      >
        <button
          ref={trigger}
          type="button"
          role="combobox"
          className="reply-sort-trigger"
          aria-label="回复排序"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open ? `${id}-option-${active}` : undefined}
          onClick={() => (open ? setOpen(false) : expand())}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              e.preventDefault();
              return;
            }
            if (e.key === "Tab") {
              if (open) choose(active);
              return;
            }
            if (
              ["Enter", " ", "ArrowDown", "ArrowUp", "Home", "End"].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              if (!open) {
                expand();
                if (e.key === "Home") setActive(0);
                if (e.key === "End") setActive(options.length - 1);
              } else if (e.key === "Enter" || e.key === " ") choose(active);
              else if (e.key === "Home") setActive(0);
              else if (e.key === "End") setActive(options.length - 1);
              else
                setActive((index) =>
                  Math.max(
                    0,
                    Math.min(
                      options.length - 1,
                      index + (e.key === "ArrowDown" ? 1 : -1),
                    ),
                  ),
                );
            }
          }}
        >
          {options[selected].label}
          <ChevronDown size={14} aria-hidden="true" />
        </button>
        {open && (
          <div
            ref={menu}
            id={`${id}-options`}
            role="listbox"
            aria-label="回复排序选项"
            className="reply-sort-menu"
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={value === option.value}
                className={active === index ? "is-highlighted" : ""}
                onPointerDown={(e) => e.preventDefault()}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
              >
                {option.label}
                {value === option.value && (
                  <Check size={13} aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
