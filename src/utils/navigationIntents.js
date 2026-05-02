/** Session keys for cross-route “deep link” actions from the operator FAB */

export const BUILDER_INTENT_KEY = 'culto_builder_intent';
export const LIBRARY_INTENT_KEY = 'culto_library_intent';

/**
 * @typedef {{ action: 'editSlide' | 'addSlide' | 'editBgColor', cultoId: number, slideId?: number }} BuilderIntent
 * @typedef {{ action: 'editSong', songId: number }} LibraryIntent
 */

export function writeBuilderIntent(intent) {
  try {
    sessionStorage.setItem(BUILDER_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
}

function parseBuilderIntentRaw(raw) {
  const o = JSON.parse(raw);
  if (!o || typeof o !== 'object') return null;
  const cultoId = Number(o.cultoId);
  if (!Number.isFinite(cultoId)) return null;
  const action = o.action;
  if (action !== 'editSlide' && action !== 'addSlide' && action !== 'editBgColor') return null;
  /** @type {BuilderIntent} */
  const out = { action, cultoId };
  if (action === 'editSlide' && o.slideId != null) {
    const slideId = Number(o.slideId);
    if (Number.isFinite(slideId)) out.slideId = slideId;
  }
  return out;
}

/** Read without removing (safe with React Strict Mode if you clear after copying to state). */
export function peekBuilderIntent() {
  try {
    const raw = sessionStorage.getItem(BUILDER_INTENT_KEY);
    if (!raw) return null;
    return parseBuilderIntentRaw(raw);
  } catch {
    return null;
  }
}

export function clearBuilderIntent() {
  try {
    sessionStorage.removeItem(BUILDER_INTENT_KEY);
  } catch {
    /* ignore */
  }
}

/** @returns {BuilderIntent | null} */
export function readAndClearBuilderIntent() {
  const v = peekBuilderIntent();
  clearBuilderIntent();
  return v;
}

export function writeLibraryIntent(intent) {
  try {
    sessionStorage.setItem(LIBRARY_INTENT_KEY, JSON.stringify(intent));
  } catch {
    /* ignore */
  }
}

function parseLibraryIntentRaw(raw) {
  const o = JSON.parse(raw);
  if (!o || typeof o !== 'object') return null;
  if (o.action !== 'editSong') return null;
  const songId = Number(o.songId);
  if (!Number.isFinite(songId)) return null;
  return { action: 'editSong', songId };
}

export function peekLibraryIntent() {
  try {
    const raw = sessionStorage.getItem(LIBRARY_INTENT_KEY);
    if (!raw) return null;
    return parseLibraryIntentRaw(raw);
  } catch {
    return null;
  }
}

export function clearLibraryIntent() {
  try {
    sessionStorage.removeItem(LIBRARY_INTENT_KEY);
  } catch {
    /* ignore */
  }
}

/** @returns {LibraryIntent | null} */
export function readAndClearLibraryIntent() {
  const v = peekLibraryIntent();
  clearLibraryIntent();
  return v;
}
