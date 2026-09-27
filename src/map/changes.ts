// The change index: the sorted list of days on which anything on the map changes (a border
// starts, ends, or stops being uncertain). Between two change days the map looks identical, so
// while the timeline is dragged the map only needs updating when a change day is crossed.

/** Which stretch between change days `day` falls in: the number of change days on or before it. */
export function segmentOf(changes: readonly number[], day: number): number {
  let low = 0;
  let high = changes.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (changes[mid] <= day) low = mid + 1;
    else high = mid;
  }
  return low;
}
