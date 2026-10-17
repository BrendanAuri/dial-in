/** Every pack the app ships with, in menu order, and the templates Free Play's Randomise uses. */
import { FOUNDATIONS_PACK } from './packs/foundations';
import type { GeneratorTemplate, Pack } from './schema';
import { SOUND_TYPES } from './soundTypes';

export const PACKS: readonly Pack[] = [FOUNDATIONS_PACK];

export const FREE_PLAY_TEMPLATES: readonly GeneratorTemplate[] = SOUND_TYPES;
