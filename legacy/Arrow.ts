import Phaser from 'phaser';
import { ARROW_SPEED, type Facing } from '../constants';

/**
 * Летит сама на событии update сцены, без физического тела.
 * Тело, созданное посреди разбора столкновений, включалось в конце
 * кадра и зацикливало шаг физики.
 *
 * Движение здесь, а не только в массиве сцены: иначе при сбое
 * регистрации стрела остаётся висеть на месте выстрела.
 */
export class Arrow extends Phaser.GameObjects.Sprite {
  private readonly vx: number;
  private readonly vy: number;
  /** Точка до шага кадра — для проверки попадания по всему отрезку. */
  prevX: number;
  prevY: number;

  constructor(scene: Phaser.Scene, x: number, y: number, facing: Facing) {
    super(scene, x, y, `arrow-${facing}`);
    scene.add.existing(this);
    this.setDepth(11);

    const speed = velocity(facing);
    this.vx = speed.x;
    this.vy = speed.y;
    this.prevX = x;
    this.prevY = y;

    scene.events.on('update', this.onUpdate, this);
    scene.events.once('shutdown', this.onShutdown, this);
  }

  private onUpdate(_time: number, delta: number) {
    if (!this.active || !this.scene || !this.scene.sys.isActive()) return;

    this.prevX = this.x;
    this.prevY = this.y;
    this.x += (this.vx * delta) / 1000;
    this.y += (this.vy * delta) / 1000;

    const world = this.scene.physics?.world;
    if (!world) return;
    const bounds = world.bounds;
    if (this.x < bounds.x || this.x > bounds.right || this.y < bounds.y || this.y > bounds.bottom) {
      this.kill();
    }
  }

  private onShutdown() {
    this.scene?.events.off('update', this.onUpdate, this);
  }

  /** Убрать стрелу после попадания или вылета за карту. */
  kill() {
    this.scene?.events.off('update', this.onUpdate, this);
    this.scene?.events.off('shutdown', this.onShutdown, this);
    this.destroy();
  }
}

function velocity(facing: Facing) {
  if (facing === 'up') return { x: 0, y: -ARROW_SPEED };
  if (facing === 'down') return { x: 0, y: ARROW_SPEED };
  if (facing === 'left') return { x: -ARROW_SPEED, y: 0 };
  return { x: ARROW_SPEED, y: 0 };
}
