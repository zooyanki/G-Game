/** Куда сейчас тянет джойстик и какие кнопки нажаты. Клавиатура пишет сюда же из сцены. */
export class InputState {
  moveX = 0;
  moveY = 0;

  private attackQueued = false;
  private restartQueued = false;
  private swapQueued = false;

  queueAttack() {
    this.attackQueued = true;
  }

  hasAttack() {
    return this.attackQueued;
  }

  clearAttack() {
    this.attackQueued = false;
  }

  queueSwap() {
    this.swapQueued = true;
  }

  consumeSwap() {
    const queued = this.swapQueued;
    this.swapQueued = false;
    return queued;
  }

  queueRestart() {
    this.restartQueued = true;
  }

  consumeRestart() {
    const queued = this.restartQueued;
    this.restartQueued = false;
    return queued;
  }

  /** Сбрасывает разовые нажатия. Вектор джойстика не трогает: палец может ещё лежать на экране. */
  clearTransient() {
    this.attackQueued = false;
    this.restartQueued = false;
    this.swapQueued = false;
  }
}

export const input = new InputState();
