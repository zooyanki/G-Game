export type Slot = 'head' | 'body' | 'hand' | 'offhand' | 'neck' | 'ring';

export type Rarity = 'mundane' | 'blessed' | 'pagan';

export type CityId = 'ladoga' | 'novgorod' | 'smolensk' | 'kiev';

/** Что вещь меняет. Все поля — добавки к базе героя. */
export type Mods = {
  sword?: number;
  bow?: number;
  /** Множитель очков благодати с удара, 0.25 = +25%. */
  grace?: number;
  hp?: number;
  /** Множитель скорости бега. */
  speed?: number;
};

export type ItemDef = {
  id: string;
  name: string;
  slot: Slot;
  city: CityId;
  rarity: Rarity;
  mods: Mods;
  /** Сколько серебра даст купец. */
  price: number;
};

export type ItemInst = {
  uid: string;
  defId: string;
};

export const SLOTS: Slot[] = ['head', 'body', 'hand', 'offhand', 'neck', 'ring'];

export const SLOT_LABEL: Record<Slot, string> = {
  head: 'Голова',
  body: 'Тело',
  hand: 'Оружие',
  offhand: 'Левая',
  neck: 'Шея',
  ring: 'Кольцо',
};

export const RARITY_COLOR: Record<Rarity, string> = {
  mundane: '#c8c0b4',
  blessed: '#f2d48a',
  pagan: '#e07060',
};

export const ITEMS: Record<string, ItemDef> = {
  'amber-cross': { id: 'amber-cross', name: 'Янтарный крест', slot: 'neck', city: 'ladoga', rarity: 'blessed', mods: { grace: 0.35 }, price: 18 },
  'bark-cap': { id: 'bark-cap', name: 'Шапка из коры', slot: 'head', city: 'ladoga', rarity: 'mundane', mods: { hp: 1 }, price: 10 },
  'forest-blade': { id: 'forest-blade', name: 'Лесной нож', slot: 'hand', city: 'ladoga', rarity: 'mundane', mods: { sword: 1 }, price: 12 },
  'raven-quiver': { id: 'raven-quiver', name: 'Колчан ворона', slot: 'offhand', city: 'ladoga', rarity: 'mundane', mods: { bow: 1 }, price: 12 },
  'bandit-ring': { id: 'bandit-ring', name: 'Перстень вожака', slot: 'ring', city: 'ladoga', rarity: 'pagan', mods: { sword: 1, bow: 1, grace: -0.2 }, price: 16 },

  'moss-cowl': { id: 'moss-cowl', name: 'Моховой клобук', slot: 'head', city: 'novgorod', rarity: 'mundane', mods: { speed: 0.1 }, price: 10 },
  'reed-mail': { id: 'reed-mail', name: 'Плетень на грудь', slot: 'body', city: 'novgorod', rarity: 'mundane', mods: { hp: 1 }, price: 14 },
  'bog-cross': { id: 'bog-cross', name: 'Ивовый крест', slot: 'neck', city: 'novgorod', rarity: 'blessed', mods: { grace: 0.4, hp: 1 }, price: 20 },
  'toad-ring': { id: 'toad-ring', name: 'Жабье кольцо', slot: 'ring', city: 'novgorod', rarity: 'pagan', mods: { sword: 1, speed: 0.1, grace: -0.15 }, price: 16 },

  'iron-helm': { id: 'iron-helm', name: 'Шлем волока', slot: 'head', city: 'smolensk', rarity: 'mundane', mods: { hp: 1 }, price: 12 },
  'hide-coat': { id: 'hide-coat', name: 'Кабанья шкура', slot: 'body', city: 'smolensk', rarity: 'pagan', mods: { hp: 1, sword: 1, grace: -0.25 }, price: 18 },
  'stone-mace': { id: 'stone-mace', name: 'Каменная булава', slot: 'hand', city: 'smolensk', rarity: 'mundane', mods: { sword: 2 }, price: 16 },
  'anvil-cross': { id: 'anvil-cross', name: 'Крест-наковальня', slot: 'neck', city: 'smolensk', rarity: 'blessed', mods: { grace: 0.3 }, price: 18 },

  'steppe-cap': { id: 'steppe-cap', name: 'Степная шапка', slot: 'head', city: 'kiev', rarity: 'mundane', mods: { speed: 0.12 }, price: 10 },
  'fire-bow': { id: 'fire-bow', name: 'Тетива с кургана', slot: 'hand', city: 'kiev', rarity: 'mundane', mods: { bow: 2 }, price: 16 },
  'gold-quiver': { id: 'gold-quiver', name: 'Золотой колчан', slot: 'offhand', city: 'kiev', rarity: 'blessed', mods: { bow: 1, grace: 0.2 }, price: 20 },
  'serpent-ring': { id: 'serpent-ring', name: 'Змеиный перстень', slot: 'ring', city: 'kiev', rarity: 'pagan', mods: { bow: 1, sword: 1, grace: -0.2 }, price: 18 },
};

export function itemDef(id: string) {
  const def = ITEMS[id];
  if (!def) throw new Error(`Нет вещи ${id}`);
  return def;
}

export function cityItems(city: CityId) {
  return Object.values(ITEMS).filter((item) => item.city === city);
}

export function describe(def: ItemDef) {
  const bits: string[] = [];
  if (def.mods.sword) bits.push(`меч +${def.mods.sword}`);
  if (def.mods.bow) bits.push(`лук +${def.mods.bow}`);
  if (def.mods.hp) bits.push(`сердце +${def.mods.hp}`);
  if (def.mods.speed) bits.push(`бег +${Math.round(def.mods.speed * 100)}%`);
  if (def.mods.grace) bits.push(def.mods.grace > 0 ? `благодать +${Math.round(def.mods.grace * 100)}%` : `благодать ${Math.round(def.mods.grace * 100)}%`);
  return bits.join(', ') || 'без свойств';
}

let nextUid = 1;
export function mint(defId: string): ItemInst {
  nextUid += 1;
  return { uid: `i${Date.now().toString(36)}${nextUid}`, defId };
}

export type GearStats = {
  sword: number;
  bow: number;
  grace: number;
  hp: number;
  speed: number;
};

export const BASE_STATS: GearStats = { sword: 2, bow: 1, grace: 1, hp: 3, speed: 1 };

export function sumMods(defs: ItemDef[]): GearStats {
  const stats = { ...BASE_STATS };
  for (const def of defs) {
    stats.sword += def.mods.sword ?? 0;
    stats.bow += def.mods.bow ?? 0;
    stats.grace += def.mods.grace ?? 0;
    stats.hp += def.mods.hp ?? 0;
    stats.speed += def.mods.speed ?? 0;
  }
  stats.sword = Math.max(1, stats.sword);
  stats.bow = Math.max(1, stats.bow);
  stats.grace = Math.max(0.4, stats.grace);
  stats.hp = Math.max(3, Math.min(5, stats.hp));
  stats.speed = Math.max(0.75, Math.min(1.35, stats.speed));
  return stats;
}
