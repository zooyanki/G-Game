import { LEVEL_ROWS } from '../constants';

/**
 * Кусок уровня в ASCII. Строки прижаты к низу: последняя — нижний ряд (13),
 * недостающие сверху считаются пустыми, короткие строки добиваются точками.
 *
 * Клетки:
 * .  пусто            #  земля (верхний слой сам станет травой)
 * =  доска (сквозь неё можно запрыгнуть снизу)
 * -  гнилая доска: осыпается, если на ней стоять
 * B  камень           ~  трясина: твёрдая, но ноги вязнут
 *
 * Прочее: c монета, K знамя, P старт героя.
 * Враги:
 *   Ладога — b разбойник, h щитоносец, s пращник, r ворон;
 *   Новгород — k кикимора, w огонёк, p плевун;
 *   Смоленск — o кабан, l метатель валунов;
 *   Киев — d всадник, a степной лучник, t ястреб.
 * Ловушки: L поленница (катит брёвна), R камнепад (ставится под навес), A дождь стрел.
 *
 * Прыжок берёт 3 тайла вверх и 4 тайла пропасти.
 */
export type Chunk = { width: number; rows: string[] };

export function chunk(width: number, rows: string[]): Chunk {
  if (rows.length > LEVEL_ROWS) throw new Error(`Кусок выше ${LEVEL_ROWS} рядов`);
  const padded = [...Array<string>(LEVEL_ROWS - rows.length).fill(''), ...rows].map((row, index) => {
    if (row.length > width) throw new Error(`Ряд ${index} длиннее ${width}: "${row}"`);
    return row.padEnd(width, '.');
  });
  return { width, rows: padded };
}

export const full = (width: number) => '#'.repeat(width);

/** Ряд из пар «символ, сколько раз»; строка без числа идёт как есть: `line('#', 4, '.', 3, 'c.c')`. */
export function line(...parts: (string | number)[]) {
  let out = '';
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (typeof part === 'number') continue;
    const next = parts[i + 1];
    out += typeof next === 'number' ? part.repeat(next) : part;
  }
  return out;
}
