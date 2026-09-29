import { ARENA_COLS, LEVEL_ROWS, TILE } from '../constants';
import type { EnemyKind } from '../enemies';
import type { HazardKind } from '../entities/hazards';
import { TILE_BOG, TILE_CRUMBLE, TILE_DIRT, TILE_GRASS, TILE_PLANK, TILE_STONE } from '../textures';
import type { LevelDef } from './levels';

const TILE_CHARS: Record<string, number> = {
  '=': TILE_PLANK,
  '-': TILE_CRUMBLE,
  B: TILE_STONE,
  '~': TILE_BOG,
};

const ENEMY_CHARS: Record<string, EnemyKind> = {
  b: 'bandit',
  h: 'shield',
  s: 'slinger',
  r: 'raven',
  k: 'kikimora',
  w: 'wisp',
  p: 'spitter',
  o: 'boar',
  l: 'lobber',
  d: 'rider',
  a: 'archer',
  t: 'hawk',
};

const HAZARD_CHARS: Record<string, HazardKind> = {
  L: 'logs',
  R: 'rockfall',
  A: 'arrowRain',
};

type Point = { x: number; y: number };

export type BuiltLevel = {
  /** Индексы кадров тайлсета, -1 — пусто. */
  data: number[][];
  width: number;
  height: number;
  start: Point;
  enemies: (Point & { kind: EnemyKind })[];
  /** Камнепад стоит в центре клетки под навесом, остальные ловушки — на земле. */
  hazards: (Point & { kind: HazardKind })[];
  coins: Point[];
  /** Последнее знамя всегда стоит на входе в арену. */
  checkpoints: Point[];
  arenaX: number;
};

/** Склеивает куски в одну карту. Координаты — ноги на дне клетки, центр по ширине. */
export function buildLevel(def: LevelDef): BuiltLevel {
  if (def.arena.width !== ARENA_COLS) throw new Error(`Арена ${def.id} должна быть шириной ${ARENA_COLS}`);
  const chunks = [...def.chunks, def.arena];
  const rows = Array.from({ length: LEVEL_ROWS }, (_, row) => chunks.map((chunk) => chunk.rows[row]).join(''));
  const cols = rows[0].length;
  const arenaCol = cols - ARENA_COLS;

  const built: BuiltLevel = {
    data: [],
    width: cols * TILE,
    height: LEVEL_ROWS * TILE,
    start: { x: 2 * TILE, y: (LEVEL_ROWS - 2) * TILE },
    enemies: [],
    hazards: [],
    coins: [],
    checkpoints: [],
    arenaX: arenaCol * TILE,
  };

  for (let row = 0; row < LEVEL_ROWS; row += 1) {
    const line: number[] = [];
    for (let col = 0; col < cols; col += 1) {
      const char = rows[row][col];
      const feet = { x: col * TILE + TILE / 2, y: (row + 1) * TILE };

      if (char === '#') line.push(row > 0 && '#~'.includes(rows[row - 1][col]) ? TILE_DIRT : TILE_GRASS);
      else line.push(TILE_CHARS[char] ?? -1);

      if (char === 'P') built.start = feet;
      else if (char === 'c') built.coins.push({ x: feet.x, y: feet.y - TILE / 2 });
      else if (char === 'K') built.checkpoints.push(feet);
      else if (ENEMY_CHARS[char]) built.enemies.push({ ...feet, kind: ENEMY_CHARS[char] });
      else if (HAZARD_CHARS[char]) {
        const kind = HAZARD_CHARS[char];
        built.hazards.push({ x: feet.x, y: kind === 'rockfall' ? feet.y - TILE / 2 : feet.y, kind });
      } else if (!'.#'.includes(char) && TILE_CHARS[char] === undefined) {
        throw new Error(`Неизвестный символ "${char}" в ${def.id}, ряд ${row}, колонка ${col}`);
      }
    }
    built.data.push(line);
  }

  built.checkpoints.push({ x: built.arenaX + TILE, y: (LEVEL_ROWS - 2) * TILE });
  return built;
}
