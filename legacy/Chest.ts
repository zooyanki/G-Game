import Phaser from 'phaser';

const LOOT_MIN = 1;
const LOOT_MAX = 4;

/** Сундук на карте: закрыт, пока герой не откроет действием рядом. */
export class Chest extends Phaser.Physics.Arcade.Sprite {
  private opened = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'chest-closed');
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(6);
  }

  get isOpen() {
    return this.opened;
  }

  /** В зоне взаимодействия — чуть больше спрайта, чтобы не целиться пиксель в пиксель. */
  inReach(hero: Phaser.Geom.Rectangle) {
    const zone = this.getBounds();
    zone.x -= 4;
    zone.y -= 4;
    zone.width += 8;
    zone.height += 8;
    return Phaser.Geom.Intersects.RectangleToRectangle(hero, zone);
  }

  /**
   * Открывает сундук и возвращает число монет (1–4).
   * Повторно открыть нельзя — вернёт null.
   */
  tryOpen(): number | null {
    if (this.opened) return null;
    this.opened = true;
    this.setTexture('chest-open');
    return Phaser.Math.Between(LOOT_MIN, LOOT_MAX);
  }
}
