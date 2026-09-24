import type { MissionDef, MissionProgress } from './types';

type Listener = (progress: MissionProgress | null, index: number, total: number) => void;

/**
 * Тонкий раннер кампании: сцена кормит событиями,
 * наружу отдаёт прогресс для HUD и маркера.
 */
export class MissionRunner {
  private index = 0;
  private killed = 0;
  private hasItem = false;
  private finished = false;
  private readonly listener: Listener;

  constructor(
    private readonly campaign: MissionDef[],
    listener: Listener,
  ) {
    this.listener = listener;
    this.emit();
  }

  get current(): MissionDef | null {
    if (this.finished || this.index >= this.campaign.length) return null;
    return this.campaign[this.index];
  }

  get isComplete() {
    return this.finished;
  }

  get carryingItem() {
    return this.hasItem;
  }

  /** Герой зашёл в goal с missionId текущей reach/fetch-миссии. */
  onReachGoal(missionId: string) {
    const mission = this.current;
    if (!mission || mission.id !== missionId) return;

    if (mission.kind === 'reach') {
      this.advance();
      return;
    }

    if (mission.kind === 'fetch' && this.hasItem) this.advance();
  }

  onEnemyKilled(missionId: string | undefined) {
    const mission = this.current;
    if (!mission || mission.kind !== 'kill') return;
    if (missionId !== mission.id) return;

    this.killed += 1;
    this.emit();
    if (this.killed >= (mission.killCount ?? 1)) this.advance();
  }

  onItemPicked(itemId: string) {
    const mission = this.current;
    if (!mission || mission.kind !== 'fetch') return;
    if (mission.itemId !== itemId) return;

    this.hasItem = true;
    this.emit();
  }

  hudText() {
    const mission = this.current;
    if (!mission) return this.finished ? 'Все задания выполнены' : '';

    if (mission.kind === 'kill') {
      const need = mission.killCount ?? 1;
      return `${mission.title} (${this.killed}/${need})`;
    }
    if (mission.kind === 'fetch') {
      return this.hasItem ? `${mission.title} (есть амулет)` : `Найди амулет и ${mission.title.toLowerCase()}`;
    }
    return mission.title;
  }

  private advance() {
    this.index += 1;
    this.killed = 0;
    this.hasItem = false;
    if (this.index >= this.campaign.length) {
      this.finished = true;
      this.emit();
      return;
    }
    this.emit();
  }

  private emit() {
    const mission = this.current;
    if (!mission) {
      this.listener(null, this.index, this.campaign.length);
      return;
    }
    this.listener(
      {
        def: mission,
        killed: this.killed,
        hasItem: this.hasItem,
        done: false,
      },
      this.index,
      this.campaign.length,
    );
  }
}
