import Phaser from 'phaser';
import { AGGRO_RANGE, ENEMY_LIVES, ENEMY_SPEED } from '../constants';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private lives = ENEMY_LIVES;
  readonly missionId?: string;

  constructor(scene: Phaser.Scene, x: number, y: number, missionId?: string) {
    super(scene, x, y, 'enemy');
    this.missionId = missionId;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(10);
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(12, 12, true);
  }

  chase(targetX: number, targetY: number) {
    if (!this.active) return;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.hypot(dx, dy);

    if (distance > AGGRO_RANGE || distance < 0.001) {
      this.setVelocity(0, 0);
      return;
    }

    this.setVelocity((dx / distance) * ENEMY_SPEED, (dy / distance) * ENEMY_SPEED);
  }

  /** Меч убивает сразу, стрела снимает одну жизнь из двух. */
  hurt(damage: number) {
    if (!this.active) return;
    this.lives -= damage;
    if (this.lives > 0) {
      this.setAlpha(0.55);
      this.scene.time.delayedCall(90, () => {
        if (this.active) this.setAlpha(1);
      });
      return;
    }
    this.disableBody(true, true);
    this.scene.add.image(this.x, this.y, 'coin').setDepth(4).setData('coin', true);
    this.scene.events.emit('enemy-killed', this.missionId);
  }
}
