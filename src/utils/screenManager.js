/** Window name reused so a second click focuses the same projection window */
export const PROJECTION_WINDOW_NAME = 'culto-projection';

let cachedScreenDetails = null;
let screenChangeBound = false;

/**
 * Chromium Window Management API — extended screen placement for presenter mode.
 * @returns {boolean}
 */
export function isWindowManagementSupported() {
  return typeof window !== 'undefined' && 'getScreenDetails' in window;
}

async function ensureScreenDetailsCache() {
  if (!isWindowManagementSupported()) return null;
  if (cachedScreenDetails) return cachedScreenDetails;
  try {
    const details = await window.getScreenDetails();
    cachedScreenDetails = details;
    if (!screenChangeBound && typeof details.addEventListener === 'function') {
      details.addEventListener('screenschange', () => {
        window
          .getScreenDetails()
          .then((d) => {
            cachedScreenDetails = d;
          })
          .catch(() => {});
      });
      screenChangeBound = true;
    }
    return cachedScreenDetails;
  } catch {
    return null;
  }
}

/**
 * Warm up Window Management (permission prompt on first visit to operator).
 * Caches ScreenDetails so window.open can run synchronously with projector bounds + fullscreen.
 */
export async function primeScreenManagement() {
  return ensureScreenDetailsCache();
}

/**
 * Pick external / projector screen from a ScreenDetails instance (sync).
 * @param {ScreenDetailed} details
 * @returns {ScreenDetailed | null}
 */
function screenMatchesWindowScreen(s) {
  const cur = window.screen;
  return (
    s.availLeft === cur.availLeft &&
    s.availTop === cur.availTop &&
    s.availWidth === cur.availWidth &&
    s.availHeight === cur.availHeight
  );
}

/**
 * Guest / projector display: never the screen that currently hosts the operator window.
 * Relying only on isPrimary breaks when the OS mislabels the projector as primary.
 */
export function pickProjectorFromDetails(details) {
  const screens = details?.screens;
  if (!screens || screens.length < 2) return null;

  const notOperatorScreen = screens.filter((s) => !screenMatchesWindowScreen(s));
  const pool = notOperatorScreen.length > 0 ? notOperatorScreen : screens;

  const nonPrimary = pool.find((s) => !s.isPrimary);
  if (nonPrimary) return nonPrimary;

  let best = null;
  let bestArea = 0;
  for (const s of pool) {
    const area = s.availWidth * s.availHeight;
    if (area > bestArea) {
      bestArea = area;
      best = s;
    }
  }
  return best;
}

/**
 * Returns the projector screen, or null if unsupported / denied / single display.
 */
export async function pickProjectorScreen() {
  if (!isWindowManagementSupported()) return null;
  const details = await ensureScreenDetailsCache();
  return details ? pickProjectorFromDetails(details) : null;
}

/**
 * Open projection URL on external display when possible.
 *
 * Order matters: open the popup SYNCHRONOUSLY first (preserves the click gesture and avoids
 * Chrome's heuristic that drops left/top when the popup spawns off-screen with a stale
 * activation). Then resolve cached ScreenDetails and reposition with moveTo/resizeTo.
 *
 * @param {string} url — e.g. '/projection'
 * @returns {Promise<{ win: Window | null, mode: 'projector' | 'fallback-single-screen' | 'fallback-unsupported' | 'fallback-denied' | 'blocked' }>}
 */
export async function openProjectionWindow(url) {
  const win = window.open(url, PROJECTION_WINDOW_NAME, 'popup=yes,width=1024,height=768');
  if (!win) {
    return { win: null, mode: 'blocked' };
  }

  if (!isWindowManagementSupported()) {
    return { win, mode: 'fallback-unsupported' };
  }

  const details = cachedScreenDetails ?? (await ensureScreenDetailsCache());
  if (!details) {
    return { win, mode: 'fallback-denied' };
  }

  if (!details.screens || details.screens.length < 2) {
    return { win, mode: 'fallback-single-screen' };
  }

  const target = pickProjectorFromDetails(details);
  if (!target) {
    return { win, mode: 'fallback-single-screen' };
  }

  try {
    win.moveTo(target.availLeft, target.availTop);
    win.resizeTo(target.availWidth, target.availHeight);
  } catch {
    // Non-fatal; ProjectionPage will still request fullscreen.
  }

  return { win, mode: 'projector' };
}

/**
 * Reattach to an existing projection popup opened with {@link PROJECTION_WINDOW_NAME}.
 * Uses `window.open('', name)` so the URL of an existing window is unchanged (HTML).
 * Returns null if no such window exists, or if the target is not the projection route
 * (e.g. a mistaken blank window is closed).
 * @returns {Window | null}
 */
export function attachExistingProjectionWindow() {
  try {
    const w = window.open('', PROJECTION_WINDOW_NAME);
    if (!w || w.closed) return null;
    let path = '';
    try {
      path = new URL(w.location.href).pathname;
    } catch {
      try {
        w.close();
      } catch {
        /* ignore */
      }
      return null;
    }
    if (path.endsWith('/projection')) {
      return w;
    }
    try {
      w.close();
    } catch {
      /* ignore */
    }
    return null;
  } catch {
    return null;
  }
}
