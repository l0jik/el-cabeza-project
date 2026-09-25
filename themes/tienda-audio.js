/* Placeholder while the store's sound is built (see the next commit). */
export const hasAudio = true;
export function createAudio() {
  const noop = () => {};
  return new Proxy({}, { get: (o, k) => (k === "then" ? undefined : noop) });
}
