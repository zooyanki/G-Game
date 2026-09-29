/** Правила игры. Числа отсюда можно крутить, не трогая остальной код. */

/** 16:9 — телефон в альбомной ориентации. */
export const SCREEN_WIDTH = 384;
export const SCREEN_HEIGHT = 216;

export const TILE = 16;
/** Высота любого уровня в тайлах: земля — два нижних ряда. */
export const LEVEL_ROWS = 14;
/** Арена главаря ровно в экран шириной: камера на ней замирает. */
export const ARENA_COLS = SCREEN_WIDTH / TILE;

export const GRAVITY = 900;
export const MAX_FALL_SPEED = 420;

/** Экран герой пробегает примерно за 3,5 секунды. */
export const HERO_SPEED = 110;
/** Высота прыжка ~64 px: ступенька в 3 тайла берётся с запасом. */
export const JUMP_SPEED = 340;
/** Отпустил прыжок раньше — герой не взлетает выше этой скорости. */
export const JUMP_CUT_SPEED = 120;
/** Можно прыгнуть чуть позже, чем сошёл с края. */
export const COYOTE_MS = 90;
/** Нажатие прыжка чуть раньше приземления не теряется. */
export const JUMP_BUFFER_MS = 110;

export const HERO_HP = 3;
export const INVULNERABLE_MS = 1200;
export const KNOCKBACK_MS = 250;
export const SWAP_COOLDOWN_MS = 250;

/** Меч бьёт сильнее, но вплотную; лук слабее, зато издалека и в 8 сторон. */
export const SWORD_COOLDOWN_MS = 300;
export const SWORD_DAMAGE = 2;
export const SWORD_REACH = 22;
export const SLASH_MS = 110;
/** Удар вниз в прыжке по врагу подбрасывает героя. */
export const POGO_SPEED = 260;

export const BOW_COOLDOWN_MS = 220;
export const ARROW_DAMAGE = 1;
export const ARROW_SPEED = 380;

/**
 * Супер-удар: шкала благодати копится от урона по врагам.
 * ~50 ударов лука или ~25 взмахов меча. За уровень выходит 2–3 луча.
 */
export const GRACE_MAX = 100;
export const GRACE_PER_DAMAGE = 2;
/** Лучи падают на всех в кадре: обычные враги гибнут, главарь теряет столько здоровья. */
export const BEAM_BOSS_DAMAGE = 10;
/** Всё это время герой неуязвим и стоит в сиянии. */
export const SUPER_MS = 1100;
/** Сколько рука с поднятым пальцем висит на экране после удара. */
export const BLESSING_HOLD_MS = 2200;

/** Враги просыпаются, когда герой ближе этого расстояния. */
export const WAKE_RANGE = SCREEN_WIDTH * 0.6;
