import Phaser from 'phaser';
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_REACH,
  ATTACK_THICKNESS,
  BOW_COOLDOWN_MS,
  DEFAULT_FACING,
  HERO_LIVES,
  HERO_SPEED,
  INVULNERABLE_MS,
  SPRITE,
  type Facing,
} from '../constants';
import { Arrow } from './Arrow';
import { heroTexture } from '../textures';

export type HeroKind = 'sword' | 'bow';

export class Hero extends Phaser.Physics.Arcade.Sprite {
  lives = HERO_LIVES;
  facing: Facing = DEFAULT_FACING;
  readonly kind: HeroKind;

  private invulnerableUntil = 0;
  private attackCooldownUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: HeroKind = 'sword') {
    super(scene, x, y, heroTexture(kind, DEFAULT_FACING));
    this.kind = kind;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setCollideWorldBounds(true);
    this.bodySize();
  }

  move(dirX: number, dirY: number) {
    if (dirX === 0 && dirY === 0) {
      this.setVelocity(0, 0);
      return;
    }

    const length = Math.hypot(dirX, dirY);
    this.setVelocity((dirX / length) * HERO_SPEED, (dirY / length) * HERO_SPEED);
    this.facing = facingFromVector(dirX, dirY);
    this.setTexture(heroTexture(this.kind, this.facing));
  }

  halt() {
    this.setVelocity(0, 0);
  }

  /**
   * Мечник возвращает прямоугольник удара перед собой.
   * Лучник возвращает выпущенную стрелу: сцена добавляет её в группу,
   * чтобы проверять попадание. null — удар ещё на перезарядке.
   */
  tryAttack(now: number): Phaser.Geom.Rectangle | Arrow | null {
    if (now < this.attackCooldownUntil) return null;
    this.attackCooldownUntil = now + (this.kind === 'bow' ? BOW_COOLDOWN_MS : ATTACK_COOLDOWN_MS);
    if (this.kind === 'bow') return new Arrow(this.scene, this.x, this.y, this.facing);
    return this.attackRect();
  }

  /** true, если жизнь действительно сняли. Повторные касания в течение секунды не считаются. */
  hurt(now: number) {
    if (this.lives <= 0 || now < this.invulnerableUntil) return false;
    this.lives -= 1;
    this.invulnerableUntil = now + INVULNERABLE_MS;
    return true;
  }

  tick(now: number) {
    const blinking = now < this.invulnerableUntil;
    this.setAlpha(blinking && Math.floor(now / 80) % 2 === 0 ? 0.35 : 1);
  }

  private attackRect() {
    const half = SPRITE / 2;
    if (this.facing === 'up') {
      return new Phaser.Geom.Rectangle(
        this.x - ATTACK_THICKNESS / 2,
        this.y - half - ATTACK_REACH,
        ATTACK_THICKNESS,
        ATTACK_REACH,
      );
    }
    if (this.facing === 'down') {
      return new Phaser.Geom.Rectangle(this.x - ATTACK_THICKNESS / 2, this.y + half, ATTACK_THICKNESS, ATTACK_REACH);
    }
    if (this.facing === 'left') {
      return new Phaser.Geom.Rectangle(this.x - half - ATTACK_REACH, this.y - ATTACK_THICKNESS / 2, ATTACK_REACH, ATTACK_THICKNESS);
    }
    return new Phaser.Geom.Rectangle(this.x + half, this.y - ATTACK_THICKNESS / 2, ATTACK_REACH, ATTACK_THICKNESS);
  }

  private bodySize() {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 12, true);
  }
}

function facingFromVector(x: number, y: number): Facing {
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}
