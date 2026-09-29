import Phaser from 'phaser';
import { BLESSING_HOLD_MS, SCREEN_WIDTH } from '../constants';

const HAND_IN_MS = 500;
const HAND_OUT_MS = 450;
/** Сколько рука на экране от появления до ухода — всё это время герой под защитой. */
export const BLESSING_MS = HAND_IN_MS + BLESSING_HOLD_MS + HAND_OUT_MS;

/**
 * Столб света с неба: раскрывается из нити, вспыхивает и гаснет.
 * С `target` луч держится на цели, даже если главарь в разбеге.
 */
export function strikeBeam(scene: Phaser.Scene, x: number, groundY: number, target?: { x: number }) {
  const beam = scene.add.image(x, 0, 'beam').setOrigin(0.5, 0).setDepth(14).setScale(0, 1);
  beam.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: beam, scaleX: 1, duration: 120, ease: 'Sine.easeOut' });
  scene.tweens.add({
    targets: beam,
    alpha: 0,
    scaleX: 0.3,
    delay: 380,
    duration: 420,
    onUpdate: () => {
      if (target) beam.x = target.x;
    },
    onComplete: () => beam.destroy(),
  });

  const burst = scene.add.image(x, groundY, 'halo').setDepth(14).setScale(0.2).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: burst, scale: 0.7, alpha: 0, duration: 500, onComplete: () => burst.destroy() });
}

/**
 * После луча: из правого верхнего угла по диагонали выдвигается рука
 * с поднятым большим пальцем, покачивается и уезжает обратно.
 */
export function showBlessingHand(scene: Phaser.Scene) {
  const restX = SCREEN_WIDTH - 36;
  const restY = 36;
  const hand = scene.add.container(SCREEN_WIDTH + 50, -50).setScrollFactor(0).setDepth(160);
  const halo = scene.add.image(-6, 6, 'halo').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8);
  hand.add([halo, scene.add.image(0, 0, 'god-hand')]);

  scene.tweens.add({ targets: halo, scale: 1.15, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
  scene.tweens.chain({
    targets: hand,
    tweens: [
      { x: restX, y: restY, duration: HAND_IN_MS, ease: 'Back.easeOut' },
      { angle: -6, duration: 300, yoyo: true, repeat: Math.max(0, Math.round(BLESSING_HOLD_MS / 600) - 1), ease: 'Sine.easeInOut' },
      { x: SCREEN_WIDTH + 50, y: -50, duration: HAND_OUT_MS, ease: 'Sine.easeIn' },
    ],
    onComplete: () => hand.destroy(),
  });
}
