import Phaser from 'phaser';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from './constants';
import { setupTouchControls } from './input/touchControls';
import { ShoreScene } from './scenes/ShoreScene';

setupTouchControls();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  backgroundColor: '#c2a36b',
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
  scene: [ShoreScene],
});
