import Phaser from 'phaser';
import { MAX_FALL_SPEED, WAKE_RANGE } from '../constants';
import type { ProjectileOptions } from '../entities/Projectile';

export type EnemyKind =
  | 'bandit'
  | 'shield'
  | 'slinger'
  | 'raven'
  | 'kikimora'
  | 'wisp'
  | 'spitter'
  | 'boar'
  | 'lobber'
  | 'rider'
  | 'archer'
  | 'hawk';

/** Твёрдая ли клетка карты в точке — чтобы враг не шагнул в пропасть. */
export type SolidAt = (x: number, y: number) => boolean;

/** Всё, что враг знает о мире за кадр. */
export type EnemyContext = {
  now: number;
  heroX: number;
  /** Грудь стоящего героя: присевший пропускает прямой выстрел над головой. */
  heroY: number;
  heroBottom: number;
  /** Левый край кадра: отставший за него враг исчезает. */
  viewLeft: number;
  solidAt: SolidAt;
  shoot(x: number, y: number, options: ProjectileOptions): void;
};

export type EnemySpec = {
  hp: number;
  texture: string;
  flying?: boolean;
  /** Размер тела и отступ внутри спрайта. */
  body: [number, number, number, number];
  /** Высота спрайта над ногами — чтобы поставить на дно клетки. */
  height: number;
  wakeRange?: number;
};

/**
 * Враг на пути. Правило «всё приходит спереди»:
 * просыпается, только если стоит впереди героя, не бьёт в спину
 * и исчезает, отстав за левый край кадра.
 * Вызванные главарём на арене (`summoned`) это правило не соблюдают.
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  readonly kind: EnemyKind;
  readonly flying: boolean;
  summoned = false;
  protected hp: number;
  protected dir = -1;
  protected awake = false;
  private readonly wakeRange: number;

  constructor(scene: Phaser.Scene, x: number, feetY: number, kind: EnemyKind, spec: EnemySpec) {
    super(scene, x, feetY - spec.height / 2, spec.texture);
    this.kind = kind;
    this.hp = spec.hp;
    this.flying = spec.flying ?? false;
    this.wakeRange = spec.wakeRange ?? WAKE_RANGE;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    this.setFlipX(true);

    const body = this.arcade;
    const [w, h, ox, oy] = spec.body;
    body.setSize(w, h).setOffset(ox, oy);
    if (this.flying) body.setAllowGravity(false);
    else body.setMaxVelocityY(MAX_FALL_SPEED);
  }

  get arcade() {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  summon() {
    this.summoned = true;
    this.awake = true;
  }

  update(ctx: EnemyContext) {
    if (!this.active) return;
    if (!this.summoned && this.x < ctx.viewLeft - 48) {
      this.disableBody(true, true);
      return;
    }
    if (!this.awake) {
      const ahead = this.x > ctx.heroX - 8;
      if (!ahead || this.x - ctx.heroX > this.wakeRange) return;
      this.awake = true;
      this.onWake(ctx);
    }
    this.act(ctx);
  }

  /** Щит держит стрелы, летящие ему в лицо. */
  blocksArrow(_vx: number, _vy: number) {
    return false;
  }

  /** true, если враг погиб. */
  hurt(damage: number) {
    if (!this.active) return false;
    this.hp -= damage;
    this.awake = true;
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

  protected onWake(_ctx: EnemyContext) {}

  protected abstract act(ctx: EnemyContext): void;

  /** Герой уже прошёл мимо — в спину не бьём. */
  protected behind(ctx: EnemyContext) {
    return !this.summoned && ctx.heroX > this.x + 16;
  }

  protected face(dir: number) {
    if (dir !== 0) this.dir = Math.sign(dir);
    this.setFlipX(this.dir < 0);
  }

  protected faceHero(ctx: EnemyContext) {
    this.face(ctx.heroX - this.x);
  }

  /** Ходит туда-сюда, разворачиваясь у стен и краёв. */
  protected patrol(ctx: EnemyContext, speed: number) {
    const body = this.arcade;
    if (body.blocked.left) this.dir = 1;
    if (body.blocked.right) this.dir = -1;
    if (body.blocked.down && !ctx.solidAt(this.x + this.dir * (body.width / 2 + 2), body.bottom + 4)) this.dir = -this.dir;
    body.setVelocityX(this.dir * speed);
    this.face(this.dir);
  }

  /** Вспышка перед атакой — у каждого врага есть «замах», чтобы успеть среагировать. */
  protected tell(on: boolean) {
    if (on) this.setTint(0xf2d48a);
    else this.clearTint();
  }

  /** Скорость броска по дуге, чтобы попасть в точку за `flight` секунд. */
  protected lob(fromX: number, fromY: number, toX: number, toY: number, flight: number, gravity: number) {
    return {
      vx: (toX - fromX) / flight,
      vy: (toY - fromY - 0.5 * gravity * flight * flight) / flight,
    };
  }
}
