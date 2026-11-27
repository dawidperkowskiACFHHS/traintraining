import type { State, Event } from './types';
const listeners = new WeakMap<State, Set<(event: Event) => void>>();
export function onGameEvent(state: State, listener: (event: Event) => void) {
  let subscriptions = listeners.get(state);
  if (!subscriptions) {
    subscriptions = new Set();
    listeners.set(state, subscriptions);
  }
  subscriptions.add(listener);
  return () => subscriptions.delete(listener);
}
export function publishGameEvent(state: State, event: Event) {
  for (const listener of listeners.get(state) ?? []) listener(event);
}
