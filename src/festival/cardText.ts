/** Wrap without squeezing text. Segment graphemes so accents and emoji stay intact. */
export function cardTextLines(text: string, measure: (text: string) => number, width: number, maxLines: number): string[] {
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(String(text).replace(/\s+/gu, ' ').trim())].map(part => part.segment);
  const lines: string[] = [];
  while (segments.length && lines.length < maxLines) {
    let count = 0;
    while (count < segments.length && measure(segments.slice(0, count + 1).join('')) <= width) count++;
    // A single oversized grapheme is omitted rather than stretched or clipped.
    if (!count) { lines.push(measure('…') <= width ? '…' : ''); break; }
    if (count < segments.length && lines.length === maxLines - 1) {
      while (count && measure(segments.slice(0, count).join('').trimEnd() + '…') > width) count--;
      lines.push(segments.slice(0, count).join('').trimEnd() + '…'); break;
    }
    if (count < segments.length) {
      const space = segments.slice(0, count + 1).lastIndexOf(' ');
      if (space > 0) count = space;
    }
    lines.push(segments.splice(0, count).join('').trimEnd());
    while (segments[0] === ' ') segments.shift();
  }
  return lines;
}
