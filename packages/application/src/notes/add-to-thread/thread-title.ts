const MAX_TITLE_LENGTH = 60;

/** Block markers a Markdown line can open with: headings, quotes, list items, task boxes. */
const LEADING_MARKERS = /^(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+|\[[ xX]\]\s+)/;

/**
 * A Thread title suggested by a Note: its first line with text, without the
 * Markdown markers that open it, cut at a word near the length a title reads
 * at. The person edits it before saving.
 */
export function suggestThreadTitle(body: string): string {
  const line =
    body
      .split("\n")
      .map((candidate) => {
        let text = candidate.trim();
        for (
          let stripped = text.replace(LEADING_MARKERS, "");
          stripped !== text;
          stripped = text.replace(LEADING_MARKERS, "")
        ) {
          text = stripped.trim();
        }
        return text;
      })
      .find((candidate) => candidate !== "") ?? "";

  if (line.length <= MAX_TITLE_LENGTH) return line;

  const cut = line.slice(0, MAX_TITLE_LENGTH + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const shortened =
    lastSpace > MAX_TITLE_LENGTH / 2
      ? cut.slice(0, lastSpace)
      : line.slice(0, MAX_TITLE_LENGTH);
  return shortened.replace(/[\s,;:.–—-]+$/, "");
}
