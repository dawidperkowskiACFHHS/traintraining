import type { Settings, State } from './types';
import { validateSave } from './save-validation';
export const MATCH_KEY = 'last-stop-match-v1';
export const BACKUP_KEY = MATCH_KEY + '-backup';
export const PREFERENCES_KEY = 'last-stop-preferences-v1';
export function storeMatch(storage: Storage, raw: string) {
  const previous = storage.getItem(MATCH_KEY);
  if (previous && previous !== raw) {
    try {
      validateSave(JSON.parse(previous));
      storage.setItem(BACKUP_KEY, previous);
    } catch {
      /* Keep the primary slot if a backup cannot be written. */
    }
  }
  storage.setItem(MATCH_KEY, raw);
}
export function recoverMatch(
  storage: Storage,
  parse: (raw: string) => State,
  backupOnly = false,
): { state: State; backup: boolean } {
  let error: unknown;
  for (const key of backupOnly ? [BACKUP_KEY] : [MATCH_KEY, BACKUP_KEY]) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const state = parse(raw);
      if (key === BACKUP_KEY) {
        try {
          storage.setItem(MATCH_KEY, raw);
        } catch {}
      }
      return { state, backup: key === BACKUP_KEY };
    } catch (e) {
      error = e;
    }
  }
  throw error ?? new Error('No saved journey is available. Import an exported save from Settings.');
}
export function readPreferences(storage: Storage, fallback: Settings): Settings {
  try {
    const p = JSON.parse(storage.getItem(PREFERENCES_KEY) || 'null');
    if (!p || typeof p !== 'object') return fallback;
    const out = { ...fallback, bindings: { ...fallback.bindings } };
    for (const key of ['sound', 'reducedMotion', 'panelPause', 'simplified', 'autoQuestions'] as const)
      if (typeof p[key] === 'boolean') out[key] = p[key];
    if (Number.isFinite(p.textScale)) out.textScale = Math.max(1, Math.min(1.4, p.textScale));
    for (const key of ['masterVolume', 'musicVolume', 'effectsVolume', 'ambienceVolume'] as const)
      if (Number.isFinite(p[key])) out[key] = Math.max(0, Math.min(1, p[key]));
    if (p.bindings && typeof p.bindings === 'object')
      for (const key of Object.keys(out.bindings))
        if (typeof p.bindings[key] === 'string' && p.bindings[key].length < 40)
          out.bindings[key] = p.bindings[key];
    return out;
  } catch {
    return fallback;
  }
}
