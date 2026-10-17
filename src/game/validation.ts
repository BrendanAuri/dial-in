/**
 * Content checks, run over every shipped pack in a unit test: ids, known
 * controls, generator ranges inside parameter ranges, note ranges,
 * and requirements that resolve.
 */
import type { GeneratorParams, Level, Pack } from '../content/schema';
import { MODULES, PARAMS, PARAM_IDS, type ParamId } from '../engine/params';
import { noteNameToMidi } from '../engine/notes';
import { setParam, DEFAULT_PATCH } from '../engine/patch';
import { unlockedControls } from './packs';

const PACK_ID = /^[a-z0-9][a-z0-9.-]*$/;
const ITEM_ID = /^[a-z0-9][a-z0-9-]*$/;
const PERCENT = 100;

function asParamId(key: string): ParamId | null {
  return PARAM_IDS.find((id) => id === key) ?? null;
}

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, i) => values.indexOf(value) !== i))];
}

function checkNoteRange(range: readonly [string, string], where: string, errors: string[]): void {
  try {
    if (noteNameToMidi(range[0]) > noteNameToMidi(range[1])) errors.push(`${where}: note range is backwards`);
  } catch {
    errors.push(`${where}: note range ${range.join('–')} isn't valid`);
  }
}

/** Generators must suit their control, stay inside its range and only cover unlocked controls. */
function checkGenerators(params: GeneratorParams, unlocked: ReadonlySet<ParamId>, where: string, errors: string[]): void {
  for (const [key, gen] of Object.entries(params)) {
    const id = asParamId(key);
    if (!id) {
      errors.push(`${where}: unknown control "${key}"`);
      continue;
    }
    if (!gen) continue;
    if (!unlocked.has(id)) errors.push(`${where}: ${id} has a generator but is still locked`);
    const def = PARAMS[id];
    if (def.kind === 'continuous') {
      if (gen.kind !== 'range') {
        errors.push(`${where}: ${id} needs a range`);
        continue;
      }
      if (gen.min > gen.max) errors.push(`${where}: ${id} min is above max`);
      if (gen.min < def.min || gen.max > def.max) errors.push(`${where}: ${id} range is outside ${def.min}–${def.max}`);
      if ((gen.scale ?? def.scale) === 'log' && gen.min <= 0) errors.push(`${where}: ${id} log range must start above 0`);
      if (gen.offChance !== undefined && (gen.offChance < 0 || gen.offChance > 1)) errors.push(`${where}: ${id} offChance must be 0–1`);
      if (gen.offValue !== undefined && (gen.offValue < def.min || gen.offValue > def.max)) {
        errors.push(`${where}: ${id} offValue is outside its range`);
      }
    } else {
      if (gen.kind !== 'choice') {
        errors.push(`${where}: ${id} needs a choice`);
        continue;
      }
      const allowed: readonly unknown[] = def.options.map((option) => option.value);
      if (gen.options.length === 0) errors.push(`${where}: ${id} has no options`);
      for (const option of gen.options) {
        if (!allowed.includes(option)) errors.push(`${where}: ${id} option ${String(option)} isn't valid`);
      }
      if (gen.weights) {
        if (gen.weights.length !== gen.options.length) errors.push(`${where}: ${id} needs one weight per option`);
        if (gen.weights.some((w) => w < 0) || gen.weights.reduce((a, b) => a + b, 0) <= 0) {
          errors.push(`${where}: ${id} weights must be positive`);
        }
      }
    }
  }
}

function checkLevel(pack: Pack, level: Level, errors: string[]): void {
  const where = `${pack.id}/${level.id}`;
  if (!ITEM_ID.test(level.id)) errors.push(`${where}: level id must be lower case letters, digits and dashes`);
  if (level.title.trim() === '' || level.intro.trim() === '') errors.push(`${where}: needs a title and an intro`);
  for (const id of level.newControls) if (!asParamId(id)) errors.push(`${where}: unknown new control "${id}"`);
  for (const [key, value] of Object.entries(level.fixed)) {
    const id = asParamId(key);
    if (!id) errors.push(`${where}: unknown fixed control "${key}"`);
    else if (setParam(DEFAULT_PATCH, id, value)[id] !== value) errors.push(`${where}: fixed ${id} value isn't valid`);
  }
  const unlocked = new Set(unlockedControls(pack, level.id));
  checkGenerators(level.generator.params, unlocked, where, errors);
  const templates = level.generator.templates ?? [];
  for (const id of duplicates(templates.map((t) => t.id))) errors.push(`${where}: template id "${id}" is used twice`);
  for (const template of templates) {
    const at = `${where}#${template.id}`;
    if (!(template.weight > 0)) errors.push(`${at}: weight must be positive`);
    checkGenerators(template.params, unlocked, at, errors);
    if (template.noteRange) checkNoteRange(template.noteRange, at, errors);
  }
  checkNoteRange(level.noteRange, where, errors);
  if (level.rounds !== undefined && !(Number.isInteger(level.rounds) && level.rounds >= 1)) {
    errors.push(`${where}: rounds must be a whole number of at least 1`);
  }
  if (level.passMark !== undefined && !(level.passMark >= 0 && level.passMark <= PERCENT)) {
    errors.push(`${where}: pass mark must be 0–100`);
  }
}

/** Problems with one pack, as readable messages. Empty when the pack is fine. */
export function validatePack(pack: Pack, packs: readonly Pack[]): string[] {
  const errors: string[] = [];
  const where = pack.id;
  if (!PACK_ID.test(pack.id)) errors.push(`${where}: pack id must be lower case letters, digits, dots and dashes`);
  if (!(Number.isInteger(pack.version) && pack.version >= 1)) errors.push(`${where}: version must be a whole number from 1`);
  for (const id of pack.baseControls) if (!asParamId(id)) errors.push(`${where}: unknown base control "${id}"`);
  for (const required of pack.requires?.packs ?? []) {
    if (required === pack.id) errors.push(`${where}: requires itself`);
    else if (!packs.some((p) => p.id === required)) errors.push(`${where}: requires unknown pack "${required}"`);
  }
  for (const module of pack.requires?.engineModules ?? []) {
    if (!MODULES.some((m) => m.id === module)) errors.push(`${where}: requires unknown engine module "${module}"`);
  }
  for (const id of duplicates(pack.chapters.map((c) => c.id))) errors.push(`${where}: chapter id "${id}" is used twice`);
  const levels = pack.chapters.flatMap((chapter) => {
    if (chapter.levels.length === 0) errors.push(`${where}/${chapter.id}: chapter has no levels`);
    return chapter.levels;
  });
  if (levels.length === 0) errors.push(`${where}: pack has no levels`);
  for (const id of duplicates(levels.map((l) => l.id))) errors.push(`${where}: level id "${id}" is used twice`);
  const introduced = [...pack.baseControls, ...levels.flatMap((l) => l.newControls)];
  for (const id of duplicates(introduced)) errors.push(`${where}: ${id} is introduced more than once`);
  for (const level of levels) checkLevel(pack, level, errors);
  return errors;
}

/** Problems across every pack, including duplicate pack ids. */
export function validatePacks(packs: readonly Pack[]): string[] {
  const errors = duplicates(packs.map((p) => p.id)).map((id) => `pack id "${id}" is used twice`);
  return [...errors, ...packs.flatMap((pack) => validatePack(pack, packs))];
}
