import type { MissionDef } from './types';

/** Первая цепочка: дойти до тропы → зачистить → отнести амулет. */
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
];
