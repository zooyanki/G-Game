import Phaser from 'phaser';
import {
  ENEMY_SPOTS,
  HERO_START,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SHIP_POSITION,
  ENEMY_LIVES,
  SLASH_MS,
  SPRITE,
  WALL,
  WATER,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../constants';
import { Arrow } from '../entities/Arrow';
import { Enemy } from '../entities/Enemy';
import { Hero } from '../entities/Hero';
import { heroTexture } from '../textures';
import { input } from '../input/InputState';
import { purse } from '../purse';
import { setRestartVisible } from '../input/touchControls';
import { createTextures } from '../textures';

type Outcome = 'victory' | 'dead' | null;

const FALLEN = [
  { x: 78, y: 915, texture: 'fallen', angle: -18 },
  { x: 242, y: 928, texture: 'fallen', angle: 24 },
  { x: 118, y: 948, texture: 'wounded', angle: 12 },
  { x: 214, y: 905, texture: 'wounded', angle: -8 },
];

/**
 * Первая сцена: берег, драккар за спиной, три врага впереди.
 * Корабль и берег — рисунок, сквозь них можно ходить. Стены — только скалы.
 */
export class ShoreScene extends Phaser.Scene {
  private swordsman!: Hero;
  private archer!: Hero;
  /** Жизни общие на двоих, поэтому лежат в сцене, а не в одном из героев. */
  private lives = 0;
  /** Кто сейчас слушает стрелки. Второй стоит на месте. */
  private active!: Hero;
  private enemies: Enemy[] = [];
  private arrows: Arrow[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private banner!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];
  private coinLabel!: Phaser.GameObjects.Text;
  private portraits: Phaser.GameObjects.GameObject[] = [];
  private outcome: Outcome = null;

  constructor() {
    super('shore');
  }

  create() {
    input.clearTransient();
    setRestartVisible(false);
    this.outcome = null;

    createTextures(this);
    this.drawGround();
    this.drawShipAndFallen();

    this.swordsman = new Hero(this, HERO_START.x, HERO_START.y, 'sword');
    this.archer = new Hero(this, HERO_START.x, HERO_START.y, 'bow');
    this.lives = this.swordsman.lives;
    this.active = this.swordsman;
    this.archer.setVisible(false);
    (this.archer.body as Phaser.Physics.Arcade.Body).setEnable(false);

    this.enemies = ENEMY_SPOTS.map((spot) => new Enemy(this, spot.x, spot.y));
    this.arrows = [];

    const walls = this.buildWalls();
    this.physics.add.collider(this.party(), walls);
    this.physics.add.collider(this.enemies, walls);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.party(), this.enemies, (_hero, enemy) => {
      this.onHeroTouched(_hero as Hero, enemy as Enemy);
    });

    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.cameras.main.startFollow(this.active, true, 1, 1, 0, 50);
    this.cameras.main.setBackgroundColor('#c2a36b');

    this.createHud();
    this.bindKeyboard();
    this.drawHearts();
    this.drawPortraits();
  }

  update() {
    const now = this.time.now;
    this.active.tick(now);

    if (this.outcome === 'dead') {
      this.freeze();
      return;
    }

    if (this.outcome === 'victory') {
      this.freeze();
      const restart = Phaser.Input.Keyboard.JustDown(this.attackKey) || input.consumeRestart();
      if (restart) {
        purse.coins = 0;
        this.scene.restart();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.shiftKey) || input.consumeSwap()) this.swapHero();

    this.active.move(this.readMoveX(), this.readMoveY());

    const wantsAttack = this.attackKey.isDown || input.hasAttack();
    if (wantsAttack) {
      const shot = this.active.tryAttack(now);
      // Rectangle — из Phaser (один модуль). Arrow после HMR может быть
      // другим классом, и instanceof Arrow тогда ломает полёт.
      if (shot instanceof Phaser.Geom.Rectangle) this.swing(shot);
      else if (shot) this.arrows.push(shot);
      if (shot) input.clearAttack();
    }

    this.hitArrows();
    this.collectCoins();
    for (const enemy of this.enemies) enemy.chase(this.active.x, this.active.y);

    if (this.enemies.length > 0 && this.enemies.every((enemy) => !enemy.active)) this.onVictory();
  }

  private readMoveX() {
    let x = 0;
    if (this.cursors.left.isDown) x -= 1;
    if (this.cursors.right.isDown) x += 1;
    if (input.moveX !== 0 || input.moveY !== 0) x = input.moveX;
    return x;
  }

  private readMoveY() {
    let y = 0;
    if (this.cursors.up.isDown) y -= 1;
    if (this.cursors.down.isDown) y += 1;
    if (input.moveX !== 0 || input.moveY !== 0) y = input.moveY;
    return y;
  }

  /**
   * Попадание по всему отрезку кадра. Стрела двигается сама на update;
   * здесь только урон и уборка после попадания.
   */
  private hitArrows() {
    this.arrows = this.arrows.filter((arrow) => {
      if (!arrow.active) return false;

      const from = new Phaser.Geom.Line(arrow.prevX, arrow.prevY, arrow.x, arrow.y);
      const hit = this.enemies.find((enemy) => enemy.active && Phaser.Geom.Intersects.LineToRectangle(from, enemy.getBounds()));
      if (!hit) return true;

      hit.hurt(1);
      arrow.kill();
      return false;
    });
  }

  /** Монетка лежит на месте убитого врага и подбирается, когда герой на неё наступает. */
  private collectCoins() {
    const hero = this.active.getBounds();
    for (const coin of this.children.list) {
      if (!(coin instanceof Phaser.GameObjects.Image) || !coin.getData('coin')) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(hero, coin.getBounds())) continue;
      coin.destroy();
      purse.coins += 1;
      this.coinLabel.setText(String(purse.coins));
    }
  }

  private swing(slash: Phaser.Geom.Rectangle) {
    const mark = this.add.rectangle(slash.centerX, slash.centerY, slash.width, slash.height, 0xf4f0e6);
    mark.setDepth(11);
    this.time.delayedCall(SLASH_MS, () => mark.destroy());

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(slash, enemy.getBounds())) enemy.hurt(ENEMY_LIVES);
    }
  }

  /** Жизни общие: ранение любого из двоих снимает одно сердце отряда. */
  private onHeroTouched(hero: Hero, enemy: Enemy) {
    if (this.outcome || !enemy.active) return;
    if (!hero.hurt(this.time.now)) return;

    this.lives -= 1;
    this.drawHearts();
    this.cameras.main.flash(120, 160, 40, 40);
    if (this.lives > 0) return;

    this.outcome = 'dead';
    this.freeze();
    this.time.delayedCall(400, () => {
      purse.coins = 0;
      this.scene.restart();
    });
  }

  private onVictory() {
    this.outcome = 'victory';
    this.freeze();
    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    this.banner.setText(onPhone ? 'Победа' : 'Победа\nПробел — ещё раз');
    this.banner.setVisible(true);
    setRestartVisible(true);
  }

  private party() {
    return [this.swordsman, this.archer];
  }

  /** На экране остаётся один герой: второй встаёт на его место и перенимает взгляд. */
  private swapHero() {
    const next = this.active === this.swordsman ? this.archer : this.swordsman;
    next.setPosition(this.active.x, this.active.y);
    next.facing = this.active.facing;
    next.setTexture(heroTexture(next.kind, next.facing));

    this.active.halt();
    this.active.setVisible(false);
    (this.active.body as Phaser.Physics.Arcade.Body).setEnable(false);

    next.setVisible(true);
    (next.body as Phaser.Physics.Arcade.Body).setEnable(true);
    this.active = next;
    this.drawPortraits();
    this.cameras.main.startFollow(this.active, true, 1, 1, 0, 50);
  }

  private freeze() {
    this.active.halt();
    for (const enemy of this.enemies) enemy.setVelocity(0, 0);
  }

  private drawGround() {
    this.add.rectangle(WORLD_WIDTH / 2, 130, WORLD_WIDTH, 260, 0x3d5a38).setDepth(0);
    this.add.rectangle(WORLD_WIDTH / 2, 960, WORLD_WIDTH, 80, 0x2f4f6f).setDepth(0);
    this.add.rectangle(WORLD_WIDTH / 2, 920, WORLD_WIDTH, 2, 0x1d3348).setDepth(1);
  }

  private drawShipAndFallen() {
    this.add.image(SHIP_POSITION.x, SHIP_POSITION.y, 'ship').setDepth(2);
    for (const body of FALLEN) {
      this.add.image(body.x, body.y, body.texture).setAngle(body.angle).setDepth(3);
    }
  }

  private paintRocks() {
    for (let y = 0; y < WORLD_HEIGHT; y += SPRITE) {
      const key = y / SPRITE % 2 === 0 ? 'rock' : 'rock-alt';
      this.add.image(SPRITE / 2, y + SPRITE / 2, key).setDepth(5);
      this.add.image(SPRITE * 1.5, y + SPRITE / 2, key).setDepth(5);
      this.add.image(WORLD_WIDTH - SPRITE / 2, y + SPRITE / 2, key).setDepth(5);
      this.add.image(WORLD_WIDTH - SPRITE * 1.5, y + SPRITE / 2, key).setDepth(5);
    }
    for (let x = 0; x < WORLD_WIDTH; x += SPRITE) {
      this.add.image(x + SPRITE / 2, SPRITE / 2, 'rock').setDepth(5);
    }
  }

  private buildWalls() {
    this.paintRocks();
    return [
      this.wall(WALL / 2, WORLD_HEIGHT / 2, WALL, WORLD_HEIGHT),
      this.wall(WORLD_WIDTH - WALL / 2, WORLD_HEIGHT / 2, WALL, WORLD_HEIGHT),
      this.wall(WORLD_WIDTH / 2, SPRITE / 2, WORLD_WIDTH, SPRITE),
      this.wall(WATER.x, WATER.y, WATER.width, WATER.height),
    ];
  }

  private wall(x: number, y: number, width: number, height: number) {
    const block = this.add.rectangle(x, y, width, height, 0x000000, 0);
    this.physics.add.existing(block, true);
    return block;
  }

  private createHud() {
    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    if (!onPhone) {
      this.add
        .text(8, 46, 'Стрелки — идти, пробел — удар, Shift — сменить героя', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#f4f0e6',
        })
        .setScrollFactor(0)
        .setDepth(100)
        .setResolution(1);
    }

    this.coinLabel = this.add
      .text(SCREEN_WIDTH - 8, 8, String(purse.coins), {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#f2d48a',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1);

    this.banner = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.36, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f4f0e6',
        align: 'center',
        backgroundColor: '#111111',
        padding: { x: 8, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1)
      .setVisible(false);
  }

  /** Слева под сердцами: выбранный герой в яркой рамке, второй приглушён. */
  private drawPortraits() {
    for (const portrait of this.portraits) portrait.destroy();
    this.portraits = [];

    for (const [index, hero] of this.party().entries()) {
      const chosen = hero === this.active;
      const x = 12 + index * 20;

      if (chosen) {
        const frame = this.add.rectangle(x, 30, 18, 18, 0xf4f0e6);
        frame.setScrollFactor(0).setDepth(99);
        this.portraits.push(frame);
      }

      const portrait = this.add.image(x, 30, heroTexture(hero.kind, 'down'));
      portrait.setScrollFactor(0).setDepth(100);
      portrait.setAlpha(chosen ? 1 : 0.4);
      this.portraits.push(portrait);
    }
  }

  private drawHearts() {
    for (const heart of this.hearts) heart.destroy();
    this.hearts = [];
    for (let i = 0; i < this.lives; i += 1) {
      const heart = this.add.image(12 + i * 12, 12, 'heart');
      heart.setScrollFactor(0).setDepth(100);
      this.hearts.push(heart);
    }
  }

  private bindKeyboard() {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Клавиатура недоступна');
    this.cursors = keyboard.createCursorKeys();
    this.attackKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);
  }
}
