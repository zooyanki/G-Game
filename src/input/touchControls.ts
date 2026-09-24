import { input } from './InputState';

/** Кнопки поверх игры. На компьютере спрятаны, на телефоне — джойстик и удар. */
export function setupTouchControls() {
  const root = document.getElementById('touch');
  const stick = document.getElementById('stick');
  const nub = document.getElementById('nub');
  const attack = document.getElementById('attack');
  const swap = document.getElementById('swap');
  const restart = document.getElementById('restart');
  if (!root || !stick || !nub || !attack || !swap || !restart) return;

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) return;

  root.hidden = false;

  const setVector = (clientX: number, clientY: number) => {
    const rect = stick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const length = Math.hypot(dx, dy);
    const max = rect.width / 2 - 8;

    if (length > max && length > 0) {
      dx = (dx / length) * max;
      dy = (dy / length) * max;
    }

    nub.style.transform = `translate(${dx}px, ${dy}px)`;

    if (length < max * 0.22) {
      input.moveX = 0;
      input.moveY = 0;
      return;
    }

    input.moveX = dx / max;
    input.moveY = dy / max;
  };

  const endStick = (event: PointerEvent) => {
    if (!stick.hasPointerCapture(event.pointerId)) return;
    stick.releasePointerCapture(event.pointerId);
    nub.style.transform = '';
    input.moveX = 0;
    input.moveY = 0;
  };

  stick.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    stick.setPointerCapture(event.pointerId);
    setVector(event.clientX, event.clientY);
  });
  stick.addEventListener('pointermove', (event) => {
    if (!stick.hasPointerCapture(event.pointerId)) return;
    setVector(event.clientX, event.clientY);
  });
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  attack.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    input.queueAttack();
  });

  swap.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    input.queueSwap();
  });

  restart.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    input.queueRestart();
  });
}

export function setRestartVisible(visible: boolean) {
  const stick = document.getElementById('stick');
  const attack = document.getElementById('attack');
  const swap = document.getElementById('swap');
  const restart = document.getElementById('restart');
  if (!stick || !attack || !swap || !restart) return;

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (!coarse) return;

  stick.hidden = visible;
  attack.hidden = visible;
  swap.hidden = visible;
  restart.hidden = !visible;
}
