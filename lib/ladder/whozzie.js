// 사다리 생성·경로 추적·보드 좌표 — zeikar/whozzie (d8217df) features/ladder/{ladder,geometry}.ts, lib/{random,sketch}.ts
// Copyright (c) 2025 zeikar. MIT License — 전문은 lib/ladder/LICENSE.
// TypeScript 타입만 제거한 JS 이식. 변경: 난수는 항상 주입(rng) — 서버 seed로 모든 폰이 같은 사다리를 그리게.
// (원본 dealRound는 crypto 난수라 가져오지 않음. 같은 방식의 seed 버전은 lib/ladder/plan.js)

/**
 * The ladder game (Amidakuji). Players stand on top of vertical lines; rungs join
 * neighbouring lines, and whoever walks down a line crosses every rung they meet.
 * Geometry is in grid units: x is the line (column), y runs from 0 at the top
 * to `rows` at the bottom, and rung row r sits at y = r + 0.5.
 */

/**
 * Chance of an extra rung at each free spot, on top of the one every pair gets.
 * It thins out as rows are added, so every size ends up with about 3–4 rungs per pair.
 */
const rungChance = rows => Math.min(0.55, 5 / rows);

export const rowsFor = columns => Math.max(8, columns * 2);

/** rng: { int: maxExclusive => int, float: () => [0,1) } */
export function generateLadder(columns, rng) {
  const rows = rowsFor(columns);
  const gaps = columns - 1;
  const rungs = Array.from({ length: rows }, () => new Array(gaps).fill(false));
  // A rung can't share a line with another rung in its row, or the path would fork.
  // Nor does it go right under another in the same gap: the path would just zigzag back.
  const free = (row, gap) =>
    !rungs[row][gap] &&
    !rungs[row][gap - 1] &&
    !rungs[row][gap + 1] &&
    !rungs[row - 1]?.[gap] &&
    !rungs[row + 1]?.[gap];

  // One rung per pair first, so every line is joined to its neighbours. Only the
  // previous gap has a rung yet, so at least rows - 1 rows are open.
  for (let gap = 0; gap < gaps; gap++) {
    const open = Array.from({ length: rows }, (_, row) => row).filter(row => free(row, gap));
    rungs[open[rng.int(open.length)]][gap] = true;
  }
  const chance = rungChance(rows);
  for (let row = 0; row < rows; row++) {
    for (let gap = 0; gap < gaps; gap++) {
      if (free(row, gap) && rng.float() < chance) rungs[row][gap] = true;
    }
  }
  return { columns, rows, rungs };
}

/** Walks down from `start`, crossing every rung met. Returns where it ends and the path taken. */
export function trace(ladder, start) {
  let column = start;
  const points = [[column, 0]];
  ladder.rungs.forEach((row, r) => {
    const next = row[column] ? column + 1 : row[column - 1] ? column - 1 : column;
    if (next === column) return;
    points.push([column, r + 0.5], [next, r + 0.5]);
    column = next;
  });
  points.push([column, ladder.rows]);
  return { end: column, points };
}

// ───────────────────────── lib/random.ts, lib/sketch.ts

/** Deterministic PRNG (mulberry32) for cosmetic jitter such as hand-drawn wobble. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** Stable 32-bit hash for turning strings (e.g. a name) into a seed. */
export function hashString(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const round = value => Math.round(value * 100) / 100;

// ───────────────────────── features/ladder/geometry.ts
/**
 * The board in px: where the lines, rungs, names and taped-over results sit on a
 * board `width` px wide, and how long following a path down it takes.
 */

/** Lines closer than this get cramped, so the board scrolls sideways instead. Six still fit a 390px phone. */
const MIN_GAP = 51;
const MAX_GAP = 120;
/** Below this spacing a name can't sit over its own line; names alternate between two rows. */
const STAGGER_BELOW = 96;
/** Alternating labels reach past their own line; the outer ones get this many gaps of room. */
const STAGGER_GUTTER = 0.9;
export const CHIP_HEIGHT = 40;
export const FLAP_HEIGHT = 44;
const MAX_FLAP_WIDTH = 92;
/** How far the second row of names (and results) sits from the first. */
const ROW_STEP = 46;
const MARGIN = 14;

/** Narrow enough to scroll means staggered, which adds the gutter. */
export const minBoardWidth = columns => (columns + STAGGER_GUTTER) * MIN_GAP;
export const maxBoardWidth = columns => columns * MAX_GAP;

/** Where everything goes for a board `width` px wide. */
export function layout(width, ladder) {
  const { columns, rows } = ladder;
  const stagger = width / columns < STAGGER_BELOW;
  const spacing = width / (columns + (stagger ? STAGGER_GUTTER : 0));
  const inset = stagger ? (spacing * STAGGER_GUTTER) / 2 : 0;
  // Top: even columns take the far row. Bottom: odd ones do. Every line gets one long stub.
  const chipTop = column => (stagger && column % 2 === 1 ? ROW_STEP : 0);
  const ladderTop = CHIP_HEIGHT + (stagger ? ROW_STEP : 0) + MARGIN;
  const rowHeight = Math.max(26, 320 / rows);
  const ladderBottom = ladderTop + rows * rowHeight;
  const flapTop = column => ladderBottom + MARGIN + (stagger && column % 2 === 1 ? ROW_STEP : 0);

  return {
    height: ladderBottom + MARGIN + (stagger ? ROW_STEP : 0) + FLAP_HEIGHT,
    // Names may reach almost to the neighbouring lines; results stay clear of them.
    labelWidth: stagger ? 2 * spacing - 12 : spacing - 8,
    flapWidth: Math.min(stagger ? 2 * spacing - 28 : spacing - 20, MAX_FLAP_WIDTH),
    x: column => inset + (column + 0.5) * spacing,
    /**
     * A rung's height, nudged up to a quarter row off its grid line so the rungs
     * don't line up like a table. Rungs on the same line are at least a row apart,
     * so the nudge never changes their order.
     */
    rungY: (row, gap) =>
      ladderTop + (row + 0.5 + (seededRandom(hashString(`${row}:${gap}`))() - 0.5) * 0.5) * rowHeight,
    chipTop,
    lineTop: column => chipTop(column) + CHIP_HEIGHT,
    flapTop,
    ladderTop,
    ladderBottom,
  };
}

/** A lane's path in px, from under the player's name to the top of their result. lane: {points} */
export function lanePath(lane, geometry) {
  const last = lane.points.length - 1;
  const points = lane.points.map(([column, y], i) => {
    const x = geometry.x(column);
    if (i === 0) return [x, geometry.lineTop(column)];
    if (i === last) return [x, geometry.flapTop(column)];
    // Between start and end the points come in pairs: the two ends of one rung.
    const across = lane.points[i % 2 === 1 ? i + 1 : i - 1][0];
    return [x, geometry.rungY(y - 0.5, Math.min(column, across))];
  });
  const d = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join('');
  const length = points.slice(1).reduce((sum, [x, y], i) => sum + Math.hypot(x - points[i][0], y - points[i][1]), 0);
  return { d, length };
}
