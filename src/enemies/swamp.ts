import Phaser from 'phaser';
import { Enemy, type EnemyContext } from './Enemy';

/** Новгород, болотная нечисть: прыгучая кикимора, огоньки-таранщики, плевуны. */

/** Кикимора скачет к герою дугами — угадай, где приземлится. */
export class Kikimora extends Enemy {
  private nextHopAt = 0;
  private airborne = false;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'kikimora', { hp: 2, texture: 'kiki0', body: [12, 12, 2, 4], height: 16 });
  }

  protected onWake(ctx: EnemyContext) {
    this.nextHopAt = ctx.now + 400;
  }

  protected act(ctx: EnemyContext) {
    const body = this.arcade;
    if (this.airborne) {
      if (!body.blocked.down || body.velocity.y < 0) return;
      this.airborne = false;
      body.setVelocityX(0);
      this.setTexture('kiki0');
      this.nextHopAt = ctx.now + 1100;
      return;
    }
    body.setVelocityX(0);
    if (this.behind(ctx)) return;
    this.faceHero(ctx);
    if (ctx.now < this.nextHopAt || !body.blocked.down) return;
    this.airborne = true;
    this.setTexture('kiki1');
    body.setVelocity(this.dir * 85, -290);
  }
}

type WispMode = 'hover' | 'tell' | 'dash' | 'return';

/** Огонёк висит, мерцает и вдруг бросается по прямой. Вспышка перед рывком — сигнал. */
export class Wisp extends Enemy {
  private mode: WispMode = 'hover';
  private modeUntil = 0;
  private readyAt = 0;
  private homeX: number;
  private homeY: number;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'wisp', { hp: 1, texture: 'wisp', flying: true, body: [8, 8, 1, 1], height: 10 });
    this.homeX = this.x;
    this.homeY = this.y;
    this.setBlendMode(Phaser.BlendModes.ADD);
  }

  protected onWake(ctx: EnemyContext) {
    this.readyAt = ctx.now + 500;
  }

  protected act(ctx: EnemyContext) {
    const body = this.arcade;
    const dx = ctx.heroX - this.x;
    const dy = ctx.heroY - this.y;

    if (this.mode === 'hover') {
      body.setVelocity((this.homeX - this.x) * 2, (this.homeY + Math.sin(ctx.now / 250) * 6 - this.y) * 4);
      if (ctx.now >= this.readyAt && !this.behind(ctx) && Math.hypot(dx, dy) < 170) {
        this.mode = 'tell';
        this.modeUntil = ctx.now + 450;
        this.setScale(1.4);
      }
      return;
    }

    if (this.mode === 'tell') {
      body.setVelocity(0, 0);
      this.setAlpha(Math.floor(ctx.now / 60) % 2 === 0 ? 1 : 0.4);
      if (ctx.now < this.modeUntil) return;
      const dist = Math.hypot(dx, dy) || 1;
      body.setVelocity((dx / dist) * 230, (dy / dist) * 230);
      this.setScale(1).setAlpha(1);
      this.mode = 'dash';
      this.modeUntil = ctx.now + 600;
      return;
    }

    if (this.mode === 'dash') {
      if (ctx.now < this.modeUntil) return;
      this.mode = 'return';
      return;
    }

    const toHomeX = this.homeX - this.x;
    const toHomeY = this.homeY - this.y;
    const dist = Math.hypot(toHomeX, toHomeY);
    if (dist < 4) {
      this.mode = 'hover';
      this.readyAt = ctx.now + 1300;
      return;
    }
    body.setVelocity((toHomeX / dist) * 70, (toHomeY / dist) * 70);
  }

  /** Вызванный Болотником огонёк кружит возле места появления. */
  setHome(x: number, y: number) {
    this.homeX = x;
    this.homeY = y;
  }
}

/** Плевун в трясине: бросает ком тины по дуге туда, где герой стоит сейчас. */
export class Spitter extends Enemy {
  private nextShotAt = 0;
  private tellUntil = 0;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    super(scene, x, feetY, 'spitter', { hp: 3, texture: 'spitter', body: [12, 16, 2, 4], height: 20 });
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
      this.setScale(1);
      this.nextShotAt = ctx.now + 2300;
      const gravity = 520;
      const fromY = this.y - 8;
      const { vx, vy } = this.lob(this.x, fromY, ctx.heroX, ctx.heroBottom - 6, 0.95, gravity);
      ctx.shoot(this.x, fromY, { texture: 'blob', vx, vy, gravity, friendly: false, damage: 1 });
      return;
    }

    if (ctx.now >= this.nextShotAt && Math.abs(ctx.heroX - this.x) < 260) {
      this.tellUntil = ctx.now + 400;
      this.tell(true);
      this.setScale(1.1, 0.9);
    }
  }
}
