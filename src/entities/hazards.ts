import Phaser from 'phaser';
import { SCREEN_WIDTH } from '../constants';
import type { ProjectileOptions } from './Projectile';

export type HazardKind = 'logs' | 'rockfall' | 'arrowRain';

export type HazardContext = {
  now: number;
  heroX: number;
  shoot(x: number, y: number, options: ProjectileOptions): void;
};

/** Ловушка уровня. Как и враги, срабатывает только впереди героя. */
export interface Hazard {
  update(ctx: HazardContext): void;
}

/** Ладога: из поленницы на пригорке одно за другим катятся брёвна. Прыгай или отбей мечом. */
class LogRoller implements Hazard {
  private nextAt = 0;
  private readonly x: number;
  private readonly y: number;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    this.x = x;
    this.y = feetY - 7;
    scene.add.image(x + 4, feetY - 7, 'logpile').setDepth(4);
  }

  update(ctx: HazardContext) {
    const ahead = this.x - ctx.heroX;
    if (ahead < 24 || ahead > SCREEN_WIDTH * 0.9) return;
    if (!this.nextAt) this.nextAt = ctx.now + 300;
    if (ctx.now < this.nextAt) return;
    this.nextAt = ctx.now + 2600;
    ctx.shoot(this.x - 12, this.y, {
      texture: 'log',
      vx: -120,
      vy: 0,
      gravity: 700,
      spin: -9,
      landing: 'roll',
      rollSpeed: 120,
      friendly: false,
      damage: 1,
    });
  }
}

/** Смоленск: под каменным навесом сыплется пыль — через полсекунды падает глыба. */
class RockFall implements Hazard {
  private armed = true;
  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly y: number;

  constructor(scene: Phaser.Scene, x: number, cellY: number) {
    this.scene = scene;
    this.x = x;
    this.y = cellY;
  }

  update(ctx: HazardContext) {
    if (!this.armed || ctx.heroX < this.x - 64 || ctx.heroX > this.x + 8) return;
    this.armed = false;
    for (let i = 0; i < 5; i += 1) {
      const dust = this.scene.add.image(this.x + Phaser.Math.Between(-5, 5), this.y - 4, 'dust').setDepth(12);
      this.scene.tweens.add({ targets: dust, y: dust.y + 24, alpha: 0, duration: 500, delay: i * 70, onComplete: () => dust.destroy() });
    }
    this.scene.time.delayedCall(550, () =>
      ctx.shoot(this.x, this.y, {
        texture: 'rock',
        vx: 0,
        vy: 0,
        gravity: 800,
        spin: 4,
        friendly: false,
        damage: 1,
        reflectable: false,
      }),
    );
  }
}

/** Киев: на землю ложится красная тень — через миг туда падает залп стрел с неба. */
class ArrowRain implements Hazard {
  private nextAt = 0;
  private readonly scene: Phaser.Scene;
  private readonly x: number;
  private readonly groundY: number;

  constructor(scene: Phaser.Scene, x: number, feetY: number) {
    this.scene = scene;
    this.x = x;
    this.groundY = feetY;
  }

  update(ctx: HazardContext) {
    const ahead = this.x - ctx.heroX;
    if (ahead < -64 || ahead > SCREEN_WIDTH * 0.55) return;
    if (!this.nextAt) this.nextAt = ctx.now + 400;
    if (ctx.now < this.nextAt) return;
    this.nextAt = ctx.now + 2800;

    const mark = this.scene.add.rectangle(this.x, this.groundY - 2, 56, 4, 0xc23b3b, 0.55).setDepth(8);
    this.scene.tweens.add({ targets: mark, alpha: 0.15, duration: 120, yoyo: true, repeat: 2, onComplete: () => mark.destroy() });
    this.scene.time.delayedCall(720, () => {
      for (let i = 0; i < 5; i += 1) {
        ctx.shoot(this.x - 24 + i * 12, -8 - (i % 2) * 14, {
          texture: 'arrow-foe',
          vx: 0,
          vy: 330,
          friendly: false,
          damage: 1,
        });
      }
    });
  }
}

export function createHazard(scene: Phaser.Scene, kind: HazardKind, x: number, y: number): Hazard {
  if (kind === 'logs') return new LogRoller(scene, x, y);
  if (kind === 'rockfall') return new RockFall(scene, x, y);
  return new ArrowRain(scene, x, y);
}
