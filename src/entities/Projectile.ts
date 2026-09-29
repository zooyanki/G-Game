import Phaser from 'phaser';
import { SWORD_DAMAGE } from '../constants';

/**
 * Что делает снаряд, коснувшись земли:
 * break — разбивается, roll — катится дальше (бревно, валун), burn — догорает на месте.
 */
export type Landing = 'break' | 'roll' | 'burn';

export type ProjectileOptions = {
  texture: string;
  vx: number;
  vy: number;
  /** Стрела летит героем, камень и топор — врагом. Отбитый мечом снаряд меняет сторону. */
  friendly: boolean;
  damage: number;
  gravity?: number;
  /** Вращение в рад/с; без него спрайт смотрит по направлению полёта. */
  spin?: number;
  /** Ударная волна главаря ползёт по земле и сквозь доски. */
  ignoreTiles?: boolean;
  /** Не поворачивать спрайт по полёту. */
  upright?: boolean;
  landing?: Landing;
  rollSpeed?: number;
  /** Через сколько мс исчезнуть само — пламя на земле. */
  ttl?: number;
  /** Удар дубины великана мечом не отбить. */
  reflectable?: boolean;
};

const BURN_MS = 1200;

/**
 * Снаряд без физического тела: сцена двигает его сама и проверяет попадание
 * по отрезку прошлый кадр → этот кадр. Тело, созданное посреди разбора
 * столкновений, включалось в конце кадра и зацикливало шаг физики.
 */
export class Projectile extends Phaser.GameObjects.Sprite {
  vx: number;
  vy: number;
  friendly: boolean;
  damage: number;
  prevX: number;
  prevY: number;
  rolling = false;
  readonly ignoreTiles: boolean;
  readonly reflectable: boolean;
  private gravity: number;
  private readonly baseGravity: number;
  private readonly spin: number;
  private upright: boolean;
  private landing: Landing;
  private readonly rollSpeed: number;
  private dieAt: number;

  constructor(scene: Phaser.Scene, x: number, y: number, options: ProjectileOptions) {
    super(scene, x, y, options.texture);
    scene.add.existing(this);
    this.setDepth(11);
    this.vx = options.vx;
    this.vy = options.vy;
    this.friendly = options.friendly;
    this.damage = options.damage;
    this.gravity = options.gravity ?? 0;
    this.baseGravity = this.gravity;
    this.spin = options.spin ?? 0;
    this.ignoreTiles = options.ignoreTiles ?? false;
    this.upright = options.upright ?? false;
    this.landing = options.landing ?? 'break';
    this.rollSpeed = options.rollSpeed ?? 110;
    this.reflectable = options.reflectable ?? true;
    this.dieAt = options.ttl ? scene.time.now + options.ttl : Infinity;
    this.prevX = x;
    this.prevY = y;
    this.face();
  }

  step(delta: number) {
    const dt = delta / 1000;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.face(dt);
  }

  /** Не разбивается о землю, а катится или горит. */
  get settles() {
    return this.landing !== 'break' && !this.friendly;
  }

  expired(now: number) {
    return now >= this.dieAt;
  }

  path() {
    return new Phaser.Geom.Line(this.prevX, this.prevY, this.x, this.y);
  }

  /** Коснулся земли сверху. true — снаряд живёт дальше: катится или горит. */
  land(surfaceY: number, now: number) {
    if (this.landing === 'break') return false;
    this.y = surfaceY - this.displayHeight / 2;
    this.vy = 0;
    this.gravity = 0;

    if (this.landing === 'roll') {
      this.rolling = true;
      this.vx = Math.sign(this.vx || -1) * this.rollSpeed;
      return true;
    }

    this.vx = 0;
    this.upright = true;
    this.rotation = 0;
    this.landing = 'break';
    this.setTexture('flame');
    this.dieAt = now + BURN_MS;
    return true;
  }

  /** Катился и потерял опору под собой — снова падает. */
  drop() {
    if (!this.rolling) return;
    this.rolling = false;
    this.gravity = this.baseGravity || 700;
  }

  /** Меч отбивает снаряд обратно — теперь он бьёт врагов с силой меча. */
  reflect() {
    if (!this.reflectable) return false;
    this.vx = -this.vx * 1.3;
    // Катящееся бревно отбитым тоже катится, а не взлетает.
    this.vy = this.rolling ? 0 : -Math.abs(this.vy) * 0.5 - 40;
    this.friendly = true;
    this.damage = SWORD_DAMAGE;
    this.setTint(0xf2d48a);
    return true;
  }

  private face(dt = 0) {
    if (this.upright) return;
    if (this.spin) this.rotation += this.spin * dt;
    else this.rotation = Math.atan2(this.vy, this.vx);
  }
}
