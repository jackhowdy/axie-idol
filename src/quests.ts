/**
 * Level that unlocks each cast face / prop.
 * Mirrors QUEST_DEFS in server/core.mjs — the server stays the authority on
 * actual unlocking; the client only uses this table for labels ("Lv 14").
 */
export const UNLOCK_LEVEL: Record<string, number> = {
  kotaro: 0,
  bing: 1,
  'kotaro-sword': 2,
  kibo: 3,
  'bing-cannon': 4,
  paladill: 5,
  'kibo-hammer': 6,
  pomodoro: 7,
  'paladill-axe': 8,
  tripp: 9,
  'pomodoro-staff': 10,
  xia: 11,
  'tripp-sword': 12,
  'xia-axe': 13,
  buba: 14,
  olek: 15,
  puffy: 16,
  '4154': 17,
  '4155': 18,
  '4156': 19,
  '991': 20,
  '35': 21,
  '1367': 22,
  '2660': 23,
  'agonia-echo': 24,
}

/** The 18 free-cast faces in ladder order (Kotaro first, villain last). */
export const CAST_ORDER: string[] = [
  'kotaro',
  'bing',
  'kibo',
  'paladill',
  'pomodoro',
  'tripp',
  'xia',
  'buba',
  'olek',
  'puffy',
  '4154',
  '4155',
  '4156',
  '991',
  '35',
  '1367',
  '2660',
  'agonia-echo',
]

export function unlockLevelFor(id: string): number | null {
  const n = UNLOCK_LEVEL[id]
  return typeof n === 'number' ? n : null
}
