import { LEVELS } from './levels/levels';
import {
  cityItems,
  itemDef,
  mint,
  SLOTS,
  sumMods,
  type CityId,
  type GearStats,
  type ItemInst,
  type Slot,
} from './loot/items';

const STORAGE_KEY = 'gardariki-progress-v2';
const STASH_MAX = 8;
const OFFERINGS_FOR_SEAL = 3;
export const BANDAGE_COST = 12;

type Equipped = Partial<Record<Slot, ItemInst>>;

type Saved = {
  completed: string[];
  coins: number;
  at: number;
  bandages: number;
  offerings: Record<string, number>;
  sorties: Record<string, number>;
  equipped: Equipped;
  stash: ItemInst[];
  /** Несданная икона города. */
  relic: CityId | null;
};

function emptyOfferings(): Record<string, number> {
  return Object.fromEntries(LEVELS.map((level) => [level.id, 0]));
}

function load(): Saved {
  const blank: Saved = {
    completed: [],
    coins: 0,
    at: 0,
    bandages: 0,
    offerings: emptyOfferings(),
    sorties: emptyOfferings(),
    equipped: {},
    stash: [],
    relic: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('gardariki-progress-v1');
    if (!raw) return blank;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed.map(String) : [],
      coins: Number(parsed.coins) || 0,
      at: Number(parsed.at) || 0,
      bandages: Number(parsed.bandages) || 0,
      offerings: { ...emptyOfferings(), ...(parsed.offerings ?? {}) },
      sorties: { ...emptyOfferings(), ...(parsed.sorties ?? {}) },
      equipped: parsed.equipped && typeof parsed.equipped === 'object' ? parsed.equipped : {},
      stash: Array.isArray(parsed.stash) ? parsed.stash : [],
      relic: parsed.relic === 'ladoga' || parsed.relic === 'novgorod' || parsed.relic === 'smolensk' || parsed.relic === 'kiev' ? parsed.relic : null,
    };
  } catch {
    return blank;
  }
}

const state = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Приватный режим.
  }
}

function equippedDefs() {
  return SLOTS.map((slot) => state.equipped[slot]).filter(Boolean).map((item) => itemDef(item!.defId));
}

function rollFrom(city: CityId) {
  const pool = cityItems(city);
  if (!pool.length) return null;
  const blessed = pool.filter((item) => item.rarity !== 'mundane');
  const table = Math.random() < 0.35 && blessed.length ? blessed : pool;
  return table[Math.floor(Math.random() * table.length)];
}

/** Прогресс похода. Лежит в localStorage: на телефоне вкладку легко перезагрузить. */
export const progress = {
  get coins() {
    return state.coins;
  },

  get at() {
    return state.at;
  },

  set at(index: number) {
    state.at = index;
    save();
  },

  get bandages() {
    return state.bandages;
  },

  get relic() {
    return state.relic;
  },

  get stash() {
    return state.stash;
  },

  get equipped() {
    return state.equipped;
  },

  stats(): GearStats {
    return sumMods(equippedDefs());
  },

  isCompleted(levelId: string) {
    return state.completed.includes(levelId);
  },

  complete(levelId: string, coins: number) {
    if (!state.completed.includes(levelId)) state.completed.push(levelId);
    state.coins += coins;
    save();
  },

  addSilver(amount: number) {
    state.coins = Math.max(0, state.coins + amount);
    save();
  },

  sortieCount(city: CityId) {
    return state.sorties[city] ?? 0;
  },

  offerings(city: CityId) {
    return state.offerings[city] ?? 0;
  },

  sealed(city: CityId) {
    return this.offerings(city) >= OFFERINGS_FOR_SEAL;
  },

  buyBandage() {
    if (state.coins < BANDAGE_COST) return false;
    state.coins -= BANDAGE_COST;
    state.bandages += 1;
    save();
    return true;
  },

  useBandage() {
    if (state.bandages <= 0) return false;
    state.bandages -= 1;
    save();
    return true;
  },

  takeRelic(city: CityId) {
    if (state.relic) return false;
    state.relic = city;
    save();
    return true;
  },

  loseRelic() {
    state.relic = null;
    save();
  },

  offerRelic() {
    if (!state.relic) return false;
    const city = state.relic;
    state.offerings[city] = (state.offerings[city] ?? 0) + 1;
    state.relic = null;
    save();
    return city;
  },

  finishSortie(city: CityId, silver: number) {
    state.sorties[city] = (state.sorties[city] ?? 0) + 1;
    state.coins += silver;
    save();
  },

  equippedIn(slot: Slot) {
    const inst = state.equipped[slot];
    return inst ? itemDef(inst.defId) : null;
  },

  /** true — вещь легла в запас или сразу в пустой слот. */
  grant(defId: string) {
    const def = itemDef(defId);
    const inst = mint(defId);
    if (!state.equipped[def.slot]) {
      state.equipped[def.slot] = inst;
      save();
      return 'equip';
    }
    if (state.stash.length >= STASH_MAX) return false;
    state.stash.push(inst);
    save();
    return 'stash';
  },

  wear(uid: string) {
    const index = state.stash.findIndex((item) => item.uid === uid);
    if (index < 0) return false;
    const inst = state.stash[index];
    const def = itemDef(inst.defId);
    state.stash.splice(index, 1);
    const prev = state.equipped[def.slot];
    if (prev) state.stash.push(prev);
    state.equipped[def.slot] = inst;
    save();
    return true;
  },

  unequip(slot: Slot) {
    const inst = state.equipped[slot];
    if (!inst) return false;
    if (state.stash.length >= STASH_MAX) return false;
    delete state.equipped[slot];
    state.stash.push(inst);
    save();
    return true;
  },

  sell(uid: string) {
    const fromStash = state.stash.findIndex((item) => item.uid === uid);
    if (fromStash >= 0) {
      const def = itemDef(state.stash[fromStash].defId);
      state.stash.splice(fromStash, 1);
      state.coins += def.price;
      save();
      return def.price;
    }
    for (const slot of SLOTS) {
      if (state.equipped[slot]?.uid !== uid) continue;
      const def = itemDef(state.equipped[slot]!.defId);
      delete state.equipped[slot];
      state.coins += def.price;
      save();
      return def.price;
    }
    return 0;
  },

  rollDrop(city: CityId) {
    return rollFrom(city);
  },

  stashMax: STASH_MAX,
  sealNeed: OFFERINGS_FOR_SEAL,
};
