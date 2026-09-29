import Phaser from 'phaser';
import {
  GRACE_MAX,
  GRACE_PER_DAMAGE,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SLASH_MS,
  SUPER_MS,
  TILE,
} from '../constants';
import { BLESSING_MS, showBlessingHand, strikeBeam } from './blessing';
import { dev } from '../dev';
import { Hero, type Slash } from '../entities/Hero';
import { Projectile, type ProjectileOptions } from '../entities/Projectile';
import { Controls, type Frame } from '../input/controls';
import { setAttackLabel, setCardButtons, setSuperReady, setTouchMode } from '../input/touchControls';
import type { CityId } from '../loot';
import { LEVELS } from '../levels/levels';
import { progress } from '../progress';
import { SORTIES } from '../sorties/maps';
import { Raider } from '../sorties/raiders';
import { backdropTexture, createTextures, levelTiles } from '../textures';

export type SortieData = { cityId: string };

type Outcome = 'dead' | 'victory' | null;

const TEXT = { fontFamily: 'monospace', fontSize: '8px', color: '#f4f0e6' };
const GRACE_BAR_WIDTH = 26;

/** Вылазка: вид сверху, икона и лут, без главаря. */
export class SortieScene extends Phaser.Scene {
  private cityId!: CityId;
  private controls!: Controls;
  private hero!: Hero;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private foes: Raider[] = [];
  private projectiles: Projectile[] = [];
  private chests: Phaser.GameObjects.Image[] = [];
  private relic: Phaser.GameObjects.Image | null = null;
  private gate!: Phaser.GameObjects.Image;
  private outcome: Outcome = null;
  private card: Phaser.GameObjects.Container | null = null;
  private silver = 0;
  private lootName: string | null = null;
  private tookRelic = false;
  private grace = 0;
  private superUntil = 0;
  private graceFill!: Phaser.GameObjects.Rectangle;
  private hearts: Phaser.GameObjects.Image[] = [];
  private silverLabel!: Phaser.GameObjects.Text;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;

  constructor() {
    super('sortie');
  }

  create(data: SortieData) {
    const city = data.cityId as CityId;
    const def = LEVELS.find((level) => level.id === city);
    const raid = SORTIES[city];
    if (!def || !raid) throw new Error(`Нет вылазки ${data.cityId}`);
    this.cityId = city;
    createTextures(this);
    this.controls = new Controls(this);

    const mapData = raid.map;
    this.foes = [];
    this.projectiles = [];
    this.chests = [];
    this.outcome = null;
    this.card = null;
    this.silver = 0;
    this.lootName = null;
    this.tookRelic = false;
    this.grace = 0;
    this.superUntil = 0;

    this.cameras.main.setBackgroundColor(def.palette.sky);
    this.cameras.main.setBounds(0, 0, mapData.width, mapData.height);
    this.physics.world.setBounds(0, 0, mapData.width, mapData.height);

    this.far = this.add.tileSprite(0, SCREEN_HEIGHT - 150, SCREEN_WIDTH, 110, 'bg-hills').setOrigin(0).setScrollFactor(0).setTint(def.palette.far).setDepth(-2);
    this.near = this.add.tileSprite(0, SCREEN_HEIGHT - 110, SCREEN_WIDTH, 80, backdropTexture(def.backdrop)).setOrigin(0).setScrollFactor(0).setTint(def.palette.near).setDepth(-1);

    const map = this.make.tilemap({ data: mapData.data, tileWidth: TILE, tileHeight: TILE });
    const key = levelTiles(this, def.id, def.palette);
    const tiles = map.addTilesetImage(key, key, TILE, TILE, 0, 0);
    if (!tiles) throw new Error('Тайлсет не загрузился');
    const layer = map.createLayer(0, tiles, 0, 0);
    if (!layer) throw new Error('Слой карты не создан');
    layer.setCollision(3);
    this.layer = layer;

    this.hero = new Hero(this, mapData.start.x, mapData.start.y, true);
    this.physics.add.collider(this.hero, this.layer);

    for (const spot of mapData.enemies) {
      const foe = new Raider(this, spot.x, spot.y, spot.kind);
      this.physics.add.collider(foe, this.layer);
      this.foes.push(foe);
    }
    for (const chest of mapData.chests) {
      this.chests.push(this.add.image(chest.x, chest.y, 'chest').setDepth(5));
    }
    if (mapData.relic && !progress.relic) this.relic = this.add.image(mapData.relic.x, mapData.relic.y, 'relic').setDepth(6);
    this.gate = this.add.image(mapData.exit.x, mapData.exit.y, 'exit').setDepth(5);
    this.lockGate();

    this.cameras.main.startFollow(this.hero, true, 0.15, 0.15);
    this.createHud();
    setTouchMode('sortie');
    setAttackLabel('Меч');
    this.flash(`${def.city}\n${raid.title}`, 1400);
  }

  update(_time: number, delta: number) {
    const now = this.time.now;
    const frame = this.controls.read();
    if (this.outcome) {
      this.handleCard(frame);
      return;
    }

    if (frame.superPressed) this.castSuper(now);
    if (now < this.superUntil) {
      this.hero.arcade.setVelocity(0, 0);
      this.hero.glow(now);
    } else {
      if (frame.swapPressed && this.hero.swap(now)) {
        setAttackLabel(this.hero.kind === 'sword' ? 'Меч' : 'Лук');
      }
      this.hero.steer(frame, now);
      this.attack(frame, now);
    }

    const shoot = (x: number, y: number, options: ProjectileOptions) => this.spawn(x, y, options);
    for (const foe of this.foes) foe.update({ now, heroX: this.hero.x, heroY: this.hero.y, shoot });

    this.stepShots(delta, now);
    this.touchFoes();
    this.pickChests();
    this.pickRelic();
    this.tryExit();

    this.far.tilePositionX = this.cameras.main.scrollX * 0.2;
    this.near.tilePositionX = this.cameras.main.scrollX * 0.45;
  }

  private lockGate() {
    const open = !!progress.relic || this.tookRelic;
    this.gate.setAlpha(open ? 1 : 0.35);
  }

  private attack(frame: Frame, now: number) {
    if (!frame.attackHeld) return;
    const attack = this.hero.tryAttack(frame, now);
    if (!attack) return;
    if ('arrow' in attack) this.projectiles.push(attack.arrow);
    else this.swing(attack.slash);
  }

  private swing(slash: Slash) {
    const { rect } = slash;
    const mark = this.add.image(rect.centerX, rect.centerY, 'slash').setDepth(12).setRotation(slash.angle);
    this.tweens.add({ targets: mark, alpha: 0, duration: SLASH_MS, onComplete: () => mark.destroy() });
    let hit = false;
    for (const foe of this.foes) {
      if (!foe.active || !Phaser.Geom.Intersects.RectangleToRectangle(rect, foe.getBounds())) continue;
      hit = true;
      this.addGrace(this.hero.stats.sword);
      if (foe.hurt(this.hero.stats.sword)) this.kill(foe);
    }
    for (const shot of this.projectiles) {
      if (shot.friendly || !Phaser.Geom.Intersects.RectangleToRectangle(rect, shot.getBounds())) continue;
      if (shot.reflect()) hit = true;
    }
    if (hit) this.cameras.main.shake(60, 0.004);
  }

  private stepShots(delta: number, now: number) {
    const bounds = this.physics.world.bounds;
    const flying = this.projectiles.filter((shot) => {
      if (!shot.active) return false;
      if (shot.expired(now)) {
        shot.destroy();
        return false;
      }
      shot.step(delta);
      const gone = shot.x < bounds.x - 16 || shot.x > bounds.right + 16 || shot.y < bounds.y - 16 || shot.y > bounds.bottom + 16;
      if (gone || this.solidAt(shot.x, shot.y)) {
        this.puff(shot.x, shot.y);
        shot.destroy();
        return false;
      }
      return shot.friendly ? this.hitFoes(shot) : this.hitHero(shot);
    });
    this.projectiles = flying.filter((shot) => shot.active);
  }

  private hitFoes(shot: Projectile) {
    const path = shot.path();
    for (const foe of this.foes) {
      if (!foe.active || !Phaser.Geom.Intersects.LineToRectangle(path, foe.getBounds())) continue;
      if (foe.blocksArrow(shot.vx, shot.vy)) this.puff(shot.x, shot.y);
      else {
        this.addGrace(shot.damage);
        if (foe.hurt(shot.damage)) this.kill(foe);
      }
      shot.destroy();
      return false;
    }
    return true;
  }

  private hitHero(shot: Projectile) {
    if (!Phaser.Geom.Intersects.LineToRectangle(shot.path(), this.heroRect())) return true;
    this.hurtHero(shot.x);
    shot.destroy();
    return false;
  }

  private touchFoes() {
    if (this.hero.invulnerable) return;
    const rect = this.heroRect();
    for (const foe of this.foes) {
      if (!foe.active) continue;
      const body = foe.arcade;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height))) continue;
      this.hurtHero(foe.x);
      return;
    }
  }

  private heroRect() {
    const body = this.hero.arcade;
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  private hurtHero(fromX: number) {
    if (!this.hero.hurt(fromX, this.time.now)) return;
    this.cameras.main.flash(120, 160, 40, 40);
    this.drawHearts();
    if (this.hero.hp <= 0) this.onDeath();
  }

  private solidAt(x: number, y: number) {
    const tile = this.layer.getTileAtWorldXY(x, y);
    return !!tile && tile.index >= 0 && tile.collides;
  }

  private kill(foe: Raider) {
    this.puff(foe.x, foe.y);
    this.silver += 1;
    this.silverLabel.setText(String(this.silver));
    const coin = this.add.image(foe.x, foe.y, 'coin').setDepth(5);
    this.tweens.add({ targets: coin, y: foe.y - 8, alpha: 0, duration: 280, onComplete: () => coin.destroy() });
  }

  private pickChests() {
    const rect = this.hero.getBounds();
    this.chests = this.chests.filter((chest) => {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, chest.getBounds())) return true;
      chest.destroy();
      this.silver += 4;
      this.silverLabel.setText(String(this.silver));
      const drop = progress.rollDrop(this.cityId);
      if (drop) {
        const got = progress.grant(drop.id);
        if (got) {
          this.lootName = drop.name;
          this.flash(`${drop.name}\n${got === 'equip' ? 'надето' : 'в запас'}`, 1200);
        } else this.flash('Запас полон', 800);
      }
      return false;
    });
  }

  private pickRelic() {
    if (!this.relic || !this.relic.active) return;
    if (!Phaser.Geom.Intersects.RectangleToRectangle(this.hero.getBounds(), this.relic.getBounds())) return;
    if (!progress.takeRelic(this.cityId)) return;
    this.tookRelic = true;
    this.relic.destroy();
    this.relic = null;
    this.lockGate();
    this.flash('Икона', 900);
  }

  private tryExit() {
    if (!progress.relic && !this.tookRelic) return;
    if (Phaser.Math.Distance.Between(this.hero.x, this.hero.y, this.gate.x, this.gate.y) > 14) return;
    this.onWin();
  }

  private addGrace(damage: number) {
    if (this.grace >= GRACE_MAX) return;
    this.grace = Math.min(GRACE_MAX, this.grace + damage * GRACE_PER_DAMAGE * this.hero.stats.grace);
    this.drawGrace();
    if (this.grace >= GRACE_MAX) this.flash('Луч готов!', 700);
  }

  private castSuper(now: number) {
    if (this.grace < GRACE_MAX || now < this.superUntil) return;
    this.grace = 0;
    this.drawGrace();
    this.superUntil = now + SUPER_MS;
    this.hero.protect(now, SUPER_MS + BLESSING_MS);
    this.cameras.main.flash(250, 255, 244, 200);
    this.time.delayedCall(250, () => this.rainBeams());
    this.time.delayedCall(SUPER_MS, () => showBlessingHand(this));
  }

  private rainBeams() {
    const view = this.cameras.main.worldView;
    let struck = 0;
    for (const foe of this.foes) {
      if (!foe.active || !view.contains(foe.x, foe.y)) continue;
      strikeBeam(this, foe.x, foe.arcade.bottom);
      struck += 1;
      if (foe.hurt(99)) this.kill(foe);
    }
    if (struck === 0) {
      for (const share of [0.25, 0.5, 0.75]) strikeBeam(this, view.x + view.width * share, view.y + view.height * 0.7);
    }
    for (const shot of this.projectiles) {
      if (shot.friendly || !view.contains(shot.x, shot.y)) continue;
      this.puff(shot.x, shot.y);
      shot.destroy();
    }
    this.cameras.main.shake(300, 0.01);
  }

  private spawn(x: number, y: number, options: ProjectileOptions) {
    this.projectiles.push(new Projectile(this, x, y, options));
  }

  private puff(x: number, y: number) {
    const puff = this.add.image(x, y, 'puff').setDepth(13);
    this.tweens.add({ targets: puff, scale: 2, alpha: 0, duration: 200, onComplete: () => puff.destroy() });
  }

  private freeze() {
    this.hero.arcade.setVelocity(0, 0);
    for (const foe of this.foes) if (foe.active) foe.arcade.setVelocity(0, 0);
    for (const shot of this.projectiles) shot.destroy();
    this.projectiles = [];
  }

  private onDeath() {
    this.outcome = 'dead';
    this.freeze();
    if (this.tookRelic) progress.loseRelic();
    this.time.delayedCall(400, () => {
      const card = this.cardFrame('Павший', 'Серебро вылазки сгорело');
      card.add(this.add.text(0, 8, `потеряно ${this.silver}с`, TEXT).setOrigin(0.5).setResolution(1));
      setCardButtons('Ещё раз', 'К причалу');
      setTouchMode('card');
    });
  }

  private onWin() {
    this.outcome = 'victory';
    this.freeze();
    progress.finishSortie(this.cityId, this.silver);
    this.time.delayedCall(400, () => {
      const extra = this.lootName ? `\n${this.lootName}` : '';
      const card = this.cardFrame('Вылазка', this.tookRelic ? 'Икона с тобой' : 'Выход');
      card.add(this.add.text(0, 8, `+${this.silver}с${extra}`, { ...TEXT, color: '#f2d48a' }).setOrigin(0.5).setResolution(1));
      setCardButtons(null, 'К причалу');
      setTouchMode('card');
    });
  }

  private cardFrame(title: string, hint: string) {
    const card = this.add.container(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.42).setScrollFactor(0).setDepth(200);
    card.add(this.add.rectangle(0, 0, 220, 76, 0x111111, 0.92));
    card.add(this.add.text(0, -22, title, { ...TEXT, fontSize: '14px' }).setOrigin(0.5).setResolution(1));
    if (hint) card.add(this.add.text(0, 24, hint, { ...TEXT, color: '#9aa0a6' }).setOrigin(0.5).setResolution(1));
    this.card = card;
    return card;
  }

  private handleCard(frame: Frame) {
    if (!this.card) return;
    if (this.outcome === 'dead' && frame.confirmPressed) {
      this.scene.restart({ cityId: this.cityId } satisfies SortieData);
      return;
    }
    if (frame.confirmPressed || frame.backPressed) this.scene.start('dock', { cityId: this.cityId });
  }

  private createHud() {
    this.hearts = [];
    this.drawHearts();
    this.add.image(8, 22, 'grace').setScrollFactor(0).setDepth(100);
    this.add.rectangle(14, 22, GRACE_BAR_WIDTH, 4, 0x3a2e2e).setOrigin(0, 0.5).setScrollFactor(0).setDepth(100);
    this.graceFill = this.add.rectangle(14, 22, 0, 4, 0xf2d48a).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.drawGrace();
    this.add.image(SCREEN_WIDTH - 36, 10, 'coin').setScrollFactor(0).setDepth(100);
    this.silverLabel = this.add
      .text(SCREEN_WIDTH - 28, 10, '0', TEXT)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1);
    this.add.image(SCREEN_WIDTH - 20, 22, 'bandage').setScrollFactor(0).setDepth(100);
    this.add
      .text(SCREEN_WIDTH - 12, 22, String(progress.bandages), TEXT)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1);
    if (progress.equippedIn('neck')) this.add.image(SCREEN_WIDTH - 52, 10, 'relic').setScrollFactor(0).setDepth(100);
    if (import.meta.env.DEV) {
      this.input.keyboard?.on('keydown-G', () => {
        dev.god = !dev.god;
      });
      this.input.keyboard?.on('keydown-B', () => this.addGrace(GRACE_MAX));
    }
  }

  private drawHearts() {
    for (const heart of this.hearts) heart.destroy();
    this.hearts = [];
    for (let i = 0; i < this.hero.maxHp; i += 1) {
      const key = i < this.hero.hp ? 'heart' : 'heart-empty';
      this.hearts.push(this.add.image(10 + i * 11, 10, key).setScrollFactor(0).setDepth(100));
    }
  }

  private drawGrace() {
    const ready = this.grace >= GRACE_MAX;
    this.graceFill.width = GRACE_BAR_WIDTH * (this.grace / GRACE_MAX);
    this.graceFill.setFillStyle(ready ? 0xfff4c8 : 0xf2d48a);
    setSuperReady(ready);
  }

  private flash(text: string, ms: number) {
    const label = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.28, text, {
        ...TEXT,
        fontSize: '12px',
        align: 'center',
        backgroundColor: '#111111',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(150)
      .setResolution(1);
    this.tweens.add({ targets: label, alpha: 0, delay: ms, duration: 400, onComplete: () => label.destroy() });
  }
}
