import { flushSync } from "react-dom";
import { mainScrollElement, readingScrollY, scrollReadingTo } from "../scroll";

/** Swap compose forms without letting focus or scroll anchoring move the page. */
export function preserveComposeScroll(change: () => void) {
  const y = readingScrollY();
  const focused = document.activeElement;
  const switchingBoard =
    focused?.id === "pub-board" ||
    (focused instanceof HTMLSelectElement &&
      focused.closest(".compose-top") &&
      focused.closest("label")?.textContent?.trim().startsWith("发布到"));
  const root = mainScrollElement() ?? document.documentElement;
  const anchoring = root.style.overflowAnchor;
  root.style.overflowAnchor = "none";
  try {
    flushSync(change);
    if (switchingBoard) {
      const next =
        document.getElementById("pub-board") ??
        document.querySelector<HTMLSelectElement>(
          ".compose-top > label:first-child select",
        );
      next?.focus({ preventScroll: true });
    }
    scrollReadingTo(y);
  } finally {
    root.style.overflowAnchor = anchoring;
  }
}
