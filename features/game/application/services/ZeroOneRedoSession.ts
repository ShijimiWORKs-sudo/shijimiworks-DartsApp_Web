export class ZeroOneRedoSession {
  private readonly stack: string[] = [];

  get canRedo() {
    return this.stack.length > 0;
  }

  push(dartId: string) {
    this.stack.push(dartId);
  }

  pop() {
    return this.stack.pop() ?? null;
  }

  clear() {
    this.stack.length = 0;
  }
}

export function clearZeroOneRedoSession(
  session: ZeroOneRedoSession,
  setCanRedo: (canRedo: boolean) => void,
) {
  session.clear();
  setCanRedo(false);
}
