/** Правила первой сцены. Числа отсюда можно крутить, не трогая остальной код. */

export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 240;

/** Мир выше экрана: камера едет за героем, иначе все три врага увидели бы его сразу. */
export const WORLD_WIDTH = 320;
export const WORLD_HEIGHT = 1000;

export const SPRITE = 16;
export const WALL = 32;

/** Всю ширину экрана герой проходит за 3 секунды, враг — за 4. */
export const HERO_SPEED = SCREEN_WIDTH / 3;
export const ENEMY_SPEED = SCREEN_WIDTH / 4;

export const HERO_LIVES = 3;
/** Меч снимает все жизни сразу, стрела — одну. */
export const ENEMY_LIVES = 2;
export const INVULNERABLE_MS = 1000;
export const ATTACK_COOLDOWN_MS = 320;
export const SLASH_MS = 90;
export const ATTACK_REACH = 20;
export const ATTACK_THICKNESS = 16;

/** Лучник стреляет реже, чем мечник бьёт: стрела и так достаёт издалека. */
export const BOW_COOLDOWN_MS = 500;
/** Стрела пересекает экран чуть быстрее, чем за секунду. */
export const ARROW_SPEED = SCREEN_WIDTH / 0.6;

/** «Видит» — половина ширины экрана. */
export const AGGRO_RANGE = SCREEN_WIDTH / 2;

export type Facing = 'up' | 'down' | 'left' | 'right';

/**
 * Пока игрок не нажал направление, герой смотрит вверх:
 * корабль остаётся за спиной, путь с врагами — впереди.
 */
export const DEFAULT_FACING: Facing = 'up';

export const HERO_START = { x: WORLD_WIDTH / 2, y: 900 };

/** Вода занимает низ карты. Корабль стоит на ней, поэтому отдельная стена ему не нужна. */
export const WATER = { x: WORLD_WIDTH / 2, y: 960, width: WORLD_WIDTH, height: 80 };

/** Расстояние между врагами больше AGGRO_RANGE, поэтому они вступают в бой по очереди. */
export const ENEMY_SPOTS = [
  { x: WORLD_WIDTH / 2, y: 680 },
  { x: WORLD_WIDTH / 2 + 40, y: 440 },
  { x: WORLD_WIDTH / 2 - 36, y: 200 },
];

export const SHIP_POSITION = { x: WORLD_WIDTH / 2, y: 948 };
