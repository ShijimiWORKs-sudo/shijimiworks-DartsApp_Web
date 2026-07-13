export class CountUpRedoSession {
  private readonly dartIds: string[] = [];

  get canRedo(): boolean {
    return this.dartIds.length > 0;
  }

  push(dartId: string): void {
    this.dartIds.push(dartId);
  }

  pop(): string | null {
    return this.dartIds.pop() ?? null;
  }

  clear(): void {
    this.dartIds.length = 0;
  }
}
