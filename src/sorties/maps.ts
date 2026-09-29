import { TILE } from '../constants';
import type { EnemyKind } from '../enemies';
import type { CityId } from '../loot';

export type RaidMark = {
  x: number;
  y: number;
  kind: EnemyKind;
};

export type RaidChest = { x: number; y: number };

export type RaidBuilt = {
  data: number[][];
  width: number;
  height: number;
  start: { x: number; y: number };
  exit: { x: number; y: number };
  relic: { x: number; y: number } | null;
  chests: RaidChest[];
  enemies: RaidMark[];
};

const ENEMY: Record<string, EnemyKind> = {
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

/** Стена — камень. Пол — трава, без столкновения. */
const WALL = 3;
const FLOOR = 1;

function parse(ascii: string): RaidBuilt {
  const rows = ascii.replace(/\r/g, '').trimEnd().split('\n').map((row) => row.trimEnd());
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => row.padEnd(width, '#'));

  const built: RaidBuilt = {
    data: [],
    width: width * TILE,
    height: height * TILE,
    start: { x: 24, y: 24 },
    exit: { x: width * 16 - 24, y: 24 },
    relic: null,
    chests: [],
    enemies: [],
  };

  for (let row = 0; row < height; row += 1) {
    const line: number[] = [];
    for (let col = 0; col < width; col += 1) {
      const char = padded[row][col];
      const x = col * TILE + TILE / 2;
      const y = row * TILE + TILE / 2;
      line.push(char === '#' ? WALL : FLOOR);
      if (char === 'P') built.start = { x, y };
      else if (char === 'X') built.exit = { x, y };
      else if (char === '*') built.relic = { x, y };
      else if (char === 'C') built.chests.push({ x, y });
      else if (ENEMY[char]) built.enemies.push({ x, y, kind: ENEMY[char] });
    }
    built.data.push(line);
  }
  return built;
}

export const SORTIES: Record<CityId, { title: string; hint: string; map: RaidBuilt }> = {
  ladoga: {
    title: 'Стан в чаще',
    hint: 'Вынеси икону из пещеры',
    map: parse(`
########################
#P....#....r......b...X#
#.....#..s....####.....#
#..C..#.......#..h.....#
#.....##......#........#
#*........b.......r....#
#....####....s.........#
########################
`),
  },
  novgorod: {
    title: 'Капище на кочках',
    hint: 'Икона у огоньков, не стой в тине',
    map: parse(`
########################
#P..k....###......p...X#
#........#.#..w........#
#..C..k..#.#......###..#
#........#.#..w...#.*..#
#..p........k..........#
########################
`),
  },
  smolensk: {
    title: 'Каменный навес',
    hint: 'Валуны катятся — икона за кабаном',
    map: parse(`
##########################
#P....###....o......l...X#
#..C..###........###.....#
#............o...###..*..#
#....l....###............#
#.........###....o.......#
##########################
`),
  },
  kiev: {
    title: 'Курган у обоза',
    hint: 'Всадник с края, икона на кургане',
    map: parse(`
##########################
#P.....t......d.........X#
#...a..###........t......#
#......###..C....###.....#
#..t.......d......###.*..#
#.............a..........#
##########################
`),
  },
};
