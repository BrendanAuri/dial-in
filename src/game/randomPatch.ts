/** Musical random patches for Free Play's Randomise: one of the content's sound-type templates. */
import { FREE_PLAY_TEMPLATES } from '../content';
import type { GeneratorTemplate } from '../content/schema';
import type { Patch } from '../engine/params';
import { weightedPick, type Rng } from './rng';
import { patchFromTemplate } from './targetGenerator';

export function randomPatch(rng: Rng, templates: readonly GeneratorTemplate[] = FREE_PLAY_TEMPLATES): Patch {
  const template = weightedPick(rng, templates, templates.map((t) => t.weight));
  return patchFromTemplate(rng, template);
}
