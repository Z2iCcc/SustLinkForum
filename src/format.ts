export const TITLE_LIMIT = 20;
const titleSegments = new Intl.Segmenter("zh-CN", { granularity: "grapheme" });
export function titleLength(value: string) {
  return Array.from(titleSegments.segment(value)).length;
}
export function limitTitle(value: string) {
  return Array.from(titleSegments.segment(value))
    .slice(0, TITLE_LIMIT)
    .map((part) => part.segment)
    .join("");
}
export function formatCount(value: number) {
  const count = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
  if (count < 10000) return String(count);
  const unit = count >= 100000000 ? 100000000 : 10000;
  return (
    (count / unit).toFixed(1).replace(/\.0$/, "") +
    (unit === 10000 ? "万" : "亿")
  );
}
