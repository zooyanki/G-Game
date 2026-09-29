import Phaser from 'phaser';
import { BanditChief } from './BanditChief';
import { Bolotnik } from './Bolotnik';
import type { Boss, BossDef, BossHooks, BossKind } from './Boss';
import { Tugarin } from './Tugarin';
import { Volot } from './Volot';

const KINDS: Record<BossKind, new (scene: Phaser.Scene, def: BossDef, hooks: BossHooks) => Boss> = {
  bandit: BanditChief,
  bolotnik: Bolotnik,
  volot: Volot,
  tugarin: Tugarin,
};

export function createBoss(scene: Phaser.Scene, def: BossDef, hooks: BossHooks): Boss {
  return new KINDS[def.kind](scene, def, hooks);
}

export { Boss, bossTexture } from './Boss';
export type { Arena, BossContext, BossDef, BossHooks, BossKind } from './Boss';
