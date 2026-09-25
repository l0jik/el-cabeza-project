/* A tiny event bus shared by Lluvia's audio and scene effects: the score
   announces a thunderclap, the scene lights the sky for it. Kept in its
   own module so neither side has to import the other. */

const handlers = new Map();

export const bus = {
  on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => handlers.get(event).delete(fn);
  },
  emit(event, ...args) {
    const set = handlers.get(event);
    if (!set) return;
    set.forEach((fn) => {
      try { fn(...args); } catch (e) { /* one listener's problem, not the others' */ }
    });
  },
};
