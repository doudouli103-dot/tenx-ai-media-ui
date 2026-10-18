/** Indices whose visual inputs change when a shot is regenerated. */
export function continuationChain(shots: { continue_previous: boolean }[], index: number): number[] {
  if (!Number.isInteger(index) || index < 0 || index >= shots.length) return [];
  const indices = [index];
  for (let next = index + 1; next < shots.length && shots[next].continue_previous; next++) indices.push(next);
  return indices;
}
