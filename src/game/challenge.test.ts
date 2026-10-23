import { describe, expect, it } from 'vitest';
import type { Patch } from '../engine/params';
import { DEFAULT_PATCH } from '../engine/patch';
import {
  challengeInviteText,
  challengeResultText,
  challengeRound,
  isPlayableChallenge,
  soundInviteText,
  suggestedControls,
} from './challenge';

const reese: Patch = { ...DEFAULT_PATCH, 'osc2.detune': 25, 'filter.cutoff': 600, 'drive.amount': 0.4, 'sub.level': 0.5 };
const C3 = 48;
const C1 = 24;

describe('challenges', () => {
  it('starts the solver’s controls at their defaults and locks the rest as in the sound', () => {
    const round = challengeRound({ patch: reese, controls: ['drive.amount', 'filter.cutoff'], note: C3 });
    expect(round.unlocked).toEqual(['filter.cutoff', 'drive.amount']);
    expect(round.start).toEqual({ ...reese, 'filter.cutoff': DEFAULT_PATCH['filter.cutoff'], 'drive.amount': 0 });
    expect(round.target).toBe(reese);
  });

  it('suggests the controls the sound changes that can be heard on its note', () => {
    expect(suggestedControls(reese, C3)).toEqual(['osc2.detune', 'sub.level', 'filter.cutoff', 'drive.amount']);
    // On C1 the sub would be too low to hear.
    expect(suggestedControls(reese, C1)).not.toContain('sub.level');
  });

  it('needs at least one control that starts noticeably off', () => {
    expect(isPlayableChallenge({ patch: reese, controls: ['drive.amount'], note: C3 })).toBe(true);
    expect(isPlayableChallenge({ patch: reese, controls: ['amp.attack'], note: C3 })).toBe(false);
    expect(isPlayableChallenge({ patch: reese, controls: [], note: C3 })).toBe(false);
  });
});

describe('share texts', () => {
  it('names the sound and score, never its settings', () => {
    expect(challengeInviteText('Growl', 3)).toBe('Can you match "Growl"? A Dial In challenge with 3 controls.');
    expect(challengeInviteText('Growl', 1)).toMatch(/with 1 control\.$/);
    expect(challengeResultText('Growl', 92)).toBe('Dial In challenge "Growl" · 92 ★★. Can you beat it?');
    expect(challengeResultText('Growl', 41)).toBe('Dial In challenge "Growl" · 41. Can you beat it?');
    expect(soundInviteText('Reese')).toBe('"Reese": a sound made in Dial In.');
  });
});
