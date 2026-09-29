import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants';
import { setupTouchControls } from './input/touchControls';
import { DockScene } from './scenes/DockScene';
import { LevelScene } from './scenes/LevelScene';
import { RiverScene } from './scenes/RiverScene';
import { SortieScene } from './scenes/SortieScene';

setupTouchControls();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: '#111111',
  pixelArt: true,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
    },
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scene: [RiverScene, DockScene, SortieScene, LevelScene],
});

if (import.meta.env.DEV) Object.assign(window, { game });
