import Phaser from 'phaser';
import { SCREEN_WIDTH } from '../constants';
import { Enemy, type EnemyContext } from './Enemy';

/** Киев, степной набег: всадники, лучники навесом и соколы. */

/** Всадник выезжает из-за правого края и мчится навстречу, не сворачивая. Перепрыгни. */
export class Rider extends Enemy {
  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'rider', {
      hp: 3,
      texture: 'rider0',
      body: [20, 16, 2, 8],
      height: 24,
      wakeRange: SCREEN_WIDTH * 0.95,
    });
  }

  protected act(ctx: EnemyContext) {
    const body = this.arcade;
    if (body.blocked.left) this.dir = 1;
    if (body.blocked.right) this.dir = -1;
    body.setVelocityX(this.dir * 190);
    this.face(this.dir);
    this.setTexture(Math.floor(ctx.now / 100) % 2 === 0 ? 'rider0' : 'rider1');
  }
}

/** Степной лучник пускает три стрелы навесом: они падают вокруг героя, а не в лоб. */
export class SteppeArcher extends Enemy {
  private nextShotAt = 0;
  private tellUntil = 0;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'archer', { hp: 3, texture: 'archer', body: [10, 20, 3, 4], height: 24 });
  }

  protected onWake(ctx: EnemyContext) {
    this.nextShotAt = ctx.now + 700;
  }

  protected act(ctx: EnemyContext) {
    this.arcade.setVelocityX(0);
    if (this.behind(ctx)) return;
    this.faceHero(ctx);

    if (this.tellUntil) {
      if (ctx.now < this.tellUntil) return;
      this.tellUntil = 0;
      this.tell(false);
      this.nextShotAt = ctx.now + 3000;
      const gravity = 500;
      const fromY = this.y - 8;
      [-28, 0, 28].forEach((offset, index) => {
        const { vx, vy } = this.lob(this.x, fromY, ctx.heroX + offset, ctx.heroBottom - 4, 1.05 + index * 0.12, gravity);
        ctx.shoot(this.x, fromY, { texture: 'arrow-foe', vx, vy, gravity, friendly: false, damage: 1 });
      });
      return;
    }

    if (ctx.now >= this.nextShotAt && Math.abs(ctx.heroX - this.x) < 300) {
      this.tellUntil = ctx.now + 500;
      this.tell(true);
    }
  }
}

type HawkMode = 'hover' | 'tell' | 'dive' | 'leave';

/** Сокол кружит высоко, с криком пикирует один раз и улетает прочь. */
export class Hawk extends Enemy {
  private mode: HawkMode = 'hover';
  private modeUntil = 0;
  private homeY: number;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'hawk', { hp: 1, texture: 'hawk0', flying: true, body: [12, 6, 2, 2], height: 10 });
    this.homeY = this.y;
  }

  protected act(ctx: EnemyContext) {
    const body = this.arcade;
    const flap = Math.floor(ctx.now / (this.mode === 'tell' ? 60 : 160)) % 2 === 0;
    this.setTexture(flap ? 'hawk0' : 'hawk1');

    if (this.mode === 'hover') {
      body.setVelocity(Math.sin(ctx.now / 400) * 30, (this.homeY - this.y) * 3);
      if (!this.behind(ctx) && Math.abs(ctx.heroX - this.x) < 120) {
        this.mode = 'tell';
        this.modeUntil = ctx.now + 380;
        this.tell(true);
      }
      return;
    }

    if (this.mode === 'tell') {
      body.setVelocity(0, -20);
      if (ctx.now < this.modeUntil) return;
      this.tell(false);
      const dx = ctx.heroX - this.x;
      const dy = ctx.heroY - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      body.setVelocity((dx / dist) * 250, (dy / dist) * 250);
      this.face(dx);
      this.mode = 'dive';
      this.modeUntil = ctx.now + 800;
      return;
    }

    if (this.mode === 'dive') {
      if (ctx.now < this.modeUntil && this.y < ctx.heroBottom + 8) return;
      this.mode = 'leave';
      body.setVelocity(this.dir * 140, -220);
      return;
    }

    if (this.y < -24) this.disableBody(true, true);
  }
}
