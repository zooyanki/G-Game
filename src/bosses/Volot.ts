import Phaser from 'phaser';
import { Boss, type BossContext, type BossDef, type BossHooks } from './Boss';

type Mode = 'idle' | 'stomp-tell' | 'sweep-tell' | 'throw-tell';
type Move = 'stomp' | 'sweep' | 'throw';
type Sweep = 'low' | 'high';

/** Низкий взмах идёт по ногам — прыгай. Высокий на уровне груди — приседай. */
const SWEEP_HEIGHT: Record<Sweep, number> = { low: 5, high: 18 };
const SWEEP_SPEED = 270;
const ROCK_WARN_MS = 650;

/**
 * Смоленск. Волот-великан стоит у стены и не сходит с места, зато достаёт всю арену:
 * взмах дубиной низом или верхом (пригодятся и прыжок, и присед),
 * топот — с неба падают глыбы на тени, со второй фазы — катящийся валун.
 */
export class Volot extends Boss {
  private mode: Mode = 'idle';
  private modeUntil = 0;
  private lastMove: Move | null = null;
  private sweep: Sweep = 'low';
  private warning: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene, def: BossDef, hooks: BossHooks) {
    super(scene, hooks.arena.right - 26, hooks.arena.ground - 32, def, hooks);
    this.arcade.setSize(30, 58).setOffset(9, 6);
    this.setCollideWorldBounds(true);
    this.setFlipX(true);
    this.modeUntil = this.introUntil;
  }

  protected onDeath() {
    this.warning?.destroy();
  }

  think(ctx: BossContext) {
    if (this.dead) return;
    this.arcade.setVelocityX(0);

    if (ctx.now < this.modeUntil) {
      if (this.mode === 'stomp-tell') this.setScale(1, 1 + Math.sin(ctx.now / 60) * 0.03);
      return;
    }
    this.setScale(1);

    switch (this.mode) {
      case 'stomp-tell':
        this.tell(false);
        this.stomp(ctx);
        this.enter('idle', 1100 / this.tempo);
        return;
      case 'sweep-tell':
        this.tell(false);
        this.warning?.destroy();
        this.warning = null;
        this.swing(this.sweep);
        // В третьей фазе сразу второй взмах с другой высоты.
        if (this.phase === 3) {
          const second: Sweep = this.sweep === 'low' ? 'high' : 'low';
          this.scene.time.delayedCall(600, () => {
            if (!this.dead) this.swing(second);
          });
        }
        this.enter('idle', (this.phase === 3 ? 1500 : 1000) / this.tempo);
        return;
      case 'throw-tell':
        this.tell(false);
        this.throwBoulder(ctx);
        this.enter('idle', 900 / this.tempo);
        return;
      default:
        this.chooseMove();
    }
  }

  private chooseMove() {
    const moves: Move[] = this.phase === 1 ? ['stomp', 'sweep'] : ['stomp', 'sweep', 'throw'];
    const move = this.pick(moves, this.lastMove);
    this.lastMove = move;
    this.tell(true);

    if (move === 'sweep') {
      this.sweep = Math.random() < 0.5 ? 'low' : 'high';
      const y = this.hooks.arena.ground - SWEEP_HEIGHT[this.sweep];
      this.warning = this.scene.add.image(this.x - 34, y, 'sweep').setDepth(12).setAlpha(0.5);
      this.scene.tweens.add({ targets: this.warning, alpha: 0.1, duration: 120, yoyo: true, repeat: -1 });
      this.setAngle(this.sweep === 'high' ? 6 : -6);
      this.scene.time.delayedCall(760 / this.tempo, () => this.setAngle(0));
      this.enter('sweep-tell', 760 / this.tempo);
      return;
    }
    this.enter(`${move}-tell`, (move === 'stomp' ? 700 : 550) / this.tempo);
  }

  private swing(sweep: Sweep) {
    this.hooks.spawn(this.x - 34, this.hooks.arena.ground - SWEEP_HEIGHT[sweep], {
      texture: 'sweep',
      vx: -SWEEP_SPEED * this.tempo,
      vy: 0,
      friendly: false,
      damage: 1,
      ignoreTiles: true,
      upright: true,
      reflectable: false,
    });
  }

  private stomp(ctx: BossContext) {
    this.hooks.shake(300, 0.015);
    const { left, ground } = this.hooks.arena;
    const count = this.phase === 3 ? 6 : 4;
    const spots = [ctx.heroX];
    for (let i = 1; i < count; i += 1) spots.push(Phaser.Math.Between(left + 16, this.x - 48));

    for (const x of spots) {
      const shadow = this.scene.add.image(x, ground - 1, 'shadow').setDepth(8).setScale(0.4);
      this.scene.tweens.add({ targets: shadow, scale: 1, duration: ROCK_WARN_MS });
      this.scene.time.delayedCall(ROCK_WARN_MS, () => {
        if (this.dead) {
          shadow.destroy();
          return;
        }
        this.hooks.spawn(x, -10, {
          texture: 'rock',
          vx: 0,
          vy: 120,
          gravity: 900,
          spin: 5,
          friendly: false,
          damage: 1,
          reflectable: false,
        });
        this.scene.time.delayedCall(560, () => shadow.destroy());
      });
    }
  }

  private throwBoulder(ctx: BossContext) {
    const gravity = 600;
    const fromY = this.y - 26;
    const flight = 0.8;
    const targetX = ctx.heroX + 40;
    this.hooks.spawn(this.x - 20, fromY, {
      texture: 'boulder',
      vx: (targetX - this.x) / flight,
      vy: (ctx.heroBottom - 6 - fromY - 0.5 * gravity * flight * flight) / flight,
      gravity,
      spin: -8,
      landing: 'roll',
      rollSpeed: 150,
      friendly: false,
      damage: 1,
    });
  }

  private enter(mode: Mode, ms: number) {
    this.mode = mode;
    this.modeUntil = this.scene.time.now + ms;
  }
}
