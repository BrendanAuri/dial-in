/**
 * Replay codes identify a round exactly: packId/levelId@packVersion:seed,
 * with the seed in base 36, e.g. "dev/brightness@1:1x9k3f".
 */

export interface ReplayCode {
  readonly packId: string;
  readonly levelId: string;
  readonly packVersion: number;
  readonly seed: number;
}

const PATTERN = /^([a-z0-9][a-z0-9.-]*)\/([a-z0-9][a-z0-9-]*)@(\d+):([0-9a-z]+)$/;
const MAX_SEED = 0xffffffff;

export function formatReplayCode(code: ReplayCode): string {
  return `${code.packId}/${code.levelId}@${code.packVersion}:${code.seed.toString(36)}`;
}

/** Returns null for anything that isn't a well-formed code. */
export function parseReplayCode(text: string): ReplayCode | null {
  const match = PATTERN.exec(text.trim().toLowerCase());
  const [, packId, levelId, version, seedText] = match ?? [];
  if (packId === undefined || levelId === undefined || version === undefined || seedText === undefined) return null;
  const seed = parseInt(seedText, 36);
  if (!Number.isSafeInteger(seed) || seed > MAX_SEED) return null;
  return { packId, levelId, packVersion: Number(version), seed };
}
