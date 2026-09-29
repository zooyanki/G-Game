import Phaser from 'phaser';
import { Boss, type BossContext, type BossDef, type BossHooks } from './Boss';

type Mode = 'surface' | 'spit-tell' | 'summon-tell' | 'sink' | 'under' | 'erupt-tell' | 'erupt';
type Move = 'spit' | 'summon' | 'sink';

const BLOB_GRAVITY = 520;
const FEET_OFFSET = 20;

/**
 * Новгород. Болотник уходит под трясину — по арене ползёт рябь.
 * Рябь замирает под героем и пускает пузыри: беги, сейчас он вынырнет с брызгами.
 * Над водой плюётся комьями тины, со второй фазы зовёт огоньков.
 * Под водой неуязвим — бить можно, только пока он на поверхности.
 */
export class Bolotnik extends Boss {
  private mode: Mode = 'surface';
  private modeUntil = 0;
  private lastMove: Move | null = null;
  private movesOnSurface = 0;
  private readonly ripple: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, def: BossDef, hooks: BossHooks) {
    super(scene, hooks.arena.right - 56, hooks.arena.ground - FEET_OFFSET, def, hooks);
    this.arcade.setSize(30, 34).setOffset(5, 6);
    this.setCollideWorldBounds(true);
    this.setFlipX(true);
    this.modeUntil = this.introUntil;
    this.ripple = scene.add.image(this.x, hooks.arena.ground - 3, 'ripple').setDepth(8).setVisible(false);
    this.once('destroy', () => this.ripple.destroy());
  }

  get vulnerable() {
    return super.vulnerable && (this.mode === 'surface' || this.mode.endsWith('-tell') || this.mode === 'erupt');
  }

  protected onDeath() {
    this.ripple.setVisible(false);
  }

  think(ctx: BossContext) {
    if (this.dead) return;
    const body = this.arcade;
    const ground = this.hooks.arena.ground;

    if (this.mode === 'under') {
      const step = 95 * this.tempo * ctx.dt;
      this.ripple.x += Phaser.Math.Clamp(ctx.heroX - this.ripple.x, -step, step);
      this.ripple.setScale(1 + Math.sin(ctx.now / 90) * 0.1, 1);
      if (ctx.now >= this.modeUntil) this.enter('erupt-tell', 650 / this.tempo);
      return;
    }

    if (this.mode === 'erupt-tell') {
      if (Math.floor(ctx.now / 80) % 3 === 0) this.bubble();
      if (ctx.now < this.modeUntil) return;
      this.erupt();
      return;
    }

    if (this.mode === 'erupt') {
      if (body.blocked.down && body.velocity.y >= 0 && ctx.now > this.modeUntil) this.enter('surface', 700 / this.tempo);
      return;
    }

    if (ctx.now < this.modeUntil) {
      if (this.mode === 'surface') this.setFlipX(ctx.heroX < this.x);
      if (this.mode.endsWith('-tell')) this.jitter(ctx.now);
      return;
    }

    switch (this.mode) {
      case 'spit-tell':
        this.tell(false);
        this.spit(ctx, this.phase === 3 ? 5 : 3);
        this.enter('surface', 800 / this.tempo);
        return;
      case 'summon-tell':
        this.tell(false);
        for (const dx of [-36, 36]) this.hooks.summon('wisp', this.x + dx, this.y - 28);
        this.enter('surface', 900 / this.tempo);
        return;
      case 'sink':
        this.setVisible(false);
        body.enable = false;
        this.ripple.setPosition(this.x, ground - 3).setVisible(true);
        this.enter('under', 1700 / this.tempo);
        return;
      default:
        this.chooseMove();
    }
  }

  private chooseMove() {
    // Два действия над водой — и обратно в трясину.
    const moves: Move[] = this.phase === 1 ? ['spit'] : ['spit', 'summon'];
    const move: Move = this.movesOnSurface >= 2 ? 'sink' : this.pick(moves, this.lastMove);
    this.lastMove = move;

    if (move === 'sink') {
      this.movesOnSurface = 0;
      this.tell(false);
      this.scene.tweens.add({ targets: this, y: this.y + 16, alpha: 0.2, duration: 400 });
      this.enter('sink', 420);
      return;
    }

    this.movesOnSurface += 1;
    this.tell(true);
    this.enter(`${move}-tell`, (move === 'spit' ? 500 : 650) / this.tempo);
  }

  private erupt() {
    const ground = this.hooks.arena.ground;
    this.ripple.setVisible(false);
    this.setPosition(this.ripple.x, ground - FEET_OFFSET).setAlpha(1).setVisible(true);
    this.arcade.enable = true;
    this.arcade.reset(this.x, this.y);
    this.arcade.setVelocity(0, -330);
    this.hooks.shake(250, 0.012);
    for (const dir of [-1, 1]) {
      this.hooks.spawn(this.x + dir * 10, ground - 30, {
        texture: 'blob',
        vx: dir * 120,
        vy: -260,
        gravity: BLOB_GRAVITY,
        friendly: false,
        damage: 1,
      });
    }
    this.enter('erupt', 250);
  }

  private spit(ctx: BossContext, count: number) {
    const fromY = this.y - 10;
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * 34;
      const flight = 0.8 + Math.abs(i - (count - 1) / 2) * 0.12;
      const targetX = ctx.heroX + spread;
      this.hooks.spawn(this.x, fromY, {
        texture: 'blob',
        vx: (targetX - this.x) / flight,
        vy: (ctx.heroBottom - 6 - fromY - 0.5 * BLOB_GRAVITY * flight * flight) / flight,
        gravity: BLOB_GRAVITY,
        friendly: false,
        damage: 1,
      });
    }
  }

  private bubble() {
    const bubble = this.scene.add.image(this.ripple.x + Phaser.Math.Between(-12, 12), this.hooks.arena.ground - 4, 'bubble').setDepth(12);
    this.scene.tweens.add({ targets: bubble, y: bubble.y - 18, alpha: 0, duration: 400, onComplete: () => bubble.destroy() });
  }

  private enter(mode: Mode, ms: number) {
    this.mode = mode;
    this.modeUntil = this.scene.time.now + ms;
  }
}
