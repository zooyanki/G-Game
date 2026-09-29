import Phaser from 'phaser';
import {
  ARENA_COLS,
  BEAM_BOSS_DAMAGE,
  GRACE_MAX,
  GRACE_PER_DAMAGE,
  GRAVITY,
  POGO_SPEED,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SLASH_MS,
  SUPER_MS,
  TILE,
} from '../constants';
import { type Boss, bossTexture, createBoss } from '../bosses';
import { dev } from '../dev';
import { createEnemy, type Enemy, type EnemyContext, type EnemyKind } from '../enemies';
import { createHazard, type Hazard } from '../entities/hazards';
import { Hero, type Slash } from '../entities/Hero';
import { Projectile, type ProjectileOptions } from '../entities/Projectile';
import { Controls, type Frame } from '../input/controls';
import { setAttackLabel, setCardButtons, setSuperReady, setTouchMode } from '../input/touchControls';
import { buildLevel, type BuiltLevel } from '../levels/buildLevel';
import { LEVELS, type LevelDef } from '../levels/levels';
import { progress } from '../progress';
import { backdropTexture, createTextures, heroTexture, levelTiles, TILE_BOG, TILE_CRUMBLE, TILE_PLANK } from '../textures';
import { BLESSING_MS, showBlessingHand, strikeBeam } from './blessing';

export type LevelData = { levelId: string; checkpoint?: number };

type Outcome = 'dead' | 'victory' | null;
type Flag = { x: number; sprite: Phaser.GameObjects.Image };
/** Гнилая доска: когда начала трещать и когда вернётся. */
type Crumble = { tile: Phaser.Tilemaps.Tile; breakAt: number; backAt: number };

const TEXT = { fontFamily: 'monospace', fontSize: '8px', color: '#f4f0e6' };
/** Камера смотрит вперёд по бегу — видно, что летит навстречу. */
const LOOK_AHEAD = 60;
/** Шаг героя за край арены запирает её. */
const ARENA_LOCK_OFFSET = 40;
const GRACE_BAR_WIDTH = 26;
/** Трясина вдвое замедляет бег. */
const BOG_SPEED = 0.5;
/** Сколько гнилая доска держит и через сколько вырастает снова. */
const CRUMBLE_HOLD_MS = 450;
const CRUMBLE_BACK_MS = 3000;

/** Уровень в духе Cuphead: бег с боем слева направо, в конце арена главаря. */
export class LevelScene extends Phaser.Scene {
  private def!: LevelDef;
  private built!: BuiltLevel;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private controls!: Controls;
  private hero!: Hero;
  private enemies: Enemy[] = [];
  private hazards: Hazard[] = [];
  private crumbling: Crumble[] = [];
  private projectiles: Projectile[] = [];
  private coins: Phaser.GameObjects.Image[] = [];
  private flags: Flag[] = [];
  private boss: Boss | null = null;
  private checkpoint = -1;
  private safe = { x: 0, y: 0 };
  private coinsTaken = 0;
  private outcome: Outcome = null;
  private arenaLocked = false;
  private lookAhead = LOOK_AHEAD;
  /** Дальше влево камера уже не вернётся. */
  private scrollFloor = 0;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private hearts: Phaser.GameObjects.Image[] = [];
  private portraits: Phaser.GameObjects.Image[] = [];
  private coinLabel!: Phaser.GameObjects.Text;
  private card: Phaser.GameObjects.Container | null = null;
  private grace = 0;
  private superUntil = 0;
  private graceFill!: Phaser.GameObjects.Rectangle;
  private graceGlow: Phaser.Tweens.Tween | null = null;

  constructor() {
    super('level');
  }

  /** Главарь на виду: удар о него тратится, даже если сейчас он неуязвим. */
  private get bossTouchable() {
    return !!this.boss && !this.boss.dead && this.boss.visible && this.boss.alpha > 0.5;
  }

  create(data: LevelData) {
    const def = LEVELS.find((level) => level.id === data.levelId);
    if (!def) throw new Error(`Нет уровня ${data.levelId}`);
    this.def = def;
    this.built = buildLevel(def);
    const requested = Number.isInteger(data.checkpoint) ? Number(data.checkpoint) : -1;
    this.checkpoint = Phaser.Math.Clamp(requested, -1, this.built.checkpoints.length - 1);
    this.enemies = [];
    this.hazards = [];
    this.crumbling = [];
    this.projectiles = [];
    this.coins = [];
    this.flags = [];
    this.boss = null;
    this.coinsTaken = 0;
    this.outcome = null;
    this.arenaLocked = false;
    this.lookAhead = LOOK_AHEAD;
    this.scrollFloor = 0;
    this.card = null;
    this.grace = 0;
    this.superUntil = 0;
    this.graceGlow = null;

    createTextures(this);
    this.controls = new Controls(this);
    this.physics.world.gravity.y = GRAVITY;

    const { width, height } = this.built;
    // Низ открыт: иначе в пропасть не упасть.
    this.physics.world.setBounds(0, 0, width, height + TILE * 4, true, true, true, false);
    this.cameras.main.setBounds(0, 0, width, height);
    this.cameras.main.setBackgroundColor(def.palette.sky);

    this.far = this.add.tileSprite(0, SCREEN_HEIGHT - 150, SCREEN_WIDTH, 110, 'bg-hills');
    this.far.setOrigin(0).setScrollFactor(0).setTint(def.palette.far).setDepth(-2);
    this.near = this.add.tileSprite(0, SCREEN_HEIGHT - 110, SCREEN_WIDTH, 80, backdropTexture(def.backdrop));
    this.near.setOrigin(0).setScrollFactor(0).setTint(def.palette.near).setDepth(-1);

    this.createMap();

    const spawn = this.checkpoint >= 0 ? this.built.checkpoints[this.checkpoint] : this.built.start;
    this.safe = { ...spawn };
    this.hero = new Hero(this, spawn.x, spawn.y);
    this.physics.add.collider(this.hero, this.layer);

    this.spawnActors(spawn.x);
    this.cameras.main.startFollow(this.hero, true, 0.12, 0.12);
    this.cameras.main.setFollowOffset(-this.lookAhead, 0);

    this.createHud();
    setTouchMode('level');
    setAttackLabel('Меч');

    const intro = this.checkpoint >= 0 ? 'Знамя' : `${def.city}\n${def.title}`;
    this.flash(intro, 1600);
    if (this.checkpoint >= 0 && this.checkpoint === this.built.checkpoints.length - 1) this.lockArena();
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
      this.hero.arcade.setVelocityX(0);
      this.hero.glow(now);
    } else {
      if (frame.swapPressed && this.hero.swap(now)) {
        setAttackLabel(this.hero.kind === 'sword' ? 'Меч' : 'Лук');
        this.drawPortraits();
      }
      const speed = this.standingOn() === TILE_BOG ? BOG_SPEED : 1;
      this.hero.control(frame, now, (x, y) => this.solidAt(x, y, false), speed);
      this.attack(frame, now);
    }
    this.moveCamera(delta);
    this.updateCrumbling(now);

    const shoot = (x: number, y: number, options: ProjectileOptions) => this.spawnProjectile(x, y, options);
    const heroBottom = this.hero.arcade.bottom;
    const ctx: EnemyContext = {
      now,
      heroX: this.hero.x,
      // Целятся в грудь стоящему — присевший пропускает прямой выстрел над головой.
      heroY: heroBottom - 16,
      heroBottom,
      viewLeft: this.cameras.main.worldView.x,
      solidAt: (x, y) => this.solidAt(x, y, true),
      shoot,
    };
    for (const enemy of this.enemies) {
      if (enemy.active && enemy.y > this.built.height + TILE) enemy.disableBody(true, true);
      enemy.update(ctx);
    }
    for (const hazard of this.hazards) hazard.update({ now, heroX: this.hero.x, shoot });

    if (!this.arenaLocked && this.hero.x > this.built.arenaX + ARENA_LOCK_OFFSET) this.lockArena();
    this.boss?.think({ now, dt: delta / 1000, heroX: this.hero.x, heroY: ctx.heroY, heroBottom });

    this.stepProjectiles(delta, now);
    this.touchEnemies();
    this.checkFall(now);
    this.pickCoins();
    this.raiseFlags();
    this.rememberSafeGround();

    this.far.tilePositionX = this.cameras.main.scrollX * 0.2;
    this.near.tilePositionX = this.cameras.main.scrollX * 0.45;
  }

  private createMap() {
    const map = this.make.tilemap({ data: this.built.data, tileWidth: TILE, tileHeight: TILE });
    const key = levelTiles(this, this.def.id, this.def.palette);
    const tiles = map.addTilesetImage(key, key, TILE, TILE, 0, 0);
    if (!tiles) throw new Error('Тайлсет не загрузился');
    const layer = map.createLayer(0, tiles, 0, 0);
    if (!layer) throw new Error('Слой карты не создан');
    layer.setCollisionByExclusion([-1]);
    layer.forEachTile((tile) => {
      if (tile.index === TILE_PLANK || tile.index === TILE_CRUMBLE) tile.setCollision(false, false, true, false);
    });
    this.layer = layer;
  }

  private spawnActors(fromX: number) {
    for (const spot of this.built.enemies) {
      // После знамени враги позади уже побеждены.
      if (spot.x < fromX + TILE * 4) continue;
      this.addEnemy(spot.kind, spot.x, spot.y);
    }
    for (const spot of this.built.hazards) {
      if (spot.x < fromX + TILE * 4) continue;
      this.hazards.push(createHazard(this, spot.kind, spot.x, spot.y));
    }

    for (const spot of this.built.coins) {
      if (spot.x < fromX) continue;
      const coin = this.add.image(spot.x, spot.y, 'coin').setDepth(5);
      this.tweens.add({ targets: coin, y: spot.y - 2, duration: 500, yoyo: true, repeat: -1 });
      this.coins.push(coin);
    }

    this.built.checkpoints.forEach((spot, index) => {
      const lit = index <= this.checkpoint;
      const sprite = this.add.image(spot.x, spot.y - 12, lit ? 'flag-on' : 'flag-off').setDepth(4);
      this.flags.push({ x: spot.x, sprite });
    });
  }

  private addEnemy(kind: EnemyKind, x: number, feetY: number) {
    const enemy = createEnemy(this, kind, x, feetY);
    if (!enemy.flying) this.physics.add.collider(enemy, this.layer);
    this.enemies.push(enemy);
    return enemy;
  }

  /** Клетка под ногами героя, если он стоит. */
  private standingOn() {
    if (!this.hero.onGround) return -1;
    const body = this.hero.arcade;
    return this.layer.getTileAtWorldXY(body.center.x, body.bottom + 2)?.index ?? -1;
  }

  /** Гнилая доска трещит под героем, пропадает, а через время вырастает снова. */
  private updateCrumbling(now: number) {
    if (this.hero.onGround) {
      const body = this.hero.arcade;
      for (const x of [body.left + 1, body.right - 1]) {
        const tile = this.layer.getTileAtWorldXY(x, body.bottom + 2);
        if (!tile || tile.index !== TILE_CRUMBLE || this.crumbling.some((c) => c.tile === tile)) continue;
        this.crumbling.push({ tile, breakAt: now + CRUMBLE_HOLD_MS, backAt: 0 });
      }
    }

    this.crumbling = this.crumbling.filter((crumble) => {
      const { tile } = crumble;
      if (!crumble.backAt) {
        if (now < crumble.breakAt) {
          tile.alpha = Math.floor(now / 50) % 2 === 0 ? 1 : 0.6;
          return true;
        }
        tile.setCollision(false, false, false, false);
        tile.setVisible(false);
        this.puff(tile.getCenterX(), tile.pixelY + 2);
        crumble.backAt = now + CRUMBLE_BACK_MS;
        return true;
      }
      if (now < crumble.backAt) return true;
      // Не выращивать доску сквозь героя.
      const heroRect = this.heroRect();
      if (Phaser.Geom.Intersects.RectangleToRectangle(heroRect, new Phaser.Geom.Rectangle(tile.pixelX, tile.pixelY, TILE, TILE))) return true;
      tile.setCollision(false, false, true, false);
      tile.setVisible(true);
      tile.alpha = 1;
      return false;
    });
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
    for (const enemy of this.enemies) {
      if (!enemy.active || !Phaser.Geom.Intersects.RectangleToRectangle(rect, enemy.getBounds())) continue;
      hit = true;
      this.addGrace(this.hero.stats.sword);
      if (enemy.hurt(this.hero.stats.sword)) this.onEnemyKilled(enemy);
    }
    if (this.bossTouchable && Phaser.Geom.Intersects.RectangleToRectangle(rect, this.boss!.getBounds())) {
      hit = true;
      this.hitBoss(this.hero.stats.sword);
    }
    for (const shot of this.projectiles) {
      if (shot.friendly || !Phaser.Geom.Intersects.RectangleToRectangle(rect, shot.getBounds())) continue;
      if (shot.reflect()) hit = true;
    }

    if (hit) {
      this.cameras.main.shake(60, 0.004);
      if (slash.down) this.hero.bounce(POGO_SPEED);
    }
  }

  private stepProjectiles(delta: number, now: number) {
    const bounds = this.physics.world.bounds;
    const flying = this.projectiles.filter((shot) => {
      if (!shot.active) return false;
      if (shot.expired(now)) {
        shot.destroy();
        return false;
      }
      shot.step(delta);

      const gone = shot.x < bounds.x - 16 || shot.x > bounds.right + 16 || shot.y > this.built.height + 16 || shot.y < -64;
      if (gone || (!shot.ignoreTiles && !this.touchGround(shot, now))) {
        this.puff(shot.x, shot.y);
        shot.destroy();
        return false;
      }

      return shot.friendly ? this.hitFoes(shot) : this.hitHero(shot);
    });
    // Попадание могло закончить бой и убрать все снаряды посреди обхода.
    this.projectiles = flying.filter((shot) => shot.active);
  }

  /**
   * Снаряд и земля. false — разбился. Бревно и валун, упав сверху, катятся
   * (и по доскам тоже), с края снова падают, о стену разбиваются; огненный шар догорает на месте.
   */
  private touchGround(shot: Projectile, now: number) {
    const half = shot.displayHeight / 2;
    if (shot.rolling) {
      const ahead = shot.x + Math.sign(shot.vx) * (shot.displayWidth / 2);
      if (this.solidAt(ahead, shot.y, false)) return false;
      if (!this.solidAt(shot.x, shot.y + half + 2, true)) shot.drop();
      return true;
    }
    if (!this.solidAt(shot.x, shot.y, false)) {
      // Доски пропускают снаряды, но катящееся бревно на них ложится.
      if (!shot.settles || shot.vy <= 0 || !this.solidAt(shot.x, shot.y + half, true)) return true;
      const tile = this.layer.getTileAtWorldXY(shot.x, shot.y + half);
      if (!tile || shot.prevY + half > tile.pixelY + 2) return true;
      return shot.land(tile.pixelY, now) || false;
    }
    const tile = this.layer.getTileAtWorldXY(shot.x, shot.y);
    // Сбоку или снизу — разбился; сверху — решает сам снаряд.
    if (!tile || shot.vy <= 0 || shot.prevY > tile.pixelY + 2) return false;
    return shot.land(tile.pixelY, now);
  }

  /** false — снаряд израсходован. */
  private hitFoes(shot: Projectile) {
    const path = shot.path();
    for (const enemy of this.enemies) {
      if (!enemy.active || !Phaser.Geom.Intersects.LineToRectangle(path, enemy.getBounds())) continue;
      if (enemy.blocksArrow(shot.vx, shot.vy)) {
        this.puff(shot.x, shot.y);
      } else {
        this.addGrace(shot.damage);
        if (enemy.hurt(shot.damage)) this.onEnemyKilled(enemy);
      }
      shot.destroy();
      return false;
    }
    if (this.bossTouchable && Phaser.Geom.Intersects.LineToRectangle(path, this.boss!.getBounds())) {
      this.hitBoss(shot.damage);
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

  private touchEnemies() {
    if (this.hero.invulnerable) return;
    const heroRect = this.heroRect();
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const body = enemy.arcade;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(heroRect, new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height))) continue;
      this.hurtHero(enemy.x);
      return;
    }
    if (this.boss?.harmful) {
      const body = this.boss.arcade;
      if (Phaser.Geom.Intersects.RectangleToRectangle(heroRect, new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height))) {
        this.hurtHero(this.boss.x);
      }
    }
  }

  /** Тело, а не спрайт: в приседе оно вдвое ниже картинки. */
  private heroRect() {
    const body = this.hero.arcade;
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  private hurtHero(fromX: number) {
    if (!this.hero.hurt(fromX, this.time.now)) return;
    this.cameras.main.flash(120, 160, 40, 40);
    this.cameras.main.shake(120, 0.006);
    this.drawHearts();
    if (this.hero.hp <= 0) this.onDeath();
  }

  private checkFall(now: number) {
    if (this.hero.y < this.built.height + TILE) return;
    this.hero.fell(this.safe, now);
    this.cameras.main.flash(120, 160, 40, 40);
    this.drawHearts();
    if (this.hero.hp <= 0) this.onDeath();
  }

  /** Твёрдая опора под обеими ногами — сюда вернёт после падения в пропасть. */
  private rememberSafeGround() {
    if (!this.hero.onGround) return;
    const body = this.hero.arcade;
    const below = body.bottom + 2;
    // Гнилая доска не годится: вернёт на неё, а она уже осыпалась.
    const firm = (x: number) => this.solidAt(x, below, true) && this.layer.getTileAtWorldXY(x, below)?.index !== TILE_CRUMBLE;
    if (firm(body.left + 1) && firm(body.right - 1)) {
      this.safe = { x: this.hero.x, y: body.bottom };
    }
  }

  /** Доски пропускают снаряды, но держат ноги. */
  private solidAt(x: number, y: number, planksCount: boolean) {
    const tile = this.layer.getTileAtWorldXY(x, y);
    // Осыпавшаяся доска остаётся в карте, но уже ничего не держит.
    if (!tile || tile.index < 0 || !tile.collides) return false;
    return planksCount || (tile.index !== TILE_PLANK && tile.index !== TILE_CRUMBLE);
  }

  private onEnemyKilled(enemy: Enemy) {
    this.puff(enemy.x, enemy.y);
    const coin = this.add.image(enemy.x, enemy.y, 'coin').setDepth(5);
    this.tweens.add({ targets: coin, y: enemy.y - 10, duration: 250, yoyo: true, ease: 'Sine.easeOut' });
    this.coins.push(coin);
  }

  /** `charge` — копит ли удар благодать: сам луч шкалу не наполняет. */
  private hitBoss(damage: number, charge = true) {
    if (!this.boss) return;
    if (charge && this.boss.vulnerable) this.addGrace(damage);
    if (this.boss.hurt(damage)) this.onBossDefeated();
  }

  private addGrace(damage: number) {
    if (this.grace >= GRACE_MAX) return;
    this.grace = Math.min(GRACE_MAX, this.grace + damage * GRACE_PER_DAMAGE * this.hero.stats.grace);
    this.drawGrace();
    if (this.grace >= GRACE_MAX) {
      const onPhone = window.matchMedia('(pointer: coarse)').matches;
      this.flash(onPhone ? 'Луч готов!' : 'Луч готов! (V)', 900);
    }
  }

  /** Супер-удар: вспышка, лучи на всех в кадре, затем рука с поднятым пальцем. */
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
    const groundY = this.built.height - TILE * 2;
    let struck = 0;

    for (const enemy of this.enemies) {
      if (!enemy.active || !view.contains(enemy.x, enemy.y)) continue;
      strikeBeam(this, enemy.x, enemy.arcade.bottom);
      struck += 1;
      if (enemy.hurt(99)) this.onEnemyKilled(enemy);
    }
    if (this.boss?.vulnerable && view.contains(this.boss.x, this.boss.y)) {
      strikeBeam(this, this.boss.x, this.boss.arcade.bottom, this.boss);
      struck += 1;
      this.hitBoss(BEAM_BOSS_DAMAGE, false);
    }
    // Врагов в кадре нет — лучи всё равно падают, чтобы удар не пропал впустую на вид.
    if (struck === 0) {
      for (const share of [0.25, 0.5, 0.75]) strikeBeam(this, view.x + view.width * share, groundY);
    }

    for (const shot of this.projectiles) {
      if (shot.friendly || !view.contains(shot.x, shot.y)) continue;
      this.puff(shot.x, shot.y);
      shot.destroy();
    }
    this.cameras.main.shake(300, 0.01);
  }

  private drawGrace() {
    const ready = this.grace >= GRACE_MAX;
    this.graceFill.width = GRACE_BAR_WIDTH * (this.grace / GRACE_MAX);
    this.graceFill.setFillStyle(ready ? 0xfff4c8 : 0xf2d48a);
    this.graceGlow?.stop();
    this.graceFill.setAlpha(1);
    this.graceGlow = ready
      ? this.tweens.add({ targets: this.graceFill, alpha: 0.4, duration: 350, yoyo: true, repeat: -1 })
      : null;
    setSuperReady(ready);
  }

  private lockArena() {
    this.arenaLocked = true;
    const left = this.built.arenaX;
    const width = ARENA_COLS * TILE;
    this.physics.world.setBounds(left, 0, width, this.built.height + TILE * 4, true, true, true, false);
    this.cameras.main.stopFollow();
    this.cameras.main.pan(left + width / 2, this.built.height / 2, 400, 'Sine.easeInOut');
    this.cameras.main.setBounds(left, 0, width, this.built.height);

    const ground = this.built.height - TILE * 2;
    this.boss = createBoss(this, this.def.boss, {
      spawn: (x, y, options) => this.spawnProjectile(x, y, options),
      summon: (kind, x, feetY) => this.addEnemy(kind, x, feetY).summon(),
      shake: (ms, intensity) => this.cameras.main.shake(ms, intensity),
      arena: { left, right: left + width, ground },
    });
    // Змей летает и сквозь доски: коллизия с картой только у тех, кто ходит.
    if (this.boss.arcade.allowGravity) this.physics.add.collider(this.boss, this.layer);
    this.flash(this.def.boss.name, 1400);
  }

  private spawnProjectile(x: number, y: number, options: ProjectileOptions) {
    this.projectiles.push(new Projectile(this, x, y, options));
  }

  private moveCamera(delta: number) {
    if (this.arenaLocked) return;
    const camera = this.cameras.main;
    const target = this.hero.facing * LOOK_AHEAD;
    this.lookAhead += (target - this.lookAhead) * Math.min(1, delta / 400);
    camera.setFollowOffset(-this.lookAhead, 0);

    // Как в Cuphead: кадр едет только вперёд, левый край экрана — стена.
    if (camera.scrollX <= this.scrollFloor) return;
    this.scrollFloor = camera.scrollX;
    const { width, height } = this.built;
    camera.setBounds(this.scrollFloor, 0, width - this.scrollFloor, height);
    this.physics.world.setBounds(this.scrollFloor, 0, width - this.scrollFloor, height + TILE * 4, true, true, true, false);
  }

  private pickCoins() {
    const heroRect = this.hero.getBounds();
    this.coins = this.coins.filter((coin) => {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(heroRect, coin.getBounds())) return true;
      coin.destroy();
      this.coinsTaken += 1;
      this.coinLabel.setText(String(this.coinsTaken));
      return false;
    });
  }

  private raiseFlags() {
    this.flags.forEach((flag, index) => {
      if (index <= this.checkpoint || this.hero.x < flag.x) return;
      this.checkpoint = index;
      flag.sprite.setTexture('flag-on');
      if (index < this.flags.length - 1) this.flash('Знамя поднято', 900);
    });
  }

  private puff(x: number, y: number) {
    const puff = this.add.image(x, y, 'puff').setDepth(13);
    this.tweens.add({ targets: puff, scale: 2, alpha: 0, duration: 200, onComplete: () => puff.destroy() });
  }

  private onDeath() {
    this.outcome = 'dead';
    this.hero.halt();
    this.freezeActors();

    const road = Phaser.Math.Clamp(this.hero.x / this.built.arenaX, 0, 1);
    const share = this.boss ? 0.75 + this.boss.beaten * 0.25 : road * 0.75;
    this.time.delayedCall(500, () => this.showDeathCard(share));
  }

  private onBossDefeated() {
    this.outcome = 'victory';
    this.hero.halt();
    this.freezeActors();
    this.cameras.main.shake(600, 0.012);

    const boss = this.boss;
    if (boss) {
      for (let i = 0; i < 6; i += 1) {
        this.time.delayedCall(i * 120, () => this.puff(boss.x + Phaser.Math.Between(-16, 16), boss.y + Phaser.Math.Between(-16, 16)));
      }
      this.tweens.add({ targets: boss, alpha: 0, delay: 700, duration: 500 });
    }

    progress.complete(this.def.id, this.coinsTaken);
    this.time.delayedCall(1400, () => this.showVictoryCard());
  }

  private freezeActors() {
    for (const enemy of this.enemies) if (enemy.active) enemy.arcade.setVelocity(0, 0).setAllowGravity(false);
    if (this.boss) this.boss.arcade.setVelocity(0, 0).setAllowGravity(false);
    for (const shot of this.projectiles) shot.destroy();
    this.projectiles = [];
  }

  private showDeathCard(share: number) {
    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    const card = this.cardFrame('Павший', onPhone ? '' : 'Пробел — ещё раз, Esc — к реке');

    const barWidth = 160;
    card.add(this.add.rectangle(-barWidth / 2, 4, barWidth, 6, 0x3a2e2e).setOrigin(0, 0.5));
    card.add(this.add.rectangle(-barWidth / 2, 4, barWidth * share, 6, 0xc23b3b).setOrigin(0, 0.5));
    card.add(this.add.image(-barWidth / 2 + barWidth * share, -6, heroTexture(this.hero.kind, 'stand')).setScale(0.75));
    card.add(this.add.image(barWidth / 2, -6, bossTexture(this.def.boss.kind)).setScale(0.35));
    card.add(this.add.text(0, 16, `Пройдено ${Math.round(share * 100)}%`, TEXT).setOrigin(0.5).setResolution(1));

    setCardButtons('Ещё раз', 'К реке');
    setTouchMode('card');
  }

  private showVictoryCard() {
    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    const card = this.cardFrame(`${this.def.city} свободна!`, onPhone ? '' : 'Пробел — к драккару');
    card.add(this.add.image(-12, 6, 'coin'));
    card.add(this.add.text(-4, 6, `+${this.coinsTaken}`, { ...TEXT, color: '#f2d48a' }).setOrigin(0, 0.5).setResolution(1));
    setCardButtons(null, 'К драккару');
    setTouchMode('card');
  }

  private cardFrame(title: string, hint: string) {
    const card = this.add.container(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.42).setScrollFactor(0).setDepth(200);
    card.add(this.add.rectangle(0, 0, 220, 76, 0x111111, 0.92));
    card.add(this.add.text(0, -24, title, { ...TEXT, fontSize: '14px' }).setOrigin(0.5).setResolution(1));
    if (hint) card.add(this.add.text(0, 30, hint, { ...TEXT, color: '#9aa0a6' }).setOrigin(0.5).setResolution(1));
    this.card = card;
    return card;
  }

  private handleCard(frame: Frame) {
    if (!this.card) return;
    if (this.outcome === 'dead') {
      if (frame.confirmPressed) this.scene.restart({ levelId: this.def.id, checkpoint: this.checkpoint } satisfies LevelData);
      else if (frame.backPressed) this.toRiver();
      return;
    }
    if (frame.confirmPressed || frame.backPressed) this.toRiver();
  }

  private toRiver() {
    this.scene.start('river');
  }

  private createHud() {
    this.hearts = [];
    this.portraits = [];
    this.drawHearts();
    this.drawPortraits();

    this.add.image(8, 22, 'grace').setScrollFactor(0).setDepth(100);
    this.add
      .rectangle(14, 22, GRACE_BAR_WIDTH, 4, 0x3a2e2e)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100);
    this.graceFill = this.add.rectangle(14, 22, 0, 4, 0xf2d48a).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);
    this.drawGrace();

    this.add.image(SCREEN_WIDTH - 36, 10, 'coin').setScrollFactor(0).setDepth(100);
    this.coinLabel = this.add
      .text(SCREEN_WIDTH - 28, 10, '0', { ...TEXT, color: '#f2d48a' })
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1);

    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    if (!onPhone && this.checkpoint < 0) {
      const help = this.add
        .text(8, SCREEN_HEIGHT - 12, '←→ бег  ↑ прицел  ↓ присесть  Z прыжок  X атака  Shift смена  V луч', TEXT)
        .setScrollFactor(0)
        .setDepth(100)
        .setResolution(1);
      this.tweens.add({ targets: help, alpha: 0, delay: 6000, duration: 800 });
    }

    if (import.meta.env.DEV) this.createGodToggle();
  }

  /** Только в dev: G включает и выключает бессмертие (надпись под сердцами), B наполняет шкалу луча. */
  private createGodToggle() {
    const label = this.add
      .text(8, 30, 'БЕССМЕРТИЕ (G)', { ...TEXT, color: '#f2d48a' })
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1)
      .setVisible(dev.god);
    this.input.keyboard?.on('keydown-G', () => {
      dev.god = !dev.god;
      label.setVisible(dev.god);
    });
    this.input.keyboard?.on('keydown-B', () => this.addGrace(GRACE_MAX));
  }

  private drawHearts() {
    for (const heart of this.hearts) heart.destroy();
    this.hearts = [];
    for (let i = 0; i < this.hero.maxHp; i += 1) {
      const key = i < this.hero.hp ? 'heart' : 'heart-empty';
      this.hearts.push(this.add.image(10 + i * 11, 10, key).setScrollFactor(0).setDepth(100));
    }
  }

  private drawPortraits() {
    for (const portrait of this.portraits) portrait.destroy();
    this.portraits = [];
    (['sword', 'bow'] as const).forEach((kind, index) => {
      const chosen = kind === this.hero.kind;
      const portrait = this.add.image(12 + this.hero.maxHp * 11 + index * 16, 14, heroTexture(kind, 'stand'));
      portrait.setScrollFactor(0).setDepth(100).setAlpha(chosen ? 1 : 0.35).setScale(chosen ? 1 : 0.8);
      this.portraits.push(portrait);
    });
  }

  private flash(text: string, ms: number) {
    const label = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.3, text, {
        ...TEXT,
        fontSize: '14px',
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
