import Phaser from 'phaser';
import { LEVEL_ROWS, SCREEN_WIDTH, TILE } from './constants';
import type { Backdrop, Palette } from './levels/levels';

export type HeroKind = 'sword' | 'bow';
export type HeroPose = 'stand' | 'run0' | 'run1' | 'jump' | 'crouch';

type G = Phaser.GameObjects.Graphics;

const HERO_POSES: HeroPose[] = ['stand', 'run0', 'run1', 'jump', 'crouch'];

export function heroTexture(kind: HeroKind, pose: HeroPose) {
  return `hero-${kind}-${pose}`;
}

/** Номера кадров в тайлсете уровня. */
export const TILE_GRASS = 0;
export const TILE_DIRT = 1;
export const TILE_PLANK = 2;
export const TILE_STONE = 3;
export const TILE_BOG = 4;
export const TILE_CRUMBLE = 5;
const TILE_FRAMES = 6;

/** Все спрайты рисуются кодом: пока нет художника, так быстрее менять. Смотрят вправо. */
export function createTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('arrow')) return;

  for (const kind of ['sword', 'bow'] as const) {
    for (const pose of HERO_POSES) paint(scene, heroTexture(kind, pose), 16, 24, (g) => drawHero(g, kind, pose));
  }
  paint(scene, 'arrow', 12, 3, (g) => drawArrow(g, 0xd9b16c, 0xf4f0e6, 0xc23b3b));
  paint(scene, 'slash', 20, 28, (g) => {
    g.lineStyle(3, 0xf4f0e6);
    g.beginPath();
    g.arc(0, 14, 16, -1.2, 1.2);
    g.strokePath();
    g.lineStyle(1, 0xf2d48a);
    g.beginPath();
    g.arc(0, 14, 12, -1, 1);
    g.strokePath();
  });

  createEnemyTextures(scene);
  createShotTextures(scene);
  createMarkTextures(scene);

  paint(scene, 'boss-bandit', 40, 40, drawBanditChief);
  paint(scene, 'boss-bolotnik', 40, 40, drawBolotnik);
  paint(scene, 'boss-volot', 48, 64, drawVolot);
  paint(scene, 'boss-tugarin', 64, 28, drawTugarin);

  paint(scene, 'puff', 8, 8, (g) => {
    g.fillStyle(0xf4f0e6);
    g.fillRect(2, 0, 4, 8);
    g.fillRect(0, 2, 8, 4);
  });
  paint(scene, 'coin', 8, 8, (g) => {
    g.fillStyle(0xc8892a);
    g.fillRect(2, 0, 4, 8);
    g.fillRect(0, 2, 8, 4);
    g.fillStyle(0xf2d48a);
    g.fillRect(3, 1, 2, 6);
    g.fillRect(1, 3, 6, 2);
  });
  paint(scene, 'chest', 16, 12, (g) => {
    g.fillStyle(0x6b4a2a);
    g.fillRect(1, 4, 14, 8);
    g.fillStyle(0x8a5a32);
    g.fillRect(1, 1, 14, 5);
    g.fillStyle(0xc8892a);
    g.fillRect(7, 4, 2, 4);
    g.fillStyle(0xf2d48a);
    g.fillRect(7, 2, 2, 2);
  });
  paint(scene, 'relic', 8, 10, (g) => {
    g.fillStyle(0xf2d48a);
    g.fillRect(3, 0, 2, 10);
    g.fillRect(0, 2, 8, 2);
    g.fillStyle(0xc8892a);
    g.fillRect(3, 2, 2, 2);
  });
  paint(scene, 'bandage', 8, 6, (g) => {
    g.fillStyle(0xf4f0e6);
    g.fillRect(0, 1, 8, 4);
    g.fillStyle(0xc23b3b);
    g.fillRect(3, 0, 2, 6);
  });
  paint(scene, 'exit', 12, 14, (g) => {
    g.fillStyle(0x2f6b4f);
    g.fillRect(2, 2, 8, 12);
    g.fillStyle(0xf2d48a);
    g.fillRect(4, 5, 4, 6);
  });
  paint(scene, 'heart', 8, 8, (g) => drawHeart(g, 0xc23b3b));
  paint(scene, 'heart-empty', 8, 8, (g) => drawHeart(g, 0x3a2e2e));
  paint(scene, 'flag-off', 12, 24, (g) => drawFlag(g, 0x6b7075));
  paint(scene, 'flag-on', 12, 24, (g) => drawFlag(g, 0xc23b3b));

  paint(scene, 'beam', 24, LEVEL_ROWS * TILE, drawBeam);
  paint(scene, 'halo', 96, 96, drawHalo);
  paint(scene, 'god-hand', 80, 80, drawBlessingHand);
  paint(scene, 'grace', 7, 9, (g) => {
    g.fillStyle(0xf2d48a);
    g.fillRect(2, 0, 3, 9);
    g.fillRect(0, 2, 7, 3);
  });

  paint(scene, 'drakkar', 32, 18, drawDrakkar);
  paint(scene, 'city', 24, 20, drawCity);
  paint(scene, 'bg-hills', SCREEN_WIDTH, 110, drawHills);
  paint(scene, 'bg-pines', SCREEN_WIDTH, 80, drawPines);
  paint(scene, 'bg-reeds', SCREEN_WIDTH, 80, drawReeds);
  paint(scene, 'bg-crags', SCREEN_WIDTH, 80, drawCrags);
  paint(scene, 'bg-steppe', SCREEN_WIDTH, 80, drawSteppe);
}

/** Тайлсет своего цвета для каждого уровня: лесная трава, болотная, выжженная степь. */
export function levelTiles(scene: Phaser.Scene, id: string, palette: Palette) {
  const key = `tiles-${id}`;
  if (!scene.textures.exists(key)) paint(scene, key, TILE * TILE_FRAMES, TILE, (g) => drawTiles(g, palette));
  return key;
}

export function backdropTexture(backdrop: Backdrop) {
  return `bg-${backdrop}`;
}

function paint(scene: Phaser.Scene, key: string, width: number, height: number, draw: (g: G) => void) {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

// ─── Тайлы ───────────────────────────────────────────────────────────────

function drawTiles(g: G, p: Palette) {
  // Трава поверх земли.
  g.fillStyle(p.dirt);
  g.fillRect(0, 0, 16, 16);
  g.fillStyle(p.top);
  g.fillRect(0, 0, 16, 5);
  g.fillStyle(p.topLight);
  g.fillRect(1, 0, 3, 2);
  g.fillRect(8, 0, 4, 2);
  g.fillStyle(p.dirtDark);
  g.fillRect(4, 9, 2, 2);
  g.fillRect(11, 12, 2, 2);

  // Земля.
  g.fillStyle(p.dirt);
  g.fillRect(16, 0, 16, 16);
  g.fillStyle(p.dirtDark);
  g.fillRect(19, 3, 2, 2);
  g.fillRect(26, 8, 3, 2);
  g.fillRect(21, 12, 2, 2);

  // Доска: твёрдая только сверху, под ней пусто.
  g.fillStyle(0x8a5a32);
  g.fillRect(32, 0, 16, 5);
  g.fillStyle(0x5c3317);
  g.fillRect(32, 4, 16, 1);
  g.fillRect(39, 0, 1, 4);

  // Камень.
  g.fillStyle(0x7a7f86);
  g.fillRect(48, 0, 16, 16);
  g.fillStyle(0x5f646a);
  g.fillRect(48, 7, 16, 1);
  g.fillRect(55, 0, 1, 7);
  g.fillRect(51, 8, 1, 8);
  g.fillRect(60, 8, 1, 8);
  g.fillStyle(0x9aa0a6);
  g.fillRect(49, 1, 3, 1);
  g.fillRect(57, 9, 3, 1);

  // Трясина: мутная вода с ряской поверх ила.
  g.fillStyle(0x3a3024);
  g.fillRect(64, 0, 16, 16);
  g.fillStyle(0x3f5a4a);
  g.fillRect(64, 0, 16, 6);
  g.fillStyle(0x6a8a4a);
  g.fillRect(65, 1, 3, 1);
  g.fillRect(72, 3, 4, 1);
  g.fillStyle(0x8fb8a0);
  g.fillRect(69, 0, 2, 1);
  g.fillStyle(0x2e261c);
  g.fillRect(67, 10, 3, 2);
  g.fillRect(74, 13, 2, 2);

  // Гнилая доска: светлее, в трещинах и с дырой.
  g.fillStyle(0x9a8a6a);
  g.fillRect(80, 0, 16, 5);
  g.fillStyle(0x5a4a32);
  g.fillRect(80, 4, 16, 1);
  g.fillRect(84, 0, 1, 3);
  g.fillRect(90, 1, 1, 4);
  g.fillRect(92, 1, 2, 2);
  g.fillStyle(0x6a8a4a);
  g.fillRect(86, 0, 2, 1);
}

// ─── Герой ───────────────────────────────────────────────────────────────

const HERO_LEGS: Record<HeroPose, [number, number, number, number][]> = {
  stand: [
    [5, 18, 2, 6],
    [9, 18, 2, 6],
  ],
  run0: [
    [3, 18, 2, 5],
    [10, 18, 2, 6],
  ],
  run1: [
    [6, 18, 2, 6],
    [8, 18, 2, 5],
  ],
  jump: [
    [4, 17, 2, 4],
    [9, 18, 2, 3],
  ],
  crouch: [
    [3, 21, 3, 3],
    [10, 21, 3, 3],
  ],
};

function drawHero(g: G, kind: HeroKind, pose: HeroPose) {
  // Мечник в зелёном, лучник в синем — различимы даже в суматохе боя.
  const tunic = kind === 'sword' ? 0x2f6b4f : 0x2a5278;
  const beard = kind === 'sword' ? 0xb5652b : 0xe0c070;
  // В приседе всё выше колен опускается, ноги торчат коленями в стороны.
  const dy = pose === 'crouch' ? 8 : 0;

  g.fillStyle(0x8f2d2d);
  g.fillRect(3, 10 + dy, 3, pose === 'jump' || pose === 'crouch' ? 5 : 8);
  if (kind === 'bow') {
    g.fillStyle(0x5c3317);
    g.fillRect(2, 6 + dy, 2, 7);
    g.fillStyle(0xc23b3b);
    g.fillRect(2, 5 + dy, 2, 1);
  }

  for (const [x, y, w, h] of HERO_LEGS[pose]) {
    g.fillStyle(0x3a2e24);
    g.fillRect(x, y, w, h);
    g.fillStyle(0x1f1a16);
    g.fillRect(x, y + h - 1, w + 1, 1);
  }

  g.fillStyle(tunic);
  g.fillRect(4, 10 + dy, 8, pose === 'crouch' ? 5 : 8);
  g.fillStyle(0x3a2416);
  g.fillRect(4, 15 + dy - (pose === 'crouch' ? 2 : 0), 8, 1);

  g.fillStyle(0xe0b48a);
  g.fillRect(6, 4 + dy, 5, 5);
  g.fillStyle(beard);
  g.fillRect(6, 8 + dy, 5, 3);
  g.fillRect(7, 11 + dy, 3, 1);
  g.fillStyle(0x1f1a16);
  g.fillRect(9, 5 + dy, 1, 1);

  g.fillStyle(0x9aa0a6);
  g.fillRect(5, 1 + dy, 7, 4);
  g.fillRect(6, 0 + dy, 5, 1);
  g.fillStyle(0x6b7075);
  g.fillRect(10, 4 + dy, 1, 2);

  if (kind === 'sword') {
    g.fillStyle(0xd8dde3);
    g.fillRect(12, 2 + dy, 2, 8);
    g.fillStyle(0xc8892a);
    g.fillRect(11, 10 + dy, 4, 1);
    g.fillStyle(0x5c3317);
    g.fillRect(12, 11 + dy, 2, 2);
    g.fillStyle(0xe0b48a);
    g.fillRect(11, 12 + dy, 3, 2);
  } else {
    const bow = pose === 'crouch' ? 8 : 11;
    g.fillStyle(0xf4f0e6);
    g.fillRect(12, 7 + dy, 1, bow);
    g.fillStyle(0x8a5a32);
    g.fillRect(14, 7 + dy, 1, bow);
    g.fillRect(13, 6 + dy, 1, 1);
    g.fillRect(13, 7 + dy + bow, 1, 1);
    g.fillStyle(0xe0b48a);
    g.fillRect(12, 12 + dy - (pose === 'crouch' ? 2 : 0), 3, 2);
  }
}

// ─── Враги ───────────────────────────────────────────────────────────────

function createEnemyTextures(scene: Phaser.Scene) {
  // Ладога.
  paint(scene, 'bandit', 16, 24, drawBandit);
  paint(scene, 'shield', 16, 24, drawShieldBearer);
  paint(scene, 'slinger', 16, 24, drawSlinger);
  paint(scene, 'raven0', 16, 12, (g) => drawRaven(g, true));
  paint(scene, 'raven1', 16, 12, (g) => drawRaven(g, false));
  // Новгород.
  paint(scene, 'kiki0', 16, 16, (g) => drawKikimora(g, false));
  paint(scene, 'kiki1', 16, 16, (g) => drawKikimora(g, true));
  paint(scene, 'wisp', 10, 10, drawWisp);
  paint(scene, 'spitter', 16, 20, drawSpitter);
  // Смоленск.
  paint(scene, 'boar0', 24, 16, (g) => drawBoar(g, false));
  paint(scene, 'boar1', 24, 16, (g) => drawBoar(g, true));
  paint(scene, 'lobber', 16, 24, drawLobber);
  // Киев.
  paint(scene, 'rider0', 24, 24, (g) => drawRider(g, false));
  paint(scene, 'rider1', 24, 24, (g) => drawRider(g, true));
  paint(scene, 'archer', 16, 24, drawSteppeArcher);
  paint(scene, 'hawk0', 16, 10, (g) => drawHawk(g, true));
  paint(scene, 'hawk1', 16, 10, (g) => drawHawk(g, false));
}

function drawBody(g: G, hood: number, tunic: number) {
  g.fillStyle(0x2b2320);
  g.fillRect(5, 18, 2, 6);
  g.fillRect(9, 18, 2, 6);
  g.fillStyle(tunic);
  g.fillRect(4, 10, 8, 8);
  g.fillStyle(0xd8a878);
  g.fillRect(6, 4, 5, 5);
  g.fillStyle(hood);
  g.fillRect(5, 1, 7, 4);
  g.fillRect(5, 1, 2, 9);
  g.fillStyle(0xc23b3b);
  g.fillRect(9, 5, 1, 1);
}

function drawBandit(g: G) {
  drawBody(g, 0x5c3317, 0x6b4a2a);
  g.fillStyle(0x3a2416);
  g.fillRect(12, 6, 3, 8);
  g.fillRect(11, 12, 2, 2);
}

function drawShieldBearer(g: G) {
  drawBody(g, 0x3a3a3a, 0x6b2a2a);
  g.fillStyle(0x3a2416);
  g.fillRect(9, 7, 7, 14);
  g.fillStyle(0x8a5a32);
  g.fillRect(10, 8, 5, 12);
  g.fillStyle(0xc8892a);
  g.fillRect(11, 12, 3, 3);
}

function drawSlinger(g: G) {
  drawBody(g, 0x3a2e4a, 0x4a3a5c);
  g.fillStyle(0x8a5a32);
  g.fillRect(12, 9, 1, 5);
  g.fillRect(12, 9, 3, 1);
  g.fillStyle(0x5f646a);
  g.fillRect(13, 7, 3, 3);
}

function drawRaven(g: G, wingsUp: boolean) {
  g.fillStyle(0x1f1a24);
  g.fillRect(4, 5, 8, 4);
  g.fillRect(11, 4, 3, 3);
  if (wingsUp) {
    g.fillRect(3, 0, 3, 5);
    g.fillRect(7, 1, 3, 4);
  } else {
    g.fillRect(3, 8, 3, 4);
    g.fillRect(7, 8, 3, 3);
  }
  g.fillRect(1, 6, 3, 2);
  g.fillStyle(0xc8892a);
  g.fillRect(14, 5, 2, 1);
  g.fillStyle(0xc23b3b);
  g.fillRect(12, 4, 1, 1);
}

/** Кикимора: зелёный комок с космами тины; в прыжке вытягивается. */
function drawKikimora(g: G, leaping: boolean) {
  const top = leaping ? 1 : 4;
  g.fillStyle(0x2e4a2e);
  g.fillRect(3, top + 2, 10, leaping ? 11 : 8);
  g.fillStyle(0x4a6a3a);
  g.fillRect(4, top, 8, 4);
  g.fillStyle(0x6a8a4a);
  for (const x of [3, 6, 9, 12]) g.fillRect(x, top + 3, 1, leaping ? 8 : 6);
  g.fillStyle(0xe8e060);
  g.fillRect(9, top + 2, 2, 2);
  g.fillStyle(0x1f1a16);
  g.fillRect(10, top + 2, 1, 1);
  g.fillStyle(0x3a2e24);
  if (leaping) {
    g.fillRect(3, 13, 2, 3);
    g.fillRect(11, 13, 2, 3);
  } else {
    g.fillRect(2, 13, 4, 3);
    g.fillRect(10, 13, 4, 3);
  }
  g.fillStyle(0xd8d0a0);
  g.fillRect(13, top + 6, 2, 1);
}

function drawWisp(g: G) {
  g.fillStyle(0x6ad8c8, 0.35);
  g.fillCircle(5, 5, 5);
  g.fillStyle(0xa8f0e0, 0.8);
  g.fillCircle(5, 5, 3);
  g.fillStyle(0xffffff);
  g.fillRect(4, 4, 2, 2);
}

/** Плевун — жабья туша на кочке с широкой пастью. */
function drawSpitter(g: G) {
  g.fillStyle(0x4a5a2e);
  g.fillEllipse(8, 13, 16, 12);
  g.fillStyle(0x6a7a3a);
  g.fillEllipse(8, 11, 12, 8);
  g.fillStyle(0x8a9a4a);
  g.fillRect(4, 9, 2, 2);
  g.fillRect(8, 14, 2, 1);
  g.fillStyle(0xe8c040);
  g.fillRect(9, 5, 3, 3);
  g.fillRect(4, 5, 3, 3);
  g.fillStyle(0x1f1a16);
  g.fillRect(10, 6, 1, 1);
  g.fillRect(5, 6, 1, 1);
  g.fillStyle(0x8f2d2d);
  g.fillRect(9, 11, 7, 2);
  g.fillStyle(0x3a2e24);
  g.fillRect(2, 18, 4, 2);
  g.fillRect(10, 18, 4, 2);
}

/** Вепрь: тёмная щетинистая туша, светлые клыки, ноги в беге. */
function drawBoar(g: G, stride: boolean) {
  g.fillStyle(0x3a2a20);
  if (stride) {
    g.fillRect(3, 11, 3, 5);
    g.fillRect(16, 12, 3, 4);
    g.fillRect(8, 12, 3, 3);
  } else {
    g.fillRect(5, 12, 3, 4);
    g.fillRect(14, 11, 3, 5);
    g.fillRect(10, 12, 3, 4);
  }
  g.fillStyle(0x5a3f2a);
  g.fillRect(2, 4, 18, 9);
  g.fillRect(4, 2, 12, 3);
  g.fillStyle(0x3a2a20);
  for (let x = 4; x < 16; x += 3) g.fillRect(x, 1, 2, 2);
  g.fillStyle(0x6b4a32);
  g.fillRect(18, 6, 5, 5);
  g.fillStyle(0x2b2320);
  g.fillRect(22, 8, 2, 2);
  g.fillStyle(0xf4f0e6);
  g.fillRect(20, 10, 1, 3);
  g.fillRect(21, 11, 2, 1);
  g.fillStyle(0xc23b3b);
  g.fillRect(19, 6, 1, 1);
  g.fillStyle(0x3a2a20);
  g.fillRect(0, 5, 2, 2);
}

/** Метатель — здоровяк в сером с валуном над головой. */
function drawLobber(g: G) {
  g.fillStyle(0x2b2320);
  g.fillRect(4, 18, 3, 6);
  g.fillRect(9, 18, 3, 6);
  g.fillStyle(0x5f646a);
  g.fillRect(3, 10, 10, 8);
  g.fillStyle(0x3a3a3a);
  g.fillRect(3, 15, 10, 1);
  g.fillStyle(0xd8a878);
  g.fillRect(5, 5, 6, 5);
  g.fillRect(2, 3, 2, 8);
  g.fillRect(12, 3, 2, 8);
  g.fillStyle(0x8a6a4a);
  g.fillRect(5, 8, 6, 3);
  g.fillStyle(0x1f1a16);
  g.fillRect(9, 6, 1, 1);
  g.fillStyle(0x7a7f86);
  g.fillRect(3, 0, 10, 4);
  g.fillStyle(0x9aa0a6);
  g.fillRect(4, 0, 4, 1);
}

/** Степной всадник на гнедом коне, острый шлем и копьё вперёд. */
function drawRider(g: G, gallop: boolean) {
  g.fillStyle(0x4a2e1a);
  if (gallop) {
    g.fillRect(3, 18, 2, 6);
    g.fillRect(7, 19, 2, 4);
    g.fillRect(15, 19, 2, 4);
    g.fillRect(19, 18, 2, 6);
  } else {
    g.fillRect(5, 18, 2, 6);
    g.fillRect(8, 18, 2, 6);
    g.fillRect(15, 18, 2, 6);
    g.fillRect(18, 18, 2, 6);
  }
  g.fillStyle(0x7a4a2a);
  g.fillRect(3, 11, 17, 8);
  g.fillRect(18, 6, 4, 8);
  g.fillRect(20, 5, 4, 4);
  g.fillStyle(0x2b2320);
  g.fillRect(1, 11, 3, 6);
  g.fillRect(17, 5, 2, 6);
  g.fillStyle(0x8f2d2d);
  g.fillRect(8, 10, 6, 3);
  g.fillStyle(0xa8845a);
  g.fillRect(9, 3, 5, 8);
  g.fillStyle(0xd8a878);
  g.fillRect(10, 1, 4, 3);
  g.fillStyle(0x9aa0a6);
  g.fillRect(10, 0, 4, 1);
  g.fillRect(11, -1, 2, 1);
  g.fillStyle(0x8a5a32);
  g.fillRect(12, 6, 12, 1);
  g.fillStyle(0xd8dde3);
  g.fillRect(22, 5, 2, 3);
}

function drawSteppeArcher(g: G) {
  drawBody(g, 0x8a6a40, 0x8f2d2d);
  g.fillStyle(0xc8892a);
  g.fillRect(6, 0, 5, 2);
  g.fillRect(8, -1, 1, 1);
  g.fillStyle(0x5c3317);
  g.fillRect(13, 5, 1, 13);
  g.fillRect(12, 4, 1, 2);
  g.fillRect(12, 17, 1, 2);
  g.fillStyle(0xf4f0e6);
  g.fillRect(12, 6, 1, 11);
}

function drawHawk(g: G, wingsUp: boolean) {
  g.fillStyle(0x6b4a2a);
  g.fillRect(4, 4, 8, 3);
  g.fillRect(11, 3, 3, 3);
  g.fillStyle(0x8a6a40);
  if (wingsUp) {
    g.fillRect(3, 0, 4, 4);
    g.fillRect(7, 0, 3, 4);
  } else {
    g.fillRect(3, 7, 4, 3);
    g.fillRect(7, 7, 3, 3);
  }
  g.fillStyle(0x3a2416);
  g.fillRect(1, 4, 3, 2);
  g.fillStyle(0xe8c040);
  g.fillRect(14, 4, 2, 1);
  g.fillRect(12, 3, 1, 1);
}

// ─── Снаряды ─────────────────────────────────────────────────────────────

function createShotTextures(scene: Phaser.Scene) {
  paint(scene, 'arrow-foe', 12, 3, (g) => drawArrow(g, 0x5c3317, 0x9aa0a6, 0x2b2320));
  paint(scene, 'stone', 6, 6, (g) => {
    g.fillStyle(0x5f646a);
    g.fillRect(1, 0, 4, 6);
    g.fillRect(0, 1, 6, 4);
    g.fillStyle(0x9aa0a6);
    g.fillRect(1, 1, 2, 2);
  });
  paint(scene, 'axe', 10, 10, (g) => {
    g.fillStyle(0x8a5a32);
    g.fillRect(4, 1, 2, 9);
    g.fillStyle(0xd8dde3);
    g.fillRect(6, 0, 4, 5);
    g.fillRect(0, 0, 4, 3);
  });
  paint(scene, 'wave', 12, 14, (g) => {
    g.fillStyle(0xf2d48a);
    g.fillRect(2, 6, 8, 8);
    g.fillRect(4, 2, 4, 4);
    g.fillStyle(0xf4f0e6);
    g.fillRect(4, 8, 4, 6);
  });
  paint(scene, 'blob', 8, 8, (g) => {
    g.fillStyle(0x3f5a2e);
    g.fillCircle(4, 4, 4);
    g.fillStyle(0x6a8a4a);
    g.fillCircle(3, 3, 2);
  });
  paint(scene, 'boulder', 12, 12, (g) => {
    g.fillStyle(0x5f646a);
    g.fillCircle(6, 6, 6);
    g.fillStyle(0x7a7f86);
    g.fillCircle(5, 5, 4);
    g.fillStyle(0x4a4f55);
    g.fillRect(7, 7, 2, 2);
    g.fillRect(3, 8, 1, 1);
  });
  paint(scene, 'log', 14, 14, (g) => {
    g.fillStyle(0x5c3317);
    g.fillCircle(7, 7, 7);
    g.fillStyle(0xc8a06a);
    g.fillCircle(7, 7, 5);
    g.lineStyle(1, 0x8a6a40);
    g.strokeCircle(7, 7, 3);
    g.fillStyle(0x8a5a32);
    g.fillRect(6, 6, 2, 2);
    g.fillRect(7, 1, 1, 4);
  });
  paint(scene, 'rock', 12, 12, (g) => {
    g.fillStyle(0x6b7075);
    g.fillPoints(
      [
        { x: 2, y: 1 },
        { x: 9, y: 0 },
        { x: 12, y: 5 },
        { x: 10, y: 12 },
        { x: 3, y: 11 },
        { x: 0, y: 6 },
      ],
      true,
    );
    g.fillStyle(0x9aa0a6);
    g.fillRect(3, 2, 4, 2);
    g.fillStyle(0x4a4f55);
    g.fillRect(7, 8, 3, 2);
  });
  paint(scene, 'fireball', 10, 10, (g) => {
    g.fillStyle(0xc23b3b);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0xf28a2a);
    g.fillCircle(5, 5, 3);
    g.fillStyle(0xfff4c8);
    g.fillRect(4, 4, 2, 2);
  });
  paint(scene, 'flame', 8, 12, (g) => {
    g.fillStyle(0xc23b3b);
    g.fillTriangle(0, 12, 4, 0, 8, 12);
    g.fillStyle(0xf28a2a);
    g.fillTriangle(1, 12, 4, 4, 7, 12);
    g.fillStyle(0xfff4c8);
    g.fillRect(3, 9, 2, 3);
  });
  // Взмах дубины: сама дубина и полосы воздуха за ней.
  paint(scene, 'sweep', 36, 10, (g) => {
    g.fillStyle(0xf4f0e6, 0.35);
    g.fillRect(14, 1, 22, 2);
    g.fillRect(18, 7, 18, 2);
    g.fillStyle(0x5c3317);
    g.fillRoundedRect(0, 2, 16, 6, 3);
    g.fillStyle(0x8a5a32);
    g.fillRect(2, 3, 11, 2);
    g.fillStyle(0x3a2416);
    g.fillRect(3, 6, 2, 1);
    g.fillRect(9, 6, 2, 1);
  });
}

function drawArrow(g: G, shaft: number, head: number, fletch: number) {
  g.fillStyle(shaft);
  g.fillRect(0, 1, 10, 1);
  g.fillStyle(head);
  g.fillRect(9, 0, 3, 3);
  g.fillStyle(fletch);
  g.fillRect(0, 0, 2, 3);
}

// ─── Метки ловушек и атак ────────────────────────────────────────────────

function createMarkTextures(scene: Phaser.Scene) {
  paint(scene, 'logpile', 24, 14, (g) => {
    for (const [x, y] of [
      [0, 7],
      [8, 7],
      [16, 7],
      [4, 0],
      [12, 0],
    ]) {
      g.fillStyle(0x5c3317);
      g.fillCircle(x + 4, y + 4, 4);
      g.fillStyle(0xc8a06a);
      g.fillCircle(x + 4, y + 4, 2);
    }
  });
  paint(scene, 'dust', 3, 3, (g) => {
    g.fillStyle(0xc8b890);
    g.fillRect(0, 0, 3, 3);
  });
  paint(scene, 'shadow', 24, 6, (g) => {
    g.fillStyle(0x1f1a16, 0.5);
    g.fillEllipse(12, 3, 24, 6);
  });
  paint(scene, 'warn', 12, 12, (g) => {
    g.fillStyle(0xc23b3b);
    g.fillCircle(6, 6, 6);
    g.fillStyle(0xfff4c8);
    g.fillRect(5, 2, 2, 5);
    g.fillRect(5, 8, 2, 2);
  });
  paint(scene, 'ripple', 32, 6, (g) => {
    g.lineStyle(1, 0xa8c8b0);
    g.strokeEllipse(16, 3, 30, 5);
    g.lineStyle(1, 0x6a8a7a);
    g.strokeEllipse(16, 3, 18, 3);
  });
  paint(scene, 'bubble', 4, 4, (g) => {
    g.lineStyle(1, 0xa8c8b0);
    g.strokeCircle(2, 2, 1.5);
  });
}

// ─── Главари ─────────────────────────────────────────────────────────────

function drawBanditChief(g: G) {
  const body = 0x6b4a2a;
  const trim = 0x8f2d2d;
  g.fillStyle(0x2b2320);
  g.fillRect(11, 30, 7, 10);
  g.fillRect(23, 30, 7, 10);
  g.fillStyle(body);
  g.fillRect(7, 14, 26, 18);
  g.fillStyle(trim);
  g.fillRect(7, 26, 26, 3);
  g.fillRect(4, 14, 4, 12);
  g.fillStyle(0xd8a878);
  g.fillRect(14, 4, 13, 11);
  g.fillStyle(trim);
  g.fillRect(13, 1, 15, 5);
  g.fillRect(10, 0, 3, 4);
  g.fillRect(28, 0, 3, 4);
  g.fillStyle(0x6b4a2a);
  g.fillRect(14, 11, 13, 7);
  g.fillStyle(0xf2d48a);
  g.fillRect(22, 7, 3, 2);
  g.fillRect(16, 7, 3, 2);
  g.fillStyle(0x8a5a32);
  g.fillRect(33, 6, 3, 24);
  g.fillStyle(0xd8dde3);
  g.fillRect(35, 4, 5, 10);
}

/** Болотник: моховая гора с корягами-рогами и светящимися глазами. */
function drawBolotnik(g: G) {
  g.fillStyle(0x2e3a26);
  g.fillEllipse(20, 26, 38, 28);
  g.fillStyle(0x3f5a2e);
  g.fillEllipse(20, 22, 30, 22);
  g.fillStyle(0x5a3f2a);
  g.fillRect(8, 2, 3, 12);
  g.fillRect(5, 2, 4, 2);
  g.fillRect(29, 2, 3, 12);
  g.fillRect(31, 2, 4, 2);
  g.fillStyle(0x6a8a4a);
  for (const x of [6, 11, 17, 23, 29, 34]) g.fillRect(x, 14 + (x % 3), 2, 16);
  g.fillStyle(0xe8e060);
  g.fillRect(13, 16, 4, 3);
  g.fillRect(24, 16, 4, 3);
  g.fillStyle(0x1f1a16);
  g.fillRect(15, 17, 1, 1);
  g.fillRect(26, 17, 1, 1);
  g.fillRect(14, 24, 13, 3);
  g.fillStyle(0xd8d0a0);
  g.fillRect(16, 24, 2, 2);
  g.fillRect(23, 24, 2, 2);
  g.fillStyle(0x3f5a4a);
  g.fillRect(0, 36, 40, 4);
}

/** Волот: каменнокожий великан в шкуре, дубина на плече. */
function drawVolot(g: G) {
  g.fillStyle(0x3a2e24);
  g.fillRect(12, 48, 9, 16);
  g.fillRect(27, 48, 9, 16);
  g.fillStyle(0x7a7f86);
  g.fillRect(9, 20, 30, 30);
  g.fillStyle(0x8a6a40);
  g.fillRect(9, 36, 30, 14);
  g.fillStyle(0x6b4a2a);
  for (let x = 10; x < 38; x += 5) g.fillRect(x, 48, 3, 3);
  g.fillStyle(0x6b7075);
  g.fillRect(3, 20, 7, 24);
  g.fillRect(38, 20, 7, 20);
  g.fillStyle(0x9aa0a6);
  g.fillRect(16, 4, 16, 16);
  g.fillStyle(0x5f646a);
  g.fillRect(16, 4, 16, 3);
  g.fillStyle(0xc8892a);
  g.fillRect(20, 10, 3, 2);
  g.fillRect(27, 10, 3, 2);
  g.fillStyle(0xd8d0c0);
  g.fillRect(17, 15, 14, 9);
  g.fillStyle(0x1f1a16);
  g.fillRect(21, 16, 6, 1);
  g.fillStyle(0x5c3317);
  g.fillRect(40, 0, 6, 30);
  g.fillRect(38, 0, 10, 8);
  g.fillStyle(0x3a2416);
  g.fillRect(39, 2, 2, 2);
  g.fillRect(45, 5, 2, 2);
}

/** Змей Тугарин: зелёное тело волной, перепончатое крыло, огненная пасть справа. */
function drawTugarin(g: G) {
  g.fillStyle(0x1f4a38);
  g.fillPoints(
    [
      { x: 0, y: 16 },
      { x: 8, y: 12 },
      { x: 16, y: 16 },
    ],
    true,
  );
  g.fillStyle(0x2f6b4f);
  g.fillRect(6, 13, 44, 9);
  g.fillRect(44, 9, 10, 10);
  g.fillStyle(0x4f8f6a);
  g.fillRect(8, 19, 40, 3);
  g.fillStyle(0x2f6b4f);
  g.fillRect(52, 10, 12, 8);
  g.fillStyle(0xc23b3b);
  g.fillRect(58, 15, 6, 3);
  g.fillStyle(0xf2d48a);
  g.fillRect(56, 11, 2, 2);
  g.fillStyle(0x1f4a38);
  g.fillRect(50, 6, 2, 5);
  g.fillRect(54, 5, 2, 5);
  g.fillStyle(0x3f7a5a);
  g.fillPoints(
    [
      { x: 18, y: 13 },
      { x: 26, y: 0 },
      { x: 40, y: 2 },
      { x: 36, y: 13 },
    ],
    true,
  );
  g.fillStyle(0x1f4a38);
  g.fillRect(26, 1, 1, 12);
  g.fillRect(32, 2, 1, 11);
  g.fillStyle(0xc23b3b);
  for (let x = 10; x < 48; x += 6) g.fillRect(x, 11, 3, 2);
  g.fillStyle(0x1f4a38);
  g.fillRect(20, 22, 3, 5);
  g.fillRect(38, 22, 3, 5);
}

// ─── Благодать ───────────────────────────────────────────────────────────

/** Столб света во всю высоту уровня: золотой край, белая сердцевина. */
function drawBeam(g: G) {
  const height = LEVEL_ROWS * TILE;
  g.fillStyle(0xf2d48a, 0.35);
  g.fillRect(0, 0, 24, height);
  g.fillStyle(0xfff4c8, 0.7);
  g.fillRect(5, 0, 14, height);
  g.fillStyle(0xffffff, 1);
  g.fillRect(9, 0, 6, height);
}

function drawHalo(g: G) {
  for (let r = 48; r > 0; r -= 6) {
    g.fillStyle(0xfff4c8, 0.08 + (48 - r) * 0.004);
    g.fillCircle(48, 48, r);
  }
}

/**
 * Рука из правого верхнего угла: рукав уходит за край по диагонали,
 * внизу слева кулак с поднятым большим пальцем.
 */
function drawBlessingHand(g: G) {
  const outline = 0x8a5a32;
  const skin = 0xf0c8a0;
  const shade = 0xd8a878;

  g.fillStyle(0xf4f0e6);
  g.fillPoints(
    [
      { x: 56, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 24 },
      { x: 53, y: 50 },
      { x: 34, y: 31 },
    ],
    true,
  );
  g.fillStyle(0xdcd6c8);
  g.fillPoints(
    [
      { x: 80, y: 12 },
      { x: 80, y: 24 },
      { x: 53, y: 50 },
      { x: 47, y: 44 },
    ],
    true,
  );
  g.lineStyle(4, 0xc8892a);
  g.lineBetween(34, 31, 53, 50);

  // Кулак: пальцы согнуты к зрителю, костяшки слева.
  g.fillStyle(skin);
  g.fillRoundedRect(20, 38, 26, 22, 5);
  g.lineStyle(1, outline);
  g.strokeRoundedRect(20, 38, 26, 22, 5);
  g.fillStyle(shade);
  for (let i = 0; i < 4; i += 1) {
    g.fillRoundedRect(16, 40 + i * 5, 12, 5, 2);
  }
  g.lineStyle(1, outline);
  for (let i = 0; i < 4; i += 1) {
    g.strokeRoundedRect(16, 40 + i * 5, 12, 5, 2);
  }

  // Большой палец вверх.
  g.fillStyle(skin);
  g.fillRoundedRect(27, 14, 10, 28, 5);
  g.lineStyle(1, outline);
  g.strokeRoundedRect(27, 14, 10, 28, 5);
  g.fillStyle(0xf8e4d4);
  g.fillRoundedRect(29, 16, 6, 6, 2);
  g.fillStyle(shade);
  g.fillRect(28, 30, 8, 1);
}

// ─── Интерфейс и река ────────────────────────────────────────────────────

function drawHeart(g: G, color: number) {
  g.fillStyle(color);
  g.fillRect(0, 1, 3, 2);
  g.fillRect(5, 1, 3, 2);
  g.fillRect(0, 3, 8, 2);
  g.fillRect(1, 5, 6, 1);
  g.fillRect(2, 6, 4, 1);
  g.fillRect(3, 7, 2, 1);
}

function drawFlag(g: G, cloth: number) {
  g.fillStyle(0x5c3317);
  g.fillRect(2, 0, 2, 24);
  g.fillStyle(cloth);
  g.fillRect(4, 1, 8, 7);
  g.fillStyle(0xf2d48a);
  g.fillRect(6, 3, 3, 3);
}

function drawDrakkar(g: G) {
  g.fillStyle(0x5c3317);
  g.fillRect(2, 11, 28, 3);
  g.fillRect(4, 14, 24, 2);
  g.fillRect(7, 16, 18, 2);
  g.fillRect(28, 5, 3, 7);
  g.fillRect(30, 3, 2, 3);
  g.fillRect(0, 7, 3, 5);
  g.fillStyle(0xc8892a);
  for (let x = 5; x < 28; x += 5) g.fillRect(x, 11, 3, 3);
  g.fillStyle(0x3a2416);
  g.fillRect(15, 0, 1, 11);
  g.fillStyle(0xf4f0e6);
  g.fillRect(9, 1, 13, 9);
  g.fillStyle(0xc23b3b);
  g.fillRect(9, 1, 13, 2);
  g.fillRect(9, 5, 13, 2);
  g.fillRect(9, 9, 13, 1);
}

function drawCity(g: G) {
  g.fillStyle(0x5c3317);
  for (let x = 0; x < 24; x += 3) g.fillRect(x, 10, 2, 10);
  g.fillRect(0, 12, 24, 2);
  g.fillStyle(0x8a5a32);
  g.fillRect(3, 5, 7, 6);
  g.fillRect(14, 3, 7, 8);
  g.fillStyle(0x8f2d2d);
  g.fillRect(2, 3, 9, 3);
  g.fillRect(13, 0, 9, 4);
  g.fillStyle(0xf2d48a);
  g.fillRect(16, 6, 2, 2);
}

// ─── Фоны: белые силуэты шириной в экран, цвет даёт tint уровня ──────────

function drawHills(g: G) {
  g.fillStyle(0xffffff);
  for (let x = 0; x < SCREEN_WIDTH; x += 2) {
    const t = (x / SCREEN_WIDTH) * Math.PI * 2;
    const h = 60 + 22 * Math.sin(t * 2) + 12 * Math.sin(t * 5 + 1);
    g.fillRect(x, 110 - h, 2, h);
  }
}

/** Ладога: ельник. */
function drawPines(g: G) {
  g.fillStyle(0xffffff);
  g.fillRect(0, 60, SCREEN_WIDTH, 20);
  const step = SCREEN_WIDTH / 16;
  for (let i = 0; i < 16; i += 1) {
    const x = i * step + (i % 3) * 5;
    const h = 36 + (i % 4) * 8;
    g.fillTriangle(x, 64, x + 10, 64 - h, x + 20, 64);
  }
}

/** Новгород: камыш и сухие коряги над водой. */
function drawReeds(g: G) {
  g.fillStyle(0xffffff);
  g.fillRect(0, 68, SCREEN_WIDTH, 12);
  for (let x = 0; x < SCREEN_WIDTH; x += 3) {
    const h = 10 + ((x * 7) % 17);
    g.fillRect(x, 68 - h, 1, h);
    if (x % 12 === 0) g.fillRect(x - 1, 66 - h, 3, 4);
  }
  for (const x of [40, 170, 300]) {
    g.fillRect(x, 20, 3, 48);
    g.fillRect(x - 8, 30, 8, 2);
    g.fillRect(x + 3, 24, 10, 2);
    g.fillRect(x + 11, 18, 2, 7);
  }
}

/** Смоленск: скалы и каменные зубцы. */
function drawCrags(g: G) {
  g.fillStyle(0xffffff);
  g.fillRect(0, 62, SCREEN_WIDTH, 18);
  const peaks = [
    [0, 30],
    [36, 14],
    [70, 34],
    [112, 8],
    [150, 28],
    [196, 18],
    [236, 38],
    [276, 10],
    [322, 26],
    [352, 16],
    [384, 30],
  ];
  for (let i = 0; i < peaks.length - 1; i += 1) {
    const [x0, y0] = peaks[i];
    const [x1, y1] = peaks[i + 1];
    g.fillPoints(
      [
        { x: x0, y: 64 },
        { x: x0, y: y0 },
        { x: x1, y: y1 },
        { x: x1, y: 64 },
      ],
      true,
    );
  }
}

/** Киев: курганы, каменная баба и ковыль. */
function drawSteppe(g: G) {
  g.fillStyle(0xffffff);
  g.fillRect(0, 70, SCREEN_WIDTH, 10);
  for (const [x, w, h] of [
    [30, 90, 18],
    [180, 60, 12],
    [270, 100, 22],
  ]) {
    g.fillEllipse(x + w / 2, 70, w, h * 2);
  }
  g.fillRect(226, 46, 8, 20);
  g.fillRect(224, 40, 12, 8);
  for (let x = 0; x < SCREEN_WIDTH; x += 5) g.fillRect(x, 64 + (x % 3), 1, 6);
}
