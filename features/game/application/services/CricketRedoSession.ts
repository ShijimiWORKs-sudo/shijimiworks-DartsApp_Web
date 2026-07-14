export class CricketRedoSession {
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

export function clearCricketRedoSession(
  session: CricketRedoSession,
  setCanRedo: (canRedo: boolean) => void,
) {
  session.clear();
  setCanRedo(false);
}
