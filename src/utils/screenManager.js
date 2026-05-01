/** Window name reused so a second click focuses the same projection window */
export const PROJECTION_WINDOW_NAME = 'culto-projection';

/**
 * Chromium Window Management API — extended screen placement for presenter mode.
 * @returns {boolean}
 */
export function isWindowManagementSupported() {
  return typeof window !== 'undefined' && 'getScreenDetails' in window;
}

/**
 * Pick external / projector screen from a ScreenDetails instance (sync).
 * @param {ScreenDetailed} details
 * @returns {ScreenDetailed | null}
 */
export function pickProjectorFromDetails(details) {
  const screens = details?.screens;
  if (!screens || screens.length < 2) return null;

  const nonPrimary = screens.find((s) => !s.isPrimary);
  if (nonPrimary) return nonPrimary;

  const cur = window.screen;
  const others = screens.filter(
    (s) =>
      s.availLeft !== cur.availLeft ||
      s.availTop !== cur.availTop ||
      s.availWidth !== cur.availWidth ||
      s.availHeight !== cur.availHeight
  );
  const pool = others.length > 0 ? others : screens;
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
  try {
    const details = await window.getScreenDetails();
    return pickProjectorFromDetails(details);
  } catch {
    return null;
  }
}

/**
 * Options for Element.requestFullscreen when targeting the secondary display.
 */
export async function getFullscreenScreenOptions() {
  if (!isWindowManagementSupported()) return undefined;
  try {
    const details = await window.getScreenDetails();
    const screen = pickProjectorFromDetails(details);
    return screen ? { screen } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Open projection URL on external display when possible.
 * Opens synchronously first (preserves user gesture), then await getScreenDetails + moveTo/resizeTo.
 * @param {string} url — e.g. '/projection'
 * @returns {Promise<{ win: Window | null, mode: 'projector' | 'fallback-single-screen' | 'fallback-unsupported' | 'fallback-denied' | 'blocked' }>}
 */
export async function openProjectionWindow(url) {
  // 1) Open synchronously so the browser still treats this as a direct user gesture (popup + placement).
  const win = window.open(url, PROJECTION_WINDOW_NAME, 'popup=yes,width=1024,height=768');
  if (!win) {
    return { win: null, mode: 'blocked' };
  }

  if (!isWindowManagementSupported()) {
    return { win, mode: 'fallback-unsupported' };
  }

  let details;
  try {
    details = await window.getScreenDetails();
  } catch {
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
    // Non-fatal; ProjectionPage still requests fullscreen on secondary screen when possible.
  }

  return { win, mode: 'projector' };
}
