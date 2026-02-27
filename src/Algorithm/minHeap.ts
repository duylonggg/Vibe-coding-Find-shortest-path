/**
 * Binary min-heap keyed by numeric priority.
 * Replaces the O(n log n) array.sort() pattern used as a priority queue
 * in all search algorithms, giving O(log n) push/pop instead.
 */
export class MinHeap {
  private heap: { key: number; id: string }[] = [];

  get size(): number {
    return this.heap.length;
  }

  push(id: string, key: number): void {
    this.heap.push({ key, id });
    this._bubbleUp(this.heap.length - 1);
  }

  /** Remove and return the entry with the smallest key. */
  pop(): { id: string; key: number } | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  peek(): { id: string; key: number } | undefined {
    return this.heap[0];
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].key <= this.heap[i].key) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (left < n && this.heap[left].key < this.heap[smallest].key) smallest = left;
      if (right < n && this.heap[right].key < this.heap[smallest].key) smallest = right;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}
