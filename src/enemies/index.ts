import Phaser from 'phaser';
import type { Enemy, EnemyKind } from './Enemy';
import { Bandit, Raven, ShieldBearer, Slinger } from './forest';
import { Boar, Lobber } from './hills';
import { Hawk, Rider, SteppeArcher } from './steppe';
import { Kikimora, Spitter, Wisp } from './swamp';

export type { EnemyContext, EnemyKind, SolidAt } from './Enemy';
export { Enemy } from './Enemy';
export { Wisp } from './swamp';

const KINDS: Record<EnemyKind, new (scene: Phaser.Scene, x: number, feetY: number) => Enemy> = {
  bandit: Bandit,
  shield: ShieldBearer,
  slinger: Slinger,
  raven: Raven,
  kikimora: Kikimora,
  wisp: Wisp,
  spitter: Spitter,
  boar: Boar,
  lobber: Lobber,
  rider: Rider,
  archer: SteppeArcher,
  hawk: Hawk,
};

export function createEnemy(scene: Phaser.Scene, kind: EnemyKind, x: number, feetY: number) {
  return new KINDS[kind](scene, x, feetY);
}
