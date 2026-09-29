import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants';
import { Controls } from '../input/controls';
import { setAttackLabel, setTouchMode } from '../input/touchControls';
import { LEVELS } from '../levels/levels';
import { progress } from '../progress';
import { createTextures } from '../textures';
import type { DockData } from './DockScene';
import type { LevelData } from './LevelScene';

/** Русло с севера на юг: Ладога вверху слева, Киев внизу справа. */
const RIVER: [number, number][] = [
  [-10, 36],
  [40, 40],
  [90, 58],
  [118, 86],
  [108, 116],
  [140, 138],
  [196, 128],
  [246, 138],
  [272, 166],
  [322, 182],
  [394, 188],
];
/** На каких точках русла причалы — по порядку LEVELS — и куда от причала отнесён город. */
const CITY_POINTS = [1, 4, 7, 9];
const CITY_OFFSETS: [number, number][] = [
  [0, 26],
  [-38, 4],
  [0, 26],
  [0, -26],
];
const SAIL_SPEED = 90;
const TEXT = { fontFamily: 'monospace', fontSize: '8px', color: '#f4f0e6' };

let urlHandled = false;

/** Для проверки: `?level=ladoga&checkpoint=3` сразу открывает уровень у нужного знамени. */
function openLevelFromUrl(scene: Phaser.Scene) {
  if (urlHandled) return false;
  urlHandled = true;
  const params = new URLSearchParams(window.location.search);
  const sortieId = params.get('sortie');
  if (sortieId && LEVELS.some((level) => level.id === sortieId)) {
    scene.scene.start('sortie', { cityId: sortieId });
    return true;
  }
  const dockId = params.get('dock');
  if (dockId && LEVELS.some((level) => level.id === dockId)) {
    scene.scene.start('dock', { cityId: dockId } satisfies DockData);
    return true;
  }
  const levelId = params.get('level');
  if (!levelId || !LEVELS.some((level) => level.id === levelId)) return false;
  const checkpoint = params.has('checkpoint') ? Number(params.get('checkpoint')) : undefined;
  scene.scene.start('level', { levelId, checkpoint } satisfies LevelData);
  return true;
}

/** Карта похода: драккар плывёт от города к городу, у причала можно войти в уровень. */
export class RiverScene extends Phaser.Scene {
  private controls!: Controls;
  private boat!: Phaser.GameObjects.Image;
  private path!: Phaser.Curves.Path;
  /** Расстояние от начала русла до каждого города. */
  private stops: number[] = [];
  private length = 0;
  private distance = 0;
  private at = 0;
  private target = 0;
  private card!: Phaser.GameObjects.Text;

  constructor() {
    super('river');
  }

  create() {
    if (openLevelFromUrl(this)) return;
    createTextures(this);
    this.controls = new Controls(this);
    this.cameras.main.setBackgroundColor(0x6b8f4e);

    this.path = new Phaser.Curves.Path(RIVER[0][0], RIVER[0][1]);
    for (const [x, y] of RIVER.slice(1)) this.path.lineTo(x, y);
    this.length = this.path.getLength();
    this.stops = CITY_POINTS.map((index) => this.lengthTo(index));

    this.drawLand();
    this.drawRiver();
    this.drawCities();

    this.at = Phaser.Math.Clamp(progress.at, 0, this.unlocked());
    this.target = this.at;
    this.distance = this.stops[this.at];
    this.boat = this.add.image(0, 0, 'drakkar').setDepth(20);
    if (progress.equippedIn('neck')) this.add.image(0, 0, 'relic').setDepth(21).setName('boat-cross');
    this.placeBoat(0);

    this.add
      .text(SCREEN_WIDTH / 2, 8, 'Путь из варяг в греки', { ...TEXT, fontSize: '12px' })
      .setOrigin(0.5, 0)
      .setResolution(1);

    this.card = this.add
      .text(SCREEN_WIDTH / 2, 34, '', {
        ...TEXT,
        align: 'center',
        backgroundColor: '#111111',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setResolution(1);

    if (LEVELS.every((level) => progress.isCompleted(level.id))) this.showFinale();

    setTouchMode('river');
    setAttackLabel('Войти');
    this.refreshCard();
  }

  update(time: number, delta: number) {
    const frame = this.controls.read();
    const docked = this.distance === this.stops[this.target];

    if (docked) {
      this.at = this.target;
      if (frame.x > 0 && this.at < this.unlocked()) this.sailTo(this.at + 1);
      else if (frame.x < 0 && this.at > 0) this.sailTo(this.at - 1);
      else if (frame.attackPressed || frame.confirmPressed) this.enter();
    }

    this.placeBoat(delta);
    this.boat.y += Math.sin(time / 300) * 1.2;
  }

  /** Последний открытый город: пройденные и следующий за ними. */
  private unlocked() {
    const firstOpen = LEVELS.findIndex((level) => !progress.isCompleted(level.id));
    return firstOpen === -1 ? LEVELS.length - 1 : firstOpen;
  }

  private sailTo(index: number) {
    this.target = index;
    this.refreshCard();
  }

  private enter() {
    progress.at = this.at;
    this.scene.start('dock', { cityId: LEVELS[this.at].id } satisfies DockData);
  }

  private placeBoat(delta: number) {
    const goal = this.stops[this.target];
    const step = (SAIL_SPEED * delta) / 1000;
    const before = this.distance;
    if (Math.abs(goal - this.distance) <= step) this.distance = goal;
    else this.distance += Math.sign(goal - this.distance) * step;

    const point = this.path.getPoint(this.distance / this.length);
    this.boat.setPosition(Math.round(point.x), Math.round(point.y) - 6);
    const cross = this.children.getByName('boat-cross') as Phaser.GameObjects.Image | undefined;
    if (cross) {
      cross.setPosition(this.boat.x, this.boat.y - 8);
      cross.setFlipX(this.boat.flipX);
    }
    if (this.distance !== before) this.boat.setFlipX(this.distance < before);
    if (this.distance === goal && before !== goal) this.refreshCard();
  }

  private refreshCard() {
    const docked = this.distance === this.stops[this.target];
    const level = LEVELS[this.target];
    if (!docked) {
      this.card.setText(`Плывём в ${level.city}…`);
      return;
    }
    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    const done = progress.isCompleted(level.id) ? '  ✓ пройдено' : '';
    const hint = onPhone ? 'Войти — кнопка справа' : 'Пробел — причал, ←→ — плыть';
    this.card.setText(`${level.city}: ${level.title}${done}\n${hint}`);
  }

  private lengthTo(pointIndex: number) {
    let total = 0;
    for (let i = 1; i <= pointIndex; i += 1) {
      total += Phaser.Math.Distance.Between(RIVER[i - 1][0], RIVER[i - 1][1], RIVER[i][0], RIVER[i][1]);
    }
    return total;
  }

  private drawLand() {
    const g = this.add.graphics();
    const random = new Phaser.Math.RandomDataGenerator(['gardariki']);
    for (let i = 0; i < 70; i += 1) {
      const x = random.between(0, SCREEN_WIDTH);
      const y = random.between(24, SCREEN_HEIGHT);
      g.fillStyle(random.pick([0x3f5f4a, 0x4f7a3a, 0x355040]));
      g.fillTriangle(x, y, x + 4, y - 9, x + 8, y);
    }
  }

  private drawRiver() {
    const g = this.add.graphics();
    g.lineStyle(16, 0x3b6ea8);
    this.path.draw(g);
    g.lineStyle(6, 0x5a8fc8);
    this.path.draw(g);
    for (const [x, y] of RIVER) {
      g.fillStyle(0x3b6ea8).fillCircle(x, y, 8);
      g.fillStyle(0x5a8fc8).fillCircle(x, y, 3);
    }
  }

  private drawCities() {
    LEVELS.forEach((level, index) => {
      const [x, y] = RIVER[CITY_POINTS[index]];
      const [dx, dy] = CITY_OFFSETS[index];
      const cityX = x + dx;
      const cityY = y + dy;
      const open = index <= this.unlocked();
      const city = this.add.image(cityX, cityY, 'city').setDepth(10);
      if (!open) city.setTint(0x555555);

      const mark = progress.isCompleted(level.id) ? ' ✓' : open ? '' : ' ?';
      this.add
        .text(cityX, dy < 0 ? cityY - 16 : cityY + 16, `${level.city}${mark}`, {
          ...TEXT,
          color: open ? '#f4f0e6' : '#9aa0a6',
          backgroundColor: '#11111199',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(11)
        .setResolution(1);

      const zone = this.add.zone((x + cityX) / 2, (y + cityY) / 2, 40 + Math.abs(dx), 48).setInteractive({ useHandCursor: open });
      zone.on('pointerup', () => {
        if (!open) return;
        const docked = this.distance === this.stops[this.target];
        if (docked && this.target === index) this.enter();
        else this.sailTo(index);
      });
    });
  }

  private showFinale() {
    this.add
      .text(SCREEN_WIDTH - 70, 62, 'Путь пройден!', { ...TEXT, color: '#f2d48a' })
      .setOrigin(0.5)
      .setResolution(1);
    const cta = this.add
      .text(SCREEN_WIDTH - 70, 80, 'Открыть сайт Гардарики', {
        ...TEXT,
        color: '#f2d48a',
        backgroundColor: '#111111',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setResolution(1)
      .setInteractive({ useHandCursor: true });
    cta.on('pointerup', () => window.open('https://gardariki-game.ru/', '_blank', 'noopener,noreferrer'));
  }
}
