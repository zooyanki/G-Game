import type { MissionDef } from './types';

/** Предыстория: берег → тропа → деревня → чаща → сигнал князю. */
export const CAMPAIGN: MissionDef[] = [
  {
    id: 'reach-trail',
    kind: 'reach',
    title: 'Дойди до лесной тропы',
  },
  {
    id: 'clear-trail',
    kind: 'kill',
    title: 'Убей разбойников на тропе',
    killCount: 3,
  },
  {
    id: 'deliver-amulet',
    kind: 'fetch',
    title: 'Отнеси амулет в деревню',
    itemId: 'amulet',
  },
  {
    id: 'reach-thicket',
    kind: 'reach',
    title: 'Проверь восточную чащу',
  },
  {
    id: 'clear-rift',
    kind: 'kill',
    title: 'Изгони нечисть у разлома',
    killCount: 4,
  },
  {
    id: 'fetch-seal',
    kind: 'fetch',
    title: 'Отнеси печать к столбу',
    itemId: 'seal',
  },
  {
    id: 'reach-signal',
    kind: 'reach',
    title: 'Подай знак у врат',
  },
];
