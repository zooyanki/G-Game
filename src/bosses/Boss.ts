import Phaser from 'phaser';
import type { EnemyKind } from '../enemies';
import type { ProjectileOptions } from '../entities/Projectile';

export type BossKind = 'bandit' | 'bolotnik' | 'volot' | 'tugarin';

export type BossDef = {
  kind: BossKind;
  name: string;
  hp: number;
};

export type Arena = { left: number; right: number; ground: number };

/** Что главарь просит у сцены. */
export type BossHooks = {
  spawn(x: number, y: number, options: ProjectileOptions): void;
  summon(kind: EnemyKind, x: number, feetY: number): void;
  shake(ms: number, intensity: number): void;
  arena: Arena;
};

export type BossContext = {
  now: number;
  /** Секунды с прошлого кадра. */
  dt: number;
  heroX: number;
  heroY: number;
  heroBottom: number;
};

export function bossTexture(kind: BossKind) {
  return `boss-${kind}`;
}

/**
 * Общее у всех главарей: здоровье, три фазы (2/3 и 1/3 здоровья),
 * вступление, вспышка от удара. Сами атаки и поведение — в наследниках.
 */
export abstract class Boss extends Phaser.Physics.Arcade.Sprite {
  readonly def: BossDef;
  hp: number;
  dead = false;
  protected phase = 1;
  protected readonly hooks: BossHooks;
  protected readonly introUntil: number;

  constructor(scene: Phaser.Scene, x: number, y: number, def: BossDef, hooks: BossHooks) {
    super(scene, x, y, bossTexture(def.kind));
    this.def = def;
    this.hp = def.hp;
    this.hooks = hooks;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);
    this.introUntil = scene.time.now + 1400;
  }

  get arcade() {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /** Можно ли сейчас ранить. Болотник под водой — нельзя. */
  get vulnerable() {
    return !this.dead && this.scene.time.now >= this.introUntil && this.visible;
  }

  /** Ранит ли касание. */
  get harmful() {
    return !this.dead && this.scene.time.now >= this.introUntil && this.visible && this.arcade.enable;
  }

  /** Доля снятого здоровья — для полоски «пройдено» на экране смерти. */
  get beaten() {
    return 1 - Math.max(0, this.hp) / this.def.hp;
  }

  /** В третьей фазе всё быстрее. */
  protected get tempo() {
    return this.phase === 3 ? 1.3 : this.phase === 2 ? 1.1 : 1;
  }

  /** true — главарь повержен этим ударом. */
  hurt(damage: number) {
    if (!this.vulnerable) return false;
    this.hp -= damage;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (!this.dead) this.restoreTint();
    });

    if (this.hp <= 0) {
      this.dead = true;
      this.arcade.setVelocity(0, 0);
      this.clearTint();
      this.onDeath();
      return true;
    }

    const phase = this.hp <= this.def.hp / 3 ? 3 : this.hp <= (this.def.hp * 2) / 3 ? 2 : 1;
    if (phase !== this.phase) {
      this.phase = phase;
      this.hooks.shake(400, 0.01);
      this.onPhase(phase);
    }
    return false;
  }

  abstract think(ctx: BossContext): void;

  protected onPhase(_phase: number) {}

  protected onDeath() {}

  /** Белёсая вспышка — «замах» перед атакой. */
  protected tell(on: boolean) {
    if (on) this.setTint(0xfff0c0);
    else {
      this.restoreTint();
      this.setAngle(0);
    }
  }

  /** В третьей фазе главарь краснеет от злости. */
  protected restoreTint() {
    if (this.phase === 3) this.setTint(0xffb0a0);
    else this.clearTint();
  }

  protected pick<T>(options: T[], last: T | null) {
    const pool = options.length > 1 ? options.filter((option) => option !== last) : options;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Дрожь перед атакой. Без сдвига по x, чтобы главарь не уползал. */
  protected jitter(now: number) {
    this.setAngle(Math.floor(now / 40) % 2 === 0 ? 2 : -2);
  }
}
