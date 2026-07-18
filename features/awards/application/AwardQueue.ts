import type { AwardEvent } from '../domain/types';

export class AwardQueue {
  private readonly playedAwardIds = new Set<string>();
  private readonly queue: AwardEvent[] = [];
  private current: AwardEvent | null = null;

  enqueue(event: AwardEvent): boolean {
    if (this.playedAwardIds.has(event.awardId)) {
      return false;
    }
    this.playedAwardIds.add(event.awardId);
    this.queue.push(event);
    this.queue.sort((a, b) => b.priority - a.priority);
    if (!this.current) {
      this.current = this.queue.shift() ?? null;
    }
    return true;
  }

  getCurrent(): AwardEvent | null {
    return this.current;
  }

  skip(): AwardEvent | null {
    this.current = this.queue.shift() ?? null;
    return this.current;
  }

  clear() {
    this.current = null;
    this.queue.length = 0;
  }

  size() {
    return this.queue.length + (this.current ? 1 : 0);
  }
}
