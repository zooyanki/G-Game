import Phaser from 'phaser';
import { input } from './InputState';

/** Всё, что игрок нажал за кадр: клавиатура и экранные кнопки вместе. */
export type Frame = {
  /** -1, 0 или 1: джойстик сведён к цифровому, иначе персонаж «плывёт». */
  x: number;
  y: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  attackPressed: boolean;
  attackHeld: boolean;
  swapPressed: boolean;
  superPressed: boolean;
  confirmPressed: boolean;
  backPressed: boolean;
};

/** По горизонтали джойстик срабатывает раньше: бег важнее прицела. */
const STICK_X = 0.35;
const STICK_Y = 0.5;

export class Controls {
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Клавиатура недоступна');
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = keyboard.addKeys({
      left: K.LEFT,
      right: K.RIGHT,
      up: K.UP,
      down: K.DOWN,
      a: K.A,
      d: K.D,
      w: K.W,
      s: K.S,
      space: K.SPACE,
      z: K.Z,
      x: K.X,
      j: K.J,
      shift: K.SHIFT,
      c: K.C,
      v: K.V,
      enter: K.ENTER,
      esc: K.ESC,
    }) as Record<string, Phaser.Input.Keyboard.Key>;
    keyboard.addCapture([K.UP, K.DOWN, K.LEFT, K.RIGHT, K.SPACE]);
  }

  read(): Frame {
    const k = this.keys;
    const down = (...names: string[]) => names.some((name) => k[name].isDown);
    const pressed = (...names: string[]) => names.some((name) => Phaser.Input.Keyboard.JustDown(k[name]));

    let x = (down('right', 'd') ? 1 : 0) - (down('left', 'a') ? 1 : 0);
    let y = (down('down', 's') ? 1 : 0) - (down('up', 'w') ? 1 : 0);
    if (x === 0 && Math.abs(input.moveX) > STICK_X) x = Math.sign(input.moveX);
    if (y === 0 && Math.abs(input.moveY) > STICK_Y) y = Math.sign(input.moveY);

    const jumpKey = pressed('space', 'z');
    const attackKey = pressed('x', 'j');
    const enterKey = pressed('enter');

    return {
      x,
      y,
      jumpPressed: jumpKey || input.consume('jump'),
      jumpHeld: down('space', 'z') || input.jumpHeld,
      attackPressed: attackKey || input.consume('attack'),
      attackHeld: down('x', 'j') || input.attackHeld,
      swapPressed: pressed('shift', 'c') || input.consume('swap'),
      superPressed: pressed('v') || input.consume('super'),
      confirmPressed: jumpKey || attackKey || enterKey || input.consume('retry'),
      backPressed: pressed('esc') || input.consume('river'),
    };
  }
}
