export function scheduleNextTick(task: () => void): void {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task);
    return;
  }

  void Promise.resolve().then(task);
}

export function createDeferredErrorHandler<TError>(
  handler: (error: TError) => void,
): (error: TError) => void {
  return (error) => {
    scheduleNextTick(() => {
      handler(error);
    });
  };
}
