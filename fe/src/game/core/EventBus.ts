export type Unsubscribe = () => void

export class EventBus<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<(payload: unknown) => void>>()

  on<K extends keyof EventMap>(event: K, handler: (payload: EventMap[K]) => void): Unsubscribe {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }

    set.add(handler as (payload: unknown) => void)

    return () => {
      const current = this.listeners.get(event)
      if (!current) return
      current.delete(handler as (payload: unknown) => void)
      if (current.size === 0) this.listeners.delete(event)
    }
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]) {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) return
    for (const handler of set) handler(payload)
  }
}
