import Phaser from 'phaser';
import type { Facing } from './constants';

export function heroTexture(kind: 'sword' | 'bow', facing: Facing) {
  return `hero-${kind}-${facing}`;
}

export function createTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('hero-up')) return;

  for (const facing of ['up', 'down', 'left', 'right'] as const) {
    paint(scene, `hero-sword-${facing}`, 16, 16, (g) => drawHero(g, 'sword', facing));
    paint(scene, `hero-bow-${facing}`, 16, 16, (g) => drawHero(g, 'bow', facing));
    paint(scene, `arrow-${facing}`, 8, 8, (g) => drawArrow(g, facing));
  }
  paint(scene, 'enemy', 16, 16, drawEnemy);
  paint(scene, 'rock', 16, 16, (g) => drawRock(g, false));
  paint(scene, 'rock-alt', 16, 16, (g) => drawRock(g, true));
  paint(scene, 'ship', 96, 40, drawShip);
  paint(scene, 'fallen', 14, 6, (g) => {
    g.fillStyle(0x5c2424);
    g.fillRect(0, 0, 14, 6);
    g.fillStyle(0x3a1818);
    g.fillRect(0, 0, 14, 2);
  });
  paint(scene, 'wounded', 14, 6, (g) => {
    g.fillStyle(0xa85a3a);
    g.fillRect(0, 0, 14, 6);
    g.fillStyle(0xf2d48a);
    g.fillRect(9, 1, 3, 3);
  });
  paint(scene, 'coin', 8, 8, (g) => {
    g.fillStyle(0xc8892a);
    g.fillRect(2, 0, 4, 8);
    g.fillRect(0, 2, 8, 4);
    g.fillStyle(0xf2d48a);
    g.fillRect(3, 1, 2, 6);
    g.fillRect(1, 3, 6, 2);
  });
  paint(scene, 'heart', 8, 8, (g) => {
    g.fillStyle(0xc23b3b);
    g.fillRect(0, 1, 3, 2);
    g.fillRect(5, 1, 3, 2);
    g.fillRect(0, 3, 8, 2);
    g.fillRect(1, 5, 6, 1);
    g.fillRect(2, 6, 4, 1);
    g.fillRect(3, 7, 2, 1);
  });
}

function paint(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
) {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

function drawHero(g: Phaser.GameObjects.Graphics, kind: 'sword' | 'bow', facing: Facing) {
  // Мечник в зелёном плаще, лучник в синем — так их видно издалека.
  g.fillStyle(kind === 'bow' ? 0x14283a : 0x173528);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(kind === 'bow' ? 0x2a5278 : 0x2f6b4f);
  g.fillRect(1, 1, 14, 14);
  g.fillStyle(0xf2d48a);
  if (facing === 'up') g.fillRect(4, 1, 8, 3);
  if (facing === 'down') g.fillRect(4, 12, 8, 3);
  if (facing === 'left') g.fillRect(1, 4, 3, 8);
  if (facing === 'right') g.fillRect(12, 4, 3, 8);
  g.fillStyle(0xc23b3b);
  g.fillRect(5, 7, 6, 2);
}

function drawArrow(g: Phaser.GameObjects.Graphics, facing: Facing) {
  g.fillStyle(0xf2d48a);
  if (facing === 'left' || facing === 'right') g.fillRect(0, 3, 8, 2);
  else g.fillRect(3, 0, 2, 8);
  g.fillStyle(0xf4f0e6);
  if (facing === 'right') g.fillRect(6, 2, 2, 4);
  if (facing === 'left') g.fillRect(0, 2, 2, 4);
  if (facing === 'down') g.fillRect(2, 6, 4, 2);
  if (facing === 'up') g.fillRect(2, 0, 4, 2);
}

function drawEnemy(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0x4a1616);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(0x8f2d2d);
  g.fillRect(1, 1, 14, 14);
  g.fillStyle(0xf4f0e6);
  g.fillRect(3, 4, 3, 3);
  g.fillRect(10, 4, 3, 3);
}

function drawRock(g: Phaser.GameObjects.Graphics, alt: boolean) {
  g.fillStyle(0x3a4048);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(0x4e5560);
  g.fillRect(1, 1, 14, 14);
  g.fillStyle(0x6a7280);
  if (alt) g.fillRect(8, 8, 5, 4);
  else g.fillRect(3, 3, 5, 4);
}

function drawShip(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0x5c3317);
  g.fillRect(10, 22, 70, 12);
  g.fillTriangle(10, 22, 10, 34, 0, 28);
  g.fillTriangle(80, 22, 80, 34, 96, 24);
  g.fillStyle(0x8a5a32);
  g.fillRect(88, 16, 6, 8);
  g.fillStyle(0x3a2416);
  g.fillRect(42, 2, 3, 24);
  g.fillStyle(0xe6e0d4);
  g.fillRect(46, 4, 18, 16);
  g.fillStyle(0xc23b3b);
  g.fillRect(46, 10, 18, 2);
}
