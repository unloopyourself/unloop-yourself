type Handler<T> = (payload: T) => void;

/**
 * Minimal typed 1→N event emitter (ADR-005). No third-party bus.
 */
export class TypedEventEmitter<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<
    keyof TEvents & string,
    Set<Handler<TEvents[keyof TEvents & string]>>
  >();

  on<K extends keyof TEvents & string>(event: K, handler: Handler<TEvents[K]>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler<TEvents[keyof TEvents & string]>);
    return () => {
      set?.delete(handler as Handler<TEvents[keyof TEvents & string]>);
    };
  }

  emit<K extends keyof TEvents & string>(event: K, payload: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      (handler as Handler<TEvents[K]>)(payload);
    }
  }

  listenerCount<K extends keyof TEvents & string>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
