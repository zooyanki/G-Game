import Phaser from 'phaser';
import { GRAVITY, MAX_FALL_SPEED } from '../constants';
import { Boss, type BossContext, type BossDef, type BossHooks } from './Boss';

type Mode = 'idle' | 'charge-tell' | 'charge' | 'stun' | 'throw-tell' | 'leap-tell' | 'leap' | 'roar';
type Move = 'charge' | 'throw' | 'leap';

const AXE_GRAVITY = 600;

/**
 * Ладога. Вожак разбойников — тяжёлый боец на земле:
 * разбег через всю арену (перепрыгни), веер топоров по дуге,
 * со второй фазы — прыжок с ударной волной в обе стороны.
 */
export class BanditChief extends Boss {
  private mode: Mode = 'idle';
  private modeUntil = 0;
  private lastMove: Move | null = null;
  private dir = -1;
  private airborneAt = 0;

  constructor(scene: Phaser.Scene, def: BossDef, hooks: BossHooks) {
    super(scene, hooks.arena.right - 48, hooks.arena.ground - 20, def, hooks);
    this.arcade.setSize(30, 36).setOffset(5, 4);
    this.arcade.setMaxVelocityY(MAX_FALL_SPEED * 1.5);
    this.setCollideWorldBounds(true);
    this.modeUntil = this.introUntil;
  }

  protected onPhase() {
    if (this.mode !== 'leap') this.enter('roar', 800);
  }

  think(ctx: BossContext) {
    if (this.dead) return;
    const body = this.arcade;

    if (this.mode === 'charge') {
      body.setVelocityX(this.dir * 260 * this.tempo);
      if (body.blocked.left || body.blocked.right) {
        this.hooks.shake(200, 0.012);
        this.enter('stun', 900 / this.tempo);
      }
      return;
    }

    if (this.mode === 'leap') {
      if (body.blocked.down && ctx.now - this.airborneAt > 150) {
        body.setVelocityX(0);
        this.hooks.shake(250, 0.015);
        this.shockwave();
        this.enter('idle', 700 / this.tempo);
      }
      return;
    }

    if (ctx.now < this.modeUntil) {
      if (this.mode === 'idle') this.faceHero(ctx.heroX);
      if (this.mode.endsWith('-tell')) this.jitter(ctx.now);
      return;
    }

    switch (this.mode) {
      case 'charge-tell':
        this.tell(false);
        this.mode = 'charge';
        return;
      case 'throw-tell':
        this.tell(false);
        this.throwAxes(ctx);
        this.enter('idle', 900 / this.tempo);
        return;
      case 'leap-tell': {
        this.tell(false);
        const flight = 0.9;
        body.setVelocity(Phaser.Math.Clamp((ctx.heroX - this.x) / flight, -320, 320), -(GRAVITY * flight) / 2);
        this.airborneAt = ctx.now;
        this.mode = 'leap';
        return;
      }
      case 'roar':
      case 'stun':
        body.setVelocityX(0);
        this.enter('idle', 500 / this.tempo);
        return;
      default: {
        this.faceHero(ctx.heroX);
        const move = this.pick<Move>(this.phase === 1 ? ['charge', 'throw'] : ['charge', 'throw', 'leap'], this.lastMove);
        this.lastMove = move;
        this.tell(true);
        body.setVelocityX(0);
        const tell = move === 'charge' ? 650 : move === 'throw' ? 500 : 450;
        this.enter(`${move}-tell`, tell / this.tempo);
      }
    }
  }

  private throwAxes(ctx: BossContext) {
    const count = this.phase === 3 ? 5 : 3;
    const fromY = this.y - 14;
    for (let i = 0; i < count; i += 1) {
      const flight = 0.7 + i * 0.22;
      const targetX = ctx.heroX + (i - (count - 1) / 2) * 28;
      this.hooks.spawn(this.x + this.dir * 12, fromY, {
        texture: 'axe',
        vx: (targetX - this.x) / flight,
        vy: (ctx.heroBottom - 8 - fromY - 0.5 * AXE_GRAVITY * flight * flight) / flight,
        gravity: AXE_GRAVITY,
        spin: 12 * this.dir,
        friendly: false,
        damage: 1,
      });
    }
  }

  private shockwave() {
    const y = this.arcade.bottom - 7;
    for (const dir of [-1, 1]) {
      this.hooks.spawn(this.x + dir * 18, y, {
        texture: 'wave',
        vx: dir * 180 * this.tempo,
        vy: 0,
        friendly: false,
        damage: 1,
        ignoreTiles: true,
        upright: true,
        reflectable: false,
      });
    }
  }

  private faceHero(heroX: number) {
    this.dir = heroX < this.x ? -1 : 1;
    this.setFlipX(this.dir < 0);
  }

  private enter(mode: Mode, ms: number) {
    this.mode = mode;
    this.modeUntil = this.scene.time.now + ms;
  }
}
