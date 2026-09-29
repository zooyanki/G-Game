import Phaser from 'phaser';
import { MAX_FALL_SPEED } from '../constants';
import type { EnemyKind } from '../enemies';
import type { ProjectileOptions } from '../entities/Projectile';

export type RaidContext = {
  now: number;
  heroX: number;
  heroY: number;
  shoot(x: number, y: number, options: ProjectileOptions): void;
};

type Spec = {
  hp: number;
  texture: string;
  body: [number, number, number, number];
  speed: number;
  flying?: boolean;
  flap?: [string, string];
  blocks?: boolean;
  shot?: { texture: string; speed: number; every: number; gravity?: number };
};

const SPEC: Record<EnemyKind, Spec> = {
  bandit: { hp: 2, texture: 'bandit', body: [10, 20, 3, 4], speed: 52 },
  shield: { hp: 5, texture: 'shield', body: [10, 20, 3, 4], speed: 30, blocks: true },
  slinger: { hp: 3, texture: 'slinger', body: [10, 20, 3, 4], speed: 0, shot: { texture: 'stone', speed: 140, every: 1800 } },
  raven: { hp: 1, texture: 'raven0', body: [12, 8, 2, 2], speed: 70, flying: true, flap: ['raven0', 'raven1'] },
  kikimora: { hp: 2, texture: 'kiki0', body: [12, 12, 2, 4], speed: 80 },
  wisp: { hp: 1, texture: 'wisp', body: [8, 8, 1, 1], speed: 110, flying: true },
  spitter: { hp: 3, texture: 'spitter', body: [12, 16, 2, 4], speed: 0, shot: { texture: 'blob', speed: 120, every: 2200, gravity: 0 } },
  boar: { hp: 4, texture: 'boar0', body: [20, 12, 2, 4], speed: 95, flap: ['boar0', 'boar1'] },
  lobber: { hp: 3, texture: 'lobber', body: [12, 20, 2, 4], speed: 0, shot: { texture: 'boulder', speed: 130, every: 2400 } },
  rider: { hp: 3, texture: 'rider0', body: [20, 16, 2, 8], speed: 120, flap: ['rider0', 'rider1'] },
  archer: { hp: 3, texture: 'archer', body: [10, 20, 3, 4], speed: 0, shot: { texture: 'arrow-foe', speed: 200, every: 2100 } },
  hawk: { hp: 1, texture: 'hawk0', body: [12, 6, 2, 2], speed: 90, flying: true, flap: ['hawk0', 'hawk1'] },
};

/**
 * Враг вылазки: без платформ и «только спереди».
 * Ближники идут на героя, стрелки стоят и бьют, летающие кружат.
 */
export class Raider extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  private hp: number;
  private readonly spec: Spec;
  private nextShotAt = 0;
  private tellUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: EnemyKind) {
    const spec = SPEC[kind];
    super(scene, x, y, spec.texture);
    this.kind = kind;
    this.spec = spec;
    this.hp = spec.hp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    const body = this.arcade;
    const [w, h, ox, oy] = spec.body;
    body.setSize(w, h).setOffset(ox, oy);
    body.setAllowGravity(false);
    body.setMaxVelocity(MAX_FALL_SPEED, MAX_FALL_SPEED);
    body.setDrag(200, 200);
    this.nextShotAt = scene.time.now + 400;
  }

  get arcade() {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  blocksArrow(vx: number, _vy: number) {
    if (!this.spec.blocks) return false;
    return Math.sign(vx) === (this.flipX ? 1 : -1);
  }

  hurt(damage: number) {
    if (!this.active) return false;
    this.hp -= damage;
    if (this.hp > 0) {
      this.setTintFill(0xffffff);
      this.scene.time.delayedCall(70, () => {
        if (this.active) this.clearTint();
      });
      return false;
    }
    this.disableBody(true, true);
    return true;
  }

  update(ctx: RaidContext) {
    if (!this.active) return;
    const dx = ctx.heroX - this.x;
    const dy = ctx.heroY - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.setFlipX(dx < 0);
    if (this.spec.flap) {
      const frame = Math.floor(ctx.now / 120) % 2;
      this.setTexture(this.spec.flap[frame]);
    }

    if (this.spec.shot) {
      this.arcade.setVelocity(0, 0);
      if (this.tellUntil) {
        if (ctx.now < this.tellUntil) return;
        this.tellUntil = 0;
        this.clearTint();
        const speed = this.spec.shot.speed;
        ctx.shoot(this.x, this.y, {
          texture: this.spec.shot.texture,
          vx: (dx / dist) * speed,
          vy: (dy / dist) * speed,
          gravity: this.spec.shot.gravity ?? 0,
          friendly: false,
          damage: 1,
        });
        this.nextShotAt = ctx.now + this.spec.shot.every;
        return;
      }
      if (dist < 170 && ctx.now >= this.nextShotAt) {
        this.tellUntil = ctx.now + 320;
        this.setTint(0xf2d48a);
      }
      return;
    }

    if (dist > 8) this.arcade.setVelocity((dx / dist) * this.spec.speed, (dy / dist) * this.spec.speed);
    else this.arcade.setVelocity(0, 0);
  }
}
