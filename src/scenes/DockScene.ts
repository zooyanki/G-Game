import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants';
import { Controls } from '../input/controls';
import { setAttackLabel, setTouchMode } from '../input/touchControls';
import { describe, itemDef, RARITY_COLOR, SLOT_LABEL, SLOTS, type CityId } from '../loot';
import { LEVELS } from '../levels/levels';
import { BANDAGE_COST, progress } from '../progress';
import { createTextures } from '../textures';
import type { LevelData } from './LevelScene';

export type DockData = { cityId: string };

type Row = { label: string; hint?: string; color?: string; run: () => void };

const TEXT = { fontFamily: 'monospace', fontSize: '8px', color: '#f4f0e6' };

/** Причал города: вылазка, главарь, купец, храм, снаряжение. */
export class DockScene extends Phaser.Scene {
  private cityId!: string;
  private controls!: Controls;
  private cursor = 0;
  private rows: Row[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private status!: Phaser.GameObjects.Text;
  private note = '';
  private moveAt = 0;
  private pickHeld = false;

  constructor() {
    super('dock');
  }

  create(data: DockData) {
    const def = LEVELS.find((level) => level.id === data.cityId);
    if (!def) throw new Error(`Нет города ${data.cityId}`);
    this.cityId = def.id;
    createTextures(this);
    this.controls = new Controls(this);
    this.cameras.main.setBackgroundColor(def.palette.sky);
    this.add.rectangle(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT, 0x111111, 0.35);

    this.add
      .text(SCREEN_WIDTH / 2, 10, `${def.city} · причал`, { ...TEXT, fontSize: '12px' })
      .setOrigin(0.5, 0)
      .setResolution(1);

    this.status = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 14, '', { ...TEXT, color: '#9aa0a6', align: 'center' })
      .setOrigin(0.5)
      .setResolution(1);

    this.add.image(16, 16, 'coin').setScrollFactor(0);
    this.note = '';
    this.showRoot();
    setTouchMode('river');
    setAttackLabel('Выбрать');
  }

  update() {
    const frame = this.controls.read();
    if (frame.backPressed) {
      this.scene.start('river');
      return;
    }
    if (this.rows.length === 0) return;
    const now = this.time.now;
    if (frame.y !== 0 && now >= this.moveAt) {
      this.move(frame.y);
      this.moveAt = now + 160;
    }
    const pick = frame.attackPressed || frame.confirmPressed;
    if (pick && !this.pickHeld) this.rows[this.cursor].run();
    this.pickHeld = pick;
  }

  private move(dir: number) {
    this.cursor = (this.cursor + dir + this.rows.length) % this.rows.length;
    this.paint();
  }

  private showRoot() {
    const city = this.cityId as CityId;
    const def = LEVELS.find((level) => level.id === city)!;
    const seal = progress.sealed(city);
    this.rows = [
      {
        label: 'Вылазка',
        hint: SORTIE_HINT[city] ?? def.title,
        run: () => this.scene.start('sortie', { cityId: city }),
      },
      {
        label: seal ? 'Главарь  ✓ печать' : `Главарь  (${progress.offerings(city)}/${progress.sealNeed} икон)`,
        hint: def.boss.name,
        run: () => this.scene.start('level', { levelId: city } satisfies LevelData),
      },
      { label: 'Купец', hint: `бинт ${BANDAGE_COST} серебра`, run: () => this.showShop() },
      {
        label: progress.relic ? 'Храм  · сдать икону' : 'Храм',
        hint: progress.relic ? 'Икона в руках' : 'Пусто',
        run: () => this.offer(),
      },
      { label: 'Снаряжение', hint: `${progress.stash.length}/${progress.stashMax} в запасе`, run: () => this.showGear() },
      { label: 'К реке', run: () => this.scene.start('river') },
    ];
    this.cursor = 0;
    this.paint();
  }

  private showShop() {
    const rows: Row[] = [
      {
        label: `Купить бинт · ${BANDAGE_COST}с`,
        hint: `сейчас ${progress.bandages}`,
        run: () => {
          this.note = progress.buyBandage() ? 'Бинт куплен' : 'Не хватает серебра';
          this.showShop();
        },
      },
    ];
    for (const inst of progress.stash) {
      const def = itemDef(inst.defId);
      rows.push({
        label: `Продать ${def.name} · ${def.price}с`,
        color: RARITY_COLOR[def.rarity],
        run: () => {
          progress.sell(inst.uid);
          this.note = `+${def.price} серебра`;
          this.showShop();
        },
      });
    }
    rows.push({ label: 'Назад', run: () => this.showRoot() });
    this.rows = rows;
    this.cursor = 0;
    this.paint();
  }

  private showGear() {
    const rows: Row[] = SLOTS.map((slot) => {
      const worn = progress.equippedIn(slot);
      return {
        label: `${SLOT_LABEL[slot]}: ${worn ? worn.name : '—'}`,
        hint: worn ? describe(worn) : 'пусто',
        color: worn ? RARITY_COLOR[worn.rarity] : '#9aa0a6',
        run: () => {
          if (!worn) {
            this.note = 'Слот пуст';
            return;
          }
          this.note = progress.unequip(slot) ? `Снято: ${worn.name}` : 'Запас полон';
          this.showGear();
        },
      };
    });
    for (const inst of progress.stash) {
      const def = itemDef(inst.defId);
      rows.push({
        label: `Надеть ${def.name}`,
        hint: describe(def),
        color: RARITY_COLOR[def.rarity],
        run: () => {
          progress.wear(inst.uid);
          this.note = `Надето: ${def.name}`;
          this.showGear();
        },
      });
    }
    rows.push({ label: 'Назад', run: () => this.showRoot() });
    this.rows = rows;
    this.cursor = Math.min(this.cursor, rows.length - 1);
    this.paint();
  }

  private offer() {
    const city = progress.offerRelic();
    this.note = city
      ? progress.sealed(city)
        ? 'Печать города. Можно идти к главарю.'
        : `Икона принята (${progress.offerings(city)}/${progress.sealNeed})`
      : 'Нечего сдавать. Принеси икону с вылазки.';
    this.showRoot();
  }

  private paint() {
    for (const label of this.labels) label.destroy();
    this.labels = [];
    const top = 32;
    const cap = 8;
    const start = Math.max(0, Math.min(this.cursor - cap + 1, Math.max(0, this.rows.length - cap)));
    this.rows.slice(start, start + cap).forEach((row, vis) => {
      const index = start + vis;
      const chosen = index === this.cursor;
      const line = this.add
        .text(24, top + vis * 18, `${chosen ? '>' : ' '} ${row.label}`, {
          ...TEXT,
          color: row.color ?? (chosen ? '#f2d48a' : '#f4f0e6'),
        })
        .setResolution(1);
      this.labels.push(line);
      if (chosen && row.hint) {
        this.labels.push(
          this.add
            .text(SCREEN_WIDTH - 16, top + vis * 18 + 4, row.hint, { ...TEXT, color: '#9aa0a6' })
            .setOrigin(1, 0)
            .setResolution(1),
        );
      }
    });

    const stats = progress.stats();
    const relic = progress.relic ? '  икона' : '';
    this.status.setText(
      `${this.note ? `${this.note} · ` : ''}${progress.coins}с  бинты ${progress.bandages}  ♥${stats.hp}  меч ${stats.sword}  лук ${stats.bow}${relic}`,
    );
  }
}

const SORTIE_HINT: Record<string, string> = {
  ladoga: 'Стан в чаще',
  novgorod: 'Капище на кочках',
  smolensk: 'Каменный навес',
  kiev: 'Курган у обоза',
};
