import type { BossDef } from '../bosses';
import type { Chunk } from './chunk';
import { KIEV, KIEV_ARENA } from './kiev';
import { LADOGA, LADOGA_ARENA } from './ladoga';
import { NOVGOROD, NOVGOROD_ARENA } from './novgorod';
import { SMOLENSK, SMOLENSK_ARENA } from './smolensk';

/** Ближний слой фона: у каждого края свой. */
export type Backdrop = 'pines' | 'reeds' | 'crags' | 'steppe';

export type Palette = {
  sky: number;
  /** Дальние холмы. */
  far: number;
  /** Ближний слой фона. */
  near: number;
  /** Верх земли и его блики. */
  top: number;
  topLight: number;
  dirt: number;
  dirtDark: number;
};

export type LevelDef = {
  id: string;
  city: string;
  title: string;
  palette: Palette;
  backdrop: Backdrop;
  chunks: Chunk[];
  /** Ровно в экран шириной (ARENA_COLS). */
  arena: Chunk;
  boss: BossDef;
};

/**
 * Путь из варяг в греки: четыре города по реке, у каждого свои куски, враги,
 * ловушки, арена и главарь. Около 10 кусков — это ~2 минуты пути и ~1 минута на главаря.
 */
export const LEVELS: LevelDef[] = [
  {
    id: 'ladoga',
    city: 'Ладога',
    title: 'Лесные разбойники',
    palette: { sky: 0x8fb8c8, far: 0x6f8f7a, near: 0x3f5f4a, top: 0x4f7a3a, topLight: 0x6b9a4a, dirt: 0x6b4a2a, dirtDark: 0x5a3d22 },
    backdrop: 'pines',
    chunks: LADOGA,
    arena: LADOGA_ARENA,
    boss: { kind: 'bandit', name: 'Вожак разбойников', hp: 100 },
  },
  {
    id: 'novgorod',
    city: 'Новгород',
    title: 'Болотная нечисть',
    palette: { sky: 0x9aa8a0, far: 0x6a7a6a, near: 0x3a4a3e, top: 0x5a6a3a, topLight: 0x7a8a4a, dirt: 0x4a3f2e, dirtDark: 0x3a3024 },
    backdrop: 'reeds',
    chunks: NOVGOROD,
    arena: NOVGOROD_ARENA,
    boss: { kind: 'bolotnik', name: 'Болотник', hp: 115 },
  },
  {
    id: 'smolensk',
    city: 'Смоленск',
    title: 'Каменный волок',
    palette: { sky: 0xc8b890, far: 0x8f7a5a, near: 0x6a5a44, top: 0x8a8a4a, topLight: 0xa8a45a, dirt: 0x7a6248, dirtDark: 0x62503a },
    backdrop: 'crags',
    chunks: SMOLENSK,
    arena: SMOLENSK_ARENA,
    boss: { kind: 'volot', name: 'Волот-великан', hp: 130 },
  },
  {
    id: 'kiev',
    city: 'Киев',
    title: 'Степной набег',
    palette: { sky: 0xd8a878, far: 0xa8845a, near: 0x8a6a40, top: 0xa89a4a, topLight: 0xc8b860, dirt: 0x8a6440, dirtDark: 0x6e5032 },
    backdrop: 'steppe',
    chunks: KIEV,
    arena: KIEV_ARENA,
    boss: { kind: 'tugarin', name: 'Змей Тугарин', hp: 150 },
  },
];
