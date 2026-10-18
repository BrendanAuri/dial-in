/** Looking up packs and levels, and which controls a level unlocks. */
import type { Level, Pack } from '../content/schema';
import { PACKS } from '../content';
import { PARAM_IDS, type ParamId } from '../engine/params';
import { patchFromRecord } from '../engine/patch';
import type { PresetSound } from '../library/library';

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

/** 1-based position of a level in its pack, or 0 if it isn't there. */
export function levelNumber(pack: Pack, levelId: string): number {
  return packLevels(pack).findIndex((level) => level.id === levelId) + 1;
}

/** The level after `levelId` in play order, across chapters. */
export function nextLevel(pack: Pack, levelId: string): Level | undefined {
  const levels = packLevels(pack);
  const index = levels.findIndex((level) => level.id === levelId);
  return index < 0 ? undefined : levels[index + 1];
}

/** The level that introduces a control, if any. */
export function levelIntroducing(pack: Pack, id: ParamId): Level | undefined {
  return packLevels(pack).find((level) => level.newControls.includes(id));
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

/** Every pack's factory sounds, as library entries with ids like "bass/reese". */
export function packPresets(packs: readonly Pack[] = PACKS): PresetSound[] {
  return packs.flatMap((pack) =>
    (pack.presets ?? []).map((preset) => ({
      id: `${pack.id}/${preset.id}`,
      source: `preset:${pack.id}` as const,
      name: preset.name,
      tags: preset.tags,
      patch: patchFromRecord({ ...preset.patch }),
    })),
  );
}
