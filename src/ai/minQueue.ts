// A priority queue for the AI's distance maps.

/** A small binary heap of [priority, tile], lowest priority first; ties by tile index. */
export class MinQueue {
  private readonly items: [number, number][] = [];

  push(priority: number, value: number): void {
    const items = this.items;
    items.push([priority, value]);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = items[parent];
      const c = items[i];
      if (!p || !c || !before(c, p)) break;
      items[parent] = c;
      items[i] = p;
      i = parent;
    }
  }

  pop(): [number, number] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (!top || !last || items.length === 0) return top;
    items[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      const li = items[l];
      const ri = items[r];
      const si = () => items[smallest] ?? last;
      if (li && before(li, si())) smallest = l;
      if (ri && before(ri, si())) smallest = r;
      if (smallest === i) return top;
      const a = items[i];
      const b = items[smallest];
      if (!a || !b) return top;
      items[i] = b;
      items[smallest] = a;
      i = smallest;
    }
  }
}

const before = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
