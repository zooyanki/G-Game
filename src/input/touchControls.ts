import { input, type TouchAction } from './InputState';

export type TouchMode = 'level' | 'sortie' | 'river' | 'card' | 'none';

const HOLD_BUTTONS = new Set<TouchAction>(['jump', 'attack']);

function isTouch() {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** Кнопки поверх игры. На компьютере спрятаны, на телефоне — джойстик, прыжок, удар и смена. */
export function setupTouchControls() {
  const root = document.getElementById('touch');
  const stick = document.getElementById('stick');
  const nub = document.getElementById('nub');
  if (!root || !stick || !nub || !isTouch()) return;

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

  for (const button of root.querySelectorAll<HTMLElement>('[data-action]')) {
    const action = button.dataset.action as TouchAction;
    const setHeld = (held: boolean) => {
      if (action === 'jump') input.jumpHeld = held;
      if (action === 'attack') input.attackHeld = held;
    };

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      if (HOLD_BUTTONS.has(action)) button.setPointerCapture(event.pointerId);
      setHeld(true);
      input.queue(action);
    });
    const release = (event: PointerEvent) => {
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      setHeld(false);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  }
}

/** Какие кнопки видны: в уровне всё, на реке — джойстик и «Войти», на карточке — только её кнопки. */
export function setTouchMode(mode: TouchMode) {
  if (!isTouch()) return;
  const show = (id: string, visible: boolean) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !visible;
  };

  show('stick', mode === 'level' || mode === 'sortie' || mode === 'river');
  show('attack', mode === 'level' || mode === 'sortie' || mode === 'river');
  show('jump', mode === 'level');
  show('swap', mode === 'level' || mode === 'sortie');
  show('super', mode === 'level' || mode === 'sortie');
  show('card-buttons', mode === 'card');

  if (mode !== 'level' && mode !== 'sortie' && mode !== 'river') {
    input.moveX = 0;
    input.moveY = 0;
    input.attackHeld = false;
    input.jumpHeld = false;
    const nub = document.getElementById('nub');
    if (nub) nub.style.transform = '';
  }
  input.clearTransient();
}

/** Кнопка луча тусклая, пока шкала благодати не полна, и светится, когда можно бить. */
export function setSuperReady(ready: boolean) {
  document.getElementById('super')?.classList.toggle('ready', ready);
}

export function setAttackLabel(text: string) {
  const attack = document.getElementById('attack');
  if (attack) attack.textContent = text;
}

/** Подписи кнопок карточки: «Ещё раз» / «К реке» или одна «Дальше». */
export function setCardButtons(retry: string | null, river: string | null) {
  const retryButton = document.getElementById('retry');
  const riverButton = document.getElementById('river');
  if (retryButton) {
    retryButton.hidden = !retry;
    retryButton.textContent = retry ?? '';
  }
  if (riverButton) {
    riverButton.hidden = !river;
    riverButton.textContent = river ?? '';
  }
}
