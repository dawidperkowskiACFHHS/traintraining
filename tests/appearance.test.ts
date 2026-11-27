import { describe, it, expect } from 'vitest';
import { APPEARANCE_OPTIONS, DEFAULT_APPEARANCE, normalizeAppearance } from '../src/appearance';
import { newGame, serialize, deserialize, nextRound, startRound } from '../src/simulation';

describe('traveler appearance persistence', () => {
  it('validates palette indices and rejects malformed imported values', () => {
    expect(
      normalizeAppearance({
        skinTone: -1,
        hairstyle: 2.5,
        hairColor: '3',
        shirtColor: 999,
        trousersColor: null,
        accessory: '__proto__',
      }),
    ).toEqual(DEFAULT_APPEARANCE);
    for (const key of Object.keys(APPEARANCE_OPTIONS) as (keyof typeof APPEARANCE_OPTIONS)[]) {
      const index = APPEARANCE_OPTIONS[key].length - 1;
      expect(normalizeAppearance({ [key]: index })[key]).toBe(index);
    }
  });
  it('round-trips custom looks and preserves them when roles rotate', () => {
    const state = newGame('traveler-save', 20);
    const control = deserialize(serialize(state));
    state.appearance = {
      skinTone: 5,
      hairstyle: 3,
      hairColor: 4,
      shirtColor: 1,
      trousersColor: 2,
      accessory: 2,
    };
    const saved = deserialize(serialize(state));
    expect(saved.appearance).toEqual(state.appearance);
    saved.phase = 'results';
    nextRound(saved);
    expect(saved.appearance).toEqual(state.appearance);
    startRound(saved);
    expect(saved.appearance).toEqual(state.appearance);
    control.phase = 'results';
    nextRound(control);
    startRound(control);
    expect({ ...saved, appearance: control.appearance }).toEqual(control);
  });
  it('loads older match saves with a valid profile fallback', () => {
    const state = newGame('legacy-traveler', 20);
    const legacy = JSON.parse(serialize(state));
    delete legacy.appearance;
    expect(deserialize(JSON.stringify(legacy)).appearance).toEqual(DEFAULT_APPEARANCE);
    const profile = { ...DEFAULT_APPEARANCE, accessory: 2, shirtColor: 4 };
    expect(deserialize(JSON.stringify(legacy), profile).appearance).toEqual(profile);
  });
});
