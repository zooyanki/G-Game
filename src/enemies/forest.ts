import Phaser from 'phaser';
import { SCREEN_WIDTH } from '../constants';
import { Enemy, type EnemyContext } from './Enemy';

/** Ладога, лесные разбойники: пехота, щиты, праща и вороны. */

const HUMAN = { body: [10, 20, 3, 4] as [number, number, number, number], height: 24 };

export class Bandit extends Enemy {
  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'bandit', { hp: 2, texture: 'bandit', ...HUMAN });
  }

  protected act(ctx: EnemyContext) {
    this.patrol(ctx, 45);
  }
}

/** Стрелы спереди не берут — нужен меч или обойти сверху. */
export class ShieldBearer extends Enemy {
  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'shield', { hp: 5, texture: 'shield', ...HUMAN });
  }

  blocksArrow(vx: number, vy: number) {
    const intoFace = Math.sign(vx) === -this.dir;
    return intoFace && Math.abs(vx) > Math.abs(vy) * 0.6;
  }

  protected act(ctx: EnemyContext) {
    if (!this.behind(ctx) && Math.abs(ctx.heroX - this.x) < 120) this.dir = Math.sign(ctx.heroX - this.x) || this.dir;
    this.patrol(ctx, 28);
  }
}

/** Пращник: прямой камень в грудь — присядь или отбей мечом. */
export class Slinger extends Enemy {
  private nextShotAt = 0;
  private tellUntil = 0;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'slinger', { hp: 3, texture: 'slinger', ...HUMAN });
  }

  protected onWake(ctx: EnemyContext) {
    this.nextShotAt = ctx.now + 600;
  }

  protected act(ctx: EnemyContext) {
    this.arcade.setVelocityX(0);
    if (this.behind(ctx)) return;
    this.faceHero(ctx);

    if (this.tellUntil) {
      if (ctx.now < this.tellUntil) return;
      this.tellUntil = 0;
      this.tell(false);
      this.nextShotAt = ctx.now + 1900;
      const fromY = this.y - 4;
      const dx = ctx.heroX - this.x;
      const dist = Math.hypot(dx, ctx.heroY - fromY) || 1;
      ctx.shoot(this.x + this.dir * 6, fromY, {
        texture: 'stone',
        vx: (dx / dist) * 140,
        vy: ((ctx.heroY - fromY) / dist) * 140,
        friendly: false,
        damage: 1,
      });
      return;
    }

    const range = SCREEN_WIDTH * 0.6;
    if (ctx.now >= this.nextShotAt && Math.abs(ctx.heroX - this.x) < range) {
      this.tellUntil = ctx.now + 350;
      this.tell(true);
    }
  }
}

/** Ворон летит навстречу волной. Пропустил героя — улетает, назад не возвращается. */
export class Raven extends Enemy {
  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'raven', { hp: 1, texture: 'raven0', flying: true, body: [12, 8, 2, 2], height: 12 });
  }

  protected act(ctx: EnemyContext) {
    this.setTexture(Math.floor(ctx.now / 150) % 2 === 0 ? 'raven0' : 'raven1');
    if (this.behind(ctx)) {
      this.face(-1);
      this.arcade.setVelocity(-90, -20);
      return;
    }
    this.faceHero(ctx);
    const targetY = ctx.heroY - 6 + Math.sin(ctx.now / 300) * 18;
    this.arcade.setVelocity(this.dir * 70, Phaser.Math.Clamp((targetY - this.y) * 2, -60, 60));
  }
}
