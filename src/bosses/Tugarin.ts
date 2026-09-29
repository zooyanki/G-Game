import Phaser from 'phaser';
import { Boss, type BossContext, type BossDef, type BossHooks } from './Boss';

type Mode = 'enter' | 'glide' | 'breath-tell' | 'breath' | 'rise' | 'dive-tell' | 'dive' | 'return';
type Move = 'glide' | 'breath' | 'dive';

const SKY_Y = 58;
/** Высота пике: тело змея проходит над присевшим героем, но сбивает стоящего. */
const DIVE_ABOVE_GROUND = 24;
const FIREBALL_GRAVITY = 420;

/**
 * Киев. Змей Тугарин не касается земли: мечом его достать можно с досок или на пике.
 * Облёт с огненными шарами (на земле остаётся пламя), поток огня сверху наискосок,
 * со второй фазы — пике у самой земли из-за края экрана: знак «!» предупреждает, спасает присед.
 */
export class Tugarin extends Boss {
  private mode: Mode = 'enter';
  private modeUntil = 0;
  private lastMove: Move | null = null;
  private dir = -1;
  private nextDropAt = 0;
  private breathStep = 0;
  private warning: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene, def: BossDef, hooks: BossHooks) {
    super(scene, hooks.arena.right + 60, SKY_Y, def, hooks);
    this.arcade.setAllowGravity(false);
    this.arcade.setSize(52, 16).setOffset(6, 8);
    this.setFlipX(true);
  }

  protected onDeath() {
    this.warning?.destroy();
    this.arcade.setAllowGravity(true);
  }

  think(ctx: BossContext) {
    if (this.dead) return;
    const body = this.arcade;
    const { left, right, ground } = this.hooks.arena;
    this.setFlipX(this.dir < 0);

    switch (this.mode) {
      case 'enter': {
        const restX = right - 70;
        body.setVelocity(-160, 0);
        if (this.x <= restX) this.enter('glide', 0);
        return;
      }

      case 'glide': {
        // Пролёт от края до края волной, роняя огненные шары.
        body.setVelocity(this.dir * 120 * this.tempo, Math.cos(ctx.now / 260) * 40);
        if (ctx.now >= this.nextDropAt) {
          this.nextDropAt = ctx.now + (this.phase === 3 ? 420 : 650);
          this.hooks.spawn(this.x + this.dir * 20, this.y + 8, {
            texture: 'fireball',
            vx: this.dir * 40,
            vy: 40,
            gravity: FIREBALL_GRAVITY,
            landing: 'burn',
            friendly: false,
            damage: 1,
          });
        }
        const edge = this.dir < 0 ? this.x < left + 50 : this.x > right - 50;
        if (edge || ctx.now > this.modeUntil) this.choose(ctx);
        return;
      }

      case 'breath-tell':
        body.setVelocity(0, (SKY_Y - 10 - this.y) * 3);
        this.jitter(ctx.now);
        if (ctx.now >= this.modeUntil) {
          this.tell(false);
          this.breathStep = 0;
          this.enter('breath', 1300 / this.tempo);
        }
        return;

      case 'breath': {
        body.setVelocity(0, 0);
        // Поток огня наискосок вниз, ведётся от ног змея вдаль по арене.
        const steps = 14;
        const due = Math.floor(((ctx.now - (this.modeUntil - 1300 / this.tempo)) / (1300 / this.tempo)) * steps);
        while (this.breathStep < Math.min(due, steps)) {
          const t = this.breathStep / (steps - 1);
          const angle = Phaser.Math.Linear(1.35, 0.55, t);
          const speed = 210;
          this.hooks.spawn(this.x + this.dir * 26, this.y + 6, {
            texture: 'flame',
            vx: Math.cos(angle) * speed * this.dir,
            vy: Math.sin(angle) * speed,
            friendly: false,
            damage: 1,
            upright: true,
            reflectable: false,
          });
          this.breathStep += 1;
        }
        if (ctx.now >= this.modeUntil) this.enter('glide', 2400);
        return;
      }

      case 'rise':
        // Улетает за правый край, чтобы оттуда зайти на пике.
        body.setVelocity(220, -60);
        if (this.x > right + 70) {
          this.setPosition(right + 70, ground - DIVE_ABOVE_GROUND);
          body.reset(this.x, this.y);
          this.dir = -1;
          this.warning = this.scene.add
            .image(right - 12, ground - DIVE_ABOVE_GROUND, 'warn')
            .setDepth(15);
          this.scene.tweens.add({ targets: this.warning, alpha: 0.2, duration: 110, yoyo: true, repeat: -1 });
          this.enter('dive-tell', 800 / this.tempo);
        }
        return;

      case 'dive-tell':
        body.setVelocity(0, 0);
        if (ctx.now >= this.modeUntil) {
          this.warning?.destroy();
          this.warning = null;
          this.hooks.shake(200, 0.006);
          this.enter('dive', 0);
        }
        return;

      case 'dive':
        body.setVelocity(-330 * this.tempo, 0);
        if (this.x < left - 70) {
          this.setPosition(left - 70, SKY_Y - 30);
          body.reset(this.x, this.y);
          this.dir = 1;
          this.enter('return', 0);
        }
        return;

      case 'return':
        body.setVelocity(150, (SKY_Y - this.y) * 2);
        if (this.x > left + 60) this.enter('glide', 2400);
        return;
    }
  }

  private choose(ctx: BossContext) {
    if (this.x < this.hooks.arena.left + 60) this.dir = 1;
    else if (this.x > this.hooks.arena.right - 60) this.dir = -1;

    const moves: Move[] = this.phase === 1 ? ['glide', 'breath'] : ['glide', 'breath', 'dive'];
    const move = this.pick(moves, this.lastMove);
    this.lastMove = move;

    if (move === 'glide') {
      this.enter('glide', 2400);
      return;
    }
    if (move === 'breath') {
      // Дышит в сторону героя.
      this.dir = ctx.heroX < this.x ? -1 : 1;
      this.tell(true);
      this.enter('breath-tell', 650 / this.tempo);
      return;
    }
    this.enter('rise', 0);
  }

  private enter(mode: Mode, ms: number) {
    this.mode = mode;
    this.modeUntil = this.scene.time.now + ms;
  }
}