import Phaser from 'phaser';
import { Enemy, type EnemyContext } from './Enemy';

/** Смоленск, волок через холмы: вепри-тараны и камнемёты с катящимися валунами. */

type BoarMode = 'idle' | 'tell' | 'charge' | 'stun';

/** Вепрь роет землю и бросается по прямой до стены или обрыва. Перепрыгни и бей в бок. */
export class Boar extends Enemy {
  private mode: BoarMode = 'idle';
  private modeUntil = 0;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'boar', { hp: 4, texture: 'boar0', body: [20, 12, 2, 4], height: 16 });
  }

  protected act(ctx: EnemyContext) {
    const body = this.arcade;

    if (this.mode === 'charge') {
      this.setTexture(Math.floor(ctx.now / 90) % 2 === 0 ? 'boar0' : 'boar1');
      body.setVelocityX(this.dir * 230);
      const edge = body.blocked.down && !ctx.solidAt(this.x + this.dir * 12, body.bottom + 4);
      if (body.blocked.left || body.blocked.right || edge) {
        body.setVelocityX(0);
        this.mode = 'stun';
        this.modeUntil = ctx.now + 900;
        this.setAngle(this.dir * 8);
      }
      return;
    }

    body.setVelocityX(0);
    if (ctx.now < this.modeUntil) {
      if (this.mode === 'tell') this.setX(this.x + (Math.floor(ctx.now / 50) % 2 === 0 ? 0.6 : -0.6));
      return;
    }

    if (this.mode === 'tell') {
      this.tell(false);
      this.mode = 'charge';
      return;
    }

    this.mode = 'idle';
    this.setAngle(0);
    if (this.behind(ctx)) return;
    this.faceHero(ctx);
    const sameLevel = Math.abs(ctx.heroBottom - body.bottom) < 24;
    if (sameLevel && Math.abs(ctx.heroX - this.x) < 210) {
      this.mode = 'tell';
      this.modeUntil = ctx.now + 550;
      this.tell(true);
    }
  }
}

/** Камнемёт бросает валун по дуге; упав, тот катится на героя — прыгай или руби. */
export class Lobber extends Enemy {
  private nextShotAt = 0;
  private tellUntil = 0;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'lobber', { hp: 3, texture: 'lobber', body: [12, 20, 2, 4], height: 24 });
  }

  protected onWake(ctx: EnemyContext) {
    this.nextShotAt = ctx.now + 800;
  }

  protected act(ctx: EnemyContext) {
    this.arcade.setVelocityX(0);
    if (this.behind(ctx)) return;
    this.faceHero(ctx);

    if (this.tellUntil) {
      if (ctx.now < this.tellUntil) return;
      this.tellUntil = 0;
      this.tell(false);
      this.nextShotAt = ctx.now + 2700;
      const gravity = 600;
      const fromY = this.y - 14;
      // Бросок чуть с недолётом: валун должен докатиться, а не упасть на голову.
      const targetX = ctx.heroX + (this.x - ctx.heroX) * 0.35;
      const { vx, vy } = this.lob(this.x, fromY, targetX, ctx.heroBottom - 6, 0.9, gravity);
      ctx.shoot(this.x, fromY, {
        texture: 'boulder',
        vx,
        vy,
        gravity,
        spin: -8,
        landing: 'roll',
        rollSpeed: 120,
        friendly: false,
        damage: 1,
      });
      return;
    }

    if (ctx.now >= this.nextShotAt && Math.abs(ctx.heroX - this.x) < 280) {
      this.tellUntil = ctx.now + 450;
      this.tell(true);
    }
  }
}