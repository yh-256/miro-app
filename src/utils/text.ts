/**
 * HTMLの簡易除去と改行正規化
 */
export function toPlainText(htmlOrText: string): string {
  if (!htmlOrText) return "";
  // <br> を改行に、残りのタグを除去
  const withBreaks = htmlOrText
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*div\s*>/gi, "\n")
    .replace(/<\s*\/div\s*>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, "");
  // 連続スペース/改行の整理
  return withoutTags
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
