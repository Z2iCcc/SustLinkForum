/** The forum owns the reading scroll on desktop; narrow layouts use the document. */
export function mainScrollElement(): HTMLElement | null {
  return window.matchMedia("(min-width: 761px)").matches
    ? document.getElementById("forum-main")
    : null;
}

export function readingScrollY() {
  return mainScrollElement()?.scrollTop ?? window.scrollY;
}

export function scrollReadingTo(top: number) {
  (mainScrollElement() ?? window).scrollTo({ top, behavior: "instant" });
}
