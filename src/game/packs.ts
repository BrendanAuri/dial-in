/** Looking up packs and levels, and which controls a level unlocks. */
import type { Level, Pack } from '../content/schema';
import { PACKS } from '../content';
import { PARAM_IDS, type ParamId } from '../engine/params';

export function getPack(id: string, packs: readonly Pack[] = PACKS): Pack | undefined {
  return packs.find((pack) => pack.id === id);
}

/** Every level in the pack, in play order. */
export function packLevels(pack: Pack): Level[] {
  return pack.chapters.flatMap((chapter) => chapter.levels);
}

export function findLevel(pack: Pack, levelId: string): Level | undefined {
  return packLevels(pack).find((level) => level.id === levelId);
}

/**
 * Controls unlocked in a level: the pack's base controls plus the new
 * controls of that level and every earlier one. In display order.
 */
export function unlockedControls(pack: Pack, levelId: string): ParamId[] {
  const unlocked = new Set<ParamId>(pack.baseControls);
  for (const level of packLevels(pack)) {
    for (const id of level.newControls) unlocked.add(id);
    if (level.id === levelId) break;
  }
  return PARAM_IDS.filter((id) => unlocked.has(id));
}
