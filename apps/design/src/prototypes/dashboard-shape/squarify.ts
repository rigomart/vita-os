export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Lays values out as rectangles filling `rect`, each with an area in
 * proportion to its value, kept as square as the order allows. The order is
 * kept, so the first value lands top-left and the last bottom-right: time
 * still reads in one direction.
 */
export function squarify<T>(
  items: readonly { value: number; data: T }[],
  rect: Rect,
): (Rect & { data: T })[] {
  const positive = items.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (total === 0 || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const nodes = positive.map((item) => ({
    area: item.value * scale,
    data: item.data,
  }));
  const out: (Rect & { data: T })[] = [];
  let free = { ...rect };
  let row: typeof nodes = [];
  let index = 0;
  while (index < nodes.length) {
    const side = Math.min(free.w, free.h);
    const next = [...row, nodes[index]!];
    if (row.length === 0 || worst(next, side) <= worst(row, side)) {
      row = next;
      index++;
    } else {
      free = place(row, free, out);
      row = [];
    }
  }
  if (row.length > 0) place(row, free, out);
  return out;
}

function worst(row: readonly { area: number }[], side: number) {
  const sum = row.reduce((total, node) => total + node.area, 0);
  const max = Math.max(...row.map((node) => node.area));
  const min = Math.min(...row.map((node) => node.area));
  return Math.max(
    (side * side * max) / (sum * sum),
    (sum * sum) / (side * side * min),
  );
}

function place<T>(
  row: readonly { area: number; data: T }[],
  free: Rect,
  out: (Rect & { data: T })[],
): Rect {
  const sum = row.reduce((total, node) => total + node.area, 0);
  if (free.w >= free.h) {
    const w = sum / free.h;
    let y = free.y;
    for (const node of row) {
      const h = node.area / w;
      out.push({ x: free.x, y, w, h, data: node.data });
      y += h;
    }
    return { x: free.x + w, y: free.y, w: free.w - w, h: free.h };
  }
  const h = sum / free.w;
  let x = free.x;
  for (const node of row) {
    const w = node.area / h;
    out.push({ x, y: free.y, w, h, data: node.data });
    x += w;
  }
  return { x: free.x, y: free.y + h, w: free.w, h: free.h - h };
}
