import Phaser from 'phaser';
import {
  ARROW_SPEED,
  BOW_COOLDOWN_MS,
  COYOTE_MS,
  HERO_SPEED,
  INVULNERABLE_MS,
  JUMP_BUFFER_MS,
  JUMP_CUT_SPEED,
  JUMP_SPEED,
  KNOCKBACK_MS,
  MAX_FALL_SPEED,
  SWAP_COOLDOWN_MS,
  SWORD_COOLDOWN_MS,
  SWORD_REACH,
} from '../constants';
import { dev } from '../dev';
import type { Frame } from '../input/controls';
import type { GearStats } from '../loot/items';
import { progress } from '../progress';
import { heroTexture, type HeroKind, type HeroPose } from '../textures';
import { Projectile } from './Projectile';

export type Slash = {
  rect: Phaser.Geom.Rectangle;
  /** Удар вниз в прыжке: попал — героя подбрасывает. */
  down: boolean;
  angle: number;
};

export type Attack = { arrow: Projectile } | { slash: Slash };

const STAND_HEIGHT = 20;
/** Присевший герой ниже камня пращника: тот целится в грудь стоящему. */
const CROUCH_HEIGHT = 12;

/**
 * Один герой на двоих: смена меча на лук меняет только `kind`,
 * тело и позиция остаются — так смена в прыжке не ломает физику.
 */
export class Hero extends Phaser.Physics.Arcade.Sprite {
  kind: HeroKind = 'sword';
  hp = 3;
  maxHp = 3;
  facing = 1;
  crouching = false;
  readonly topDown: boolean;
  readonly stats: GearStats;

  private lastGroundAt = -Infinity;
  private jumpQueuedAt = -Infinity;
  private invulnerableUntil = 0;
  /** Защита благодатью после супер-удара: не мерцает, а светится. */
  private blessedUntil = 0;
  private knockbackUntil = 0;
  private cooldownUntil = 0;
  private swapReadyAt = 0;

  /**
   * Сбоку `y` — ноги на земле. Сверху `y` — центр спрайта.
   * Цифры урона и жизней берутся из надетого лута.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, topDown = false) {
    super(scene, x, topDown ? y : y - 12, heroTexture('sword', 'stand'));
    this.topDown = topDown;
    this.stats = progress.stats();
    this.maxHp = this.stats.hp;
    this.hp = this.maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, STAND_HEIGHT).setOffset(3, 24 - STAND_HEIGHT);
    if (topDown) {
      body.setAllowGravity(false);
      body.setMaxVelocity(HERO_SPEED * 1.4, HERO_SPEED * 1.4);
      body.setDrag(0, 0);
    } else {
      body.setMaxVelocityY(MAX_FALL_SPEED);
    }
    this.setCollideWorldBounds(true);
  }

  get arcade() {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get onGround() {
    return this.arcade.blocked.down;
  }

  get invulnerable() {
    const now = this.scene.time.now;
    return now < this.invulnerableUntil || now < this.blessedUntil;
  }

  /**
   * `solidAt` нужен, чтобы не встать под камнем: из приседа герой выпрямляется,
   * только если над головой пусто. `speedFactor` < 1 — трясина.
   */
  control(frame: Frame, now: number, solidAt: (x: number, y: number) => boolean, speedFactor = 1) {
    const body = this.arcade;
    if (this.onGround) this.lastGroundAt = now;
    if (frame.jumpPressed) this.jumpQueuedAt = now;

    // Приседаем строго вниз: на телефоне бег с пальцем чуть ниже центра не должен останавливать.
    const wantsCrouch = this.onGround && frame.y > 0 && frame.x === 0;
    const headTop = body.bottom - STAND_HEIGHT + 1;
    const blockedAbove = solidAt(body.left + 1, headTop) || solidAt(body.right - 1, headTop);
    this.setCrouch(wantsCrouch || (this.crouching && blockedAbove));

    if (now >= this.knockbackUntil) {
      body.setVelocityX(this.crouching ? 0 : frame.x * HERO_SPEED * speedFactor * this.stats.speed);
      if (frame.x !== 0) this.facing = frame.x;
    }
    if (this.crouching) this.jumpQueuedAt = -Infinity;

    const wantsJump = now - this.jumpQueuedAt <= JUMP_BUFFER_MS;
    const canJump = now - this.lastGroundAt <= COYOTE_MS;
    if (wantsJump && canJump) {
      body.setVelocityY(-JUMP_SPEED);
      this.jumpQueuedAt = -Infinity;
      this.lastGroundAt = -Infinity;
    }
    if (!frame.jumpHeld && body.velocity.y < -JUMP_CUT_SPEED) body.setVelocityY(-JUMP_CUT_SPEED);

    this.setFlipX(this.facing < 0);
    this.setTexture(heroTexture(this.kind, this.pose(now)));
    this.glow(now);
  }

  /** Вид сверху: восемь сторон, без прыжка. */
  steer(frame: Frame, now: number) {
    const body = this.arcade;
    if (now >= this.knockbackUntil) {
      let x = frame.x;
      let y = frame.y;
      const length = Math.hypot(x, y);
      if (length > 1) {
        x /= length;
        y /= length;
      }
      const speed = HERO_SPEED * this.stats.speed;
      body.setVelocity(x * speed, y * speed);
      if (x !== 0) this.facing = x;
    }
    this.setFlipX(this.facing < 0);
    this.setTexture(heroTexture(this.kind, Math.hypot(body.velocity.x, body.velocity.y) > 8 ? this.runPose(now) : 'stand'));
    this.glow(now);
  }

  /** Мерцание после удара врага или золотое свечение под защитой благодати. */
  glow(now: number) {
    if (now < this.blessedUntil) {
      this.setAlpha(1);
      this.setTint(Math.floor(now / 120) % 2 === 0 ? 0xfff0c0 : 0xf2d48a);
      return;
    }
    this.clearTint();
    const blinking = now < this.invulnerableUntil;
    this.setAlpha(blinking && Math.floor(now / 80) % 2 === 0 ? 0.35 : 1);
  }

  /** Вернёт false, если смена ещё на перезарядке. */
  swap(now: number) {
    if (now < this.swapReadyAt) return false;
    this.swapReadyAt = now + SWAP_COOLDOWN_MS;
    this.kind = this.kind === 'sword' ? 'bow' : 'sword';
    this.cooldownUntil = Math.min(this.cooldownUntil, now + 80);
    return true;
  }

  /** Атака при удержанной кнопке: стрела или взмах меча. null — перезарядка. */
  tryAttack(frame: Frame, now: number): Attack | null {
    if (now < this.cooldownUntil) return null;
    const aim = this.aim(frame);

    if (this.kind === 'bow') {
      this.cooldownUntil = now + BOW_COOLDOWN_MS;
      const length = Math.hypot(aim.x, aim.y);
      const dx = aim.x / length;
      const dy = aim.y / length;
      const fromY = this.crouching ? this.y + 6 : this.y - 2;
      const arrow = new Projectile(this.scene, this.x + dx * 8, fromY + dy * 8, {
        texture: 'arrow',
        vx: dx * ARROW_SPEED,
        vy: dy * ARROW_SPEED,
        friendly: true,
        damage: this.stats.bow,
      });
      return { arrow };
    }

    this.cooldownUntil = now + SWORD_COOLDOWN_MS;
    return { slash: this.slash(aim) };
  }

  /** true, если жизнь действительно сняли. */
  hurt(fromX: number, now: number) {
    if (this.hp <= 0 || this.invulnerable) return false;
    if (!dev.god) {
      if (this.hp <= 1 && progress.useBandage()) this.hp = 1;
      else this.hp -= 1;
    }
    this.invulnerableUntil = now + INVULNERABLE_MS;
    this.knockbackUntil = now + KNOCKBACK_MS;
    if (this.topDown) {
      const away = Math.sign(this.x - fromX) || this.facing;
      this.arcade.setVelocity(away * 140, 0);
    } else {
      const away = this.x < fromX ? -1 : 1;
      this.arcade.setVelocity(away * 140, -200);
    }
    return true;
  }

  /** Упал в пропасть: жизнь уходит всегда, даже в мерцании. */
  fell(to: { x: number; y: number }, now: number) {
    if (!dev.god) {
      if (this.hp <= 1 && progress.useBandage()) this.hp = 1;
      else this.hp -= 1;
    }
    this.setPosition(to.x, to.y - 12);
    this.arcade.setVelocity(0, 0);
    this.invulnerableUntil = now + INVULNERABLE_MS;
  }

  /** Неуязвимость без урона — на время супер-удара и благословения. */
  protect(now: number, ms: number) {
    this.blessedUntil = Math.max(this.blessedUntil, now + ms);
  }

  bounce(speed: number) {
    this.arcade.setVelocityY(-speed);
  }

  halt() {
    this.arcade.setVelocity(0, 0);
    this.arcade.setAllowGravity(false);
  }

  /**
   * 8 направлений как в Cuphead. На земле вниз не стреляем — стрела ушла бы в пол,
   * а без направления бьём туда, куда смотрим.
   */
  private aim(frame: Frame) {
    let x = frame.x;
    let y = frame.y;
    if (!this.topDown && this.onGround && y > 0) y = 0;
    if (x === 0 && y === 0) x = this.facing;
    return { x, y };
  }

  private slash(aim: { x: number; y: number }): Slash {
    const reach = SWORD_REACH;
    if (aim.y < 0) {
      return { rect: new Phaser.Geom.Rectangle(this.x - 14, this.y - 12 - reach, 28, reach), down: false, angle: -Math.PI / 2 };
    }
    if (aim.y > 0) {
      return { rect: new Phaser.Geom.Rectangle(this.x - 14, this.y + 8, 28, reach), down: true, angle: Math.PI / 2 };
    }
    const x = this.facing > 0 ? this.x + 3 : this.x - 3 - reach;
    const top = this.crouching ? this.y - 4 : this.y - 14;
    return {
      rect: new Phaser.Geom.Rectangle(x, top, reach, 28),
      down: false,
      angle: this.facing > 0 ? 0 : Math.PI,
    };
  }

  /** Низкое тело — снаряды на уровне груди пролетают над головой. Ноги остаются на месте. */
  private setCrouch(crouch: boolean) {
    if (crouch === this.crouching) return;
    this.crouching = crouch;
    const height = crouch ? CROUCH_HEIGHT : STAND_HEIGHT;
    this.arcade.setSize(10, height).setOffset(3, 24 - height);
  }

  private pose(now: number): HeroPose {
    if (this.crouching) return 'crouch';
    if (!this.onGround) return 'jump';
    if (Math.abs(this.arcade.velocity.x) < 1) return 'stand';
    return Math.floor(now / 110) % 2 === 0 ? 'run0' : 'run1';
  }

  private runPose(now: number): HeroPose {
    return Math.floor(now / 110) % 2 === 0 ? 'run0' : 'run1';
  }
}
