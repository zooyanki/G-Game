export type TouchAction = 'jump' | 'attack' | 'swap' | 'super' | 'retry' | 'river';

/** Куда тянет джойстик и какие кнопки нажаты на экране. Клавиатуру читает `Controls`. */
export class InputState {
  moveX = 0;
  moveY = 0;
  jumpHeld = false;
  attackHeld = false;

  private queued = new Set<TouchAction>();

  queue(action: TouchAction) {
    this.queued.add(action);
  }

  consume(action: TouchAction) {
    return this.queued.delete(action);
  }

  /** Сбрасывает разовые нажатия. Удержание не трогает: палец может ещё лежать на экране. */
  clearTransient() {
    this.queued.clear();
  }
}

export const input = new InputState();
