// A shape as the grid cells whose centres lie inside it: a cheap stand-in for a shape when all that
// matters is whether one shape leaves a sizeable part of another uncovered (the baseline's gap
// filling in scripts/build-data.ts). Exact geometry is used only where the cells find something.

import type { MultiPolygon } from './geometry.ts';

/** Cell size in degrees: about 11 km north to south, so a gap 10 km wide holds cell centres. */
export const CELL_DEGREES = 0.1;

/**
 * The cells whose centres lie inside the shape (holes and all: a centre counts when it's inside an
 * odd number of rings), as numbers row by row from the south-west corner of the world.
 */
export function shapeCellSet(shape: MultiPolygon, size = CELL_DEGREES): Set<number> {
  const cells = new Set<number>();
  const columns = Math.round(360 / size);
  const rings = shape.flat();
  let south = Infinity;
  let north = -Infinity;
  for (const ring of rings) for (const [, y] of ring) [south, north] = [Math.min(south, y), Math.max(north, y)];
  if (south > north) return cells;
  // Each row of cell centres: where the rings' edges cross it, then fill between pairs of crossings.
  for (let row = Math.ceil((south + 90) / size - 0.5); (row + 0.5) * size - 90 <= north; row++) {
    const y = (row + 0.5) * size - 90;
    const crossings: number[] = [];
    for (const ring of rings) {
      for (let i = 1; i < ring.length; i++) {
        const [x1, y1] = ring[i - 1];
        const [x2, y2] = ring[i];
        if (y1 <= y !== y2 <= y) crossings.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const first = Math.ceil((crossings[k] + 180) / size - 0.5);
      const last = Math.floor((crossings[k + 1] + 180) / size - 0.5);
      for (let column = first; column <= last; column++) cells.add(row * columns + column);
    }
  }
  return cells;
}

/**
 * How many of one shape's cells are left uncovered while other shapes come and go: each cover is
 * counted once when it's added and once when it's removed, not again for every stretch of days.
 */
export class CoverCount {
  private readonly index = new Map<number, number>();
  private readonly counts: Uint16Array;
  /** Cells no cover now has. */
  uncovered: number;

  constructor(cells: ReadonlySet<number>) {
    for (const cell of cells) this.index.set(cell, this.index.size);
    this.counts = new Uint16Array(cells.size);
    this.uncovered = cells.size;
  }

  /** Which of the shape's cells a cover has (as positions, for add and remove). */
  overlap(cover: ReadonlySet<number>): number[] {
    const found: number[] = [];
    if (cover.size < this.index.size) {
      for (const cell of cover) if (this.index.has(cell)) found.push(this.index.get(cell)!);
    } else {
      for (const [cell, position] of this.index) if (cover.has(cell)) found.push(position);
    }
    return found;
  }

  add(positions: readonly number[]): void {
    for (const p of positions) if (this.counts[p]++ === 0) this.uncovered--;
  }

  remove(positions: readonly number[]): void {
    for (const p of positions) if (--this.counts[p] === 0) this.uncovered++;
  }
}

/** How many of `cells` none of `covers` has. */
export function uncoveredCount(cells: ReadonlySet<number>, covers: readonly ReadonlySet<number>[]): number {
  let count = 0;
  for (const cell of cells) if (!covers.some((cover) => cover.has(cell))) count++;
  return count;
}
