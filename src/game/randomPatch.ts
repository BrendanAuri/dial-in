/** Musical random patches for Free Play's Randomise: one of the content's sound-type templates. */
import { FREE_PLAY_TEMPLATES } from '../content';
import type { GeneratorTemplate } from '../content/schema';
import type { Patch } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import { weightedPick, type Rng } from './rng';
import { patchFromTemplate } from './targetGenerator';

/** A patch from a random template. Controls the template doesn't set come from `base`. */
export function randomPatch(
  rng: Rng,
  templates: readonly GeneratorTemplate[] = FREE_PLAY_TEMPLATES,
  base: Readonly<Patch> = DEFAULT_PATCH,
): Patch {
  const template = weightedPick(rng, templates, templates.map((t) => t.weight));
  return patchFromTemplate(rng, template, base);
}
