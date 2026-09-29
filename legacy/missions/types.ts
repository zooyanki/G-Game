export type MissionKind = 'reach' | 'kill' | 'fetch';

export type MissionDef = {
  id: string;
  kind: MissionKind;
  title: string;
  /** Для kill — сколько врагов с этим missionId нужно убить. */
  killCount?: number;
  /** Для fetch — id предмета на карте. */
  itemId?: string;
};

export type MissionProgress = {
  def: MissionDef;
  killed: number;
  hasItem: boolean;
  done: boolean;
};
