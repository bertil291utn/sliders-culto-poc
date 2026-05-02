import {
  getSongByNumber,
  getSongByTitleFuzzy,
  createSong,
  setSongLines,
} from '../db/database';
import {
  searchHimnario,
  fetchHimnarioDetail,
  normalizeTitle,
} from './himnarioScraper';

/**
 * @param {{ title: string, url: string }[]} results
 * @param {number|null|undefined} number
 * @param {string} title
 */
export function pickBestHimnarioResult(results, number, title) {
  if (!results?.length) return null;
  if (number != null) {
    const ns = String(number);
    const byNum = results.find((r) => {
      const t = r.title || '';
      return (
        new RegExp(`(?:^|\\D)${ns}(?:\\D|$)`).test(t) ||
        t.startsWith(`${ns} `) ||
        t.startsWith(`${ns}.`)
      );
    });
    if (byNum) return byNum;
  }
  if (title?.trim()) {
    const nt = normalizeTitle(title);
    if (nt.length >= 2) {
      let best = null;
      let score = -1;
      for (const r of results) {
        const rt = normalizeTitle(r.title || '');
        let s = 0;
        if (rt === nt) s = 3;
        else if (rt.includes(nt) || nt.includes(rt)) s = 2;
        if (s > score) {
          score = s;
          best = r;
        }
      }
      if (score > 0) return best;
    }
  }
  return results[0];
}

/**
 * @param {{ number?: number|null, title?: string, hint?: string }} item
 * @param {string} [resolvedTitle]
 */
function slotLabelForSong(item, resolvedTitle) {
  const t = resolvedTitle || item.title || '';
  const parts = [t, item.number != null ? `#${item.number}` : '', item.hint ? `(${item.hint})` : ''].filter(
    Boolean
  );
  const joined = parts.join(' ').trim();
  return joined || (item.number != null ? `Himno ${item.number}` : 'Alabanza');
}

/**
 * @param {import('./cultoTextParser').ParsedItem[]} items
 * @param {{ onProgress?: (done: number, total: number) => void }} [opts]
 */
export async function resolveParsedItems(items, opts = {}) {
  const { onProgress } = opts;
  const out = [];
  const total = items.filter((x) => x.kind !== 'header').length;
  let done = 0;
  const tick = () => {
    done += 1;
    onProgress?.(done, total);
  };

  for (const item of items) {
    if (item.kind === 'header') continue;

    if (item.kind === 'reading') {
      out.push({
        type: 'reading',
        label: item.label || 'Lectura',
        song_id: null,
        content: '',
        source: 'parser',
        status: 'parser',
      });
      tick();
      continue;
    }
    if (item.kind === 'message') {
      out.push({
        type: 'message',
        label: item.label || 'Mensaje',
        song_id: null,
        content: '',
        source: 'parser',
        status: 'parser',
      });
      tick();
      continue;
    }
    if (item.kind === 'no_digital') {
      out.push({
        type: 'no_digital',
        label: item.label || 'Sin digital',
        song_id: null,
        content: '',
        source: 'parser',
        status: 'parser',
      });
      tick();
      continue;
    }

    if (item.kind === 'unknown') {
      const text = (item.text || '').trim();
      const fuzzy = text ? getSongByTitleFuzzy(text) : null;
      if (fuzzy) {
        out.push({
          type: 'song',
          label: fuzzy.title,
          song_id: fuzzy.id,
          content: '',
          source: 'library',
          status: 'library',
        });
      } else {
        let webSongId = null;
        let webTitle = text;
        try {
          if (text.length >= 1) {
            const results = await searchHimnario(text);
            const pick = pickBestHimnarioResult(results, null, text);
            if (pick) {
              const detail = await fetchHimnarioDetail(pick.url);
              const id = createSong({
                title: detail.title,
                artist: detail.artist || '',
                suggested_color: '#1e1b4b',
                number: null,
                language: null,
              });
              setSongLines(id, detail.linesText.split('\n'));
              webSongId = id;
              webTitle = detail.title;
            }
          }
        } catch {
          /* ignore network / parse errors */
        }
        out.push({
          type: 'song',
          label: webTitle || text || 'Alabanza',
          song_id: webSongId,
          content: '',
          source: webSongId ? 'kichwamusic' : 'empty',
          status: webSongId ? 'kichwamusic' : 'empty',
        });
      }
      tick();
      continue;
    }

    // song
    let songRow =
      item.number != null ? getSongByNumber(item.number, item.language) : null;
    if (!songRow && item.title?.trim()) {
      songRow = getSongByTitleFuzzy(item.title);
    }

    if (songRow) {
      out.push({
        type: 'song',
        label: slotLabelForSong(item, songRow.title),
        song_id: songRow.id,
        content: '',
        source: 'library',
        status: 'library',
      });
      tick();
      continue;
    }

    let webSongId = null;
    let webTitle = item.title || '';
    try {
      const term =
        item.number != null
          ? String(item.number)
          : (item.title || '').trim();
      if (term) {
        const results = await searchHimnario(term);
        const pick = pickBestHimnarioResult(results, item.number ?? null, item.title || '');
        if (pick) {
          const detail = await fetchHimnarioDetail(pick.url);
          const id = createSong({
            title: detail.title,
            artist: detail.artist || '',
            suggested_color: '#1e1b4b',
            number: item.number ?? null,
            language: item.language ?? null,
          });
          setSongLines(id, detail.linesText.split('\n'));
          webSongId = id;
          webTitle = detail.title;
        }
      }
    } catch {
      /* ignore */
    }

    if (webSongId) {
      out.push({
        type: 'song',
        label: slotLabelForSong(item, webTitle),
        song_id: webSongId,
        content: '',
        source: 'kichwamusic',
        status: 'kichwamusic',
      });
    } else {
      out.push({
        type: 'song',
        label: slotLabelForSong(item, item.title || ''),
        song_id: null,
        content: '',
        source: 'empty',
        status: 'empty',
      });
    }
    tick();
  }

  return out;
}

/**
 * @typedef {{ localId: string, type: string, label: string, song_id: number|null, content: string, source: string, status: string }} PreviewRow
 */

/** @returns {PreviewRow} */
function newPreviewRow(type, label, source) {
  return {
    localId: crypto.randomUUID(),
    type,
    label,
    song_id: null,
    content: '',
    source,
    status: source,
  };
}

/**
 * Inserta secciones típicas del culto dominical si faltan (vista previa).
 * @param {PreviewRow[]} rows
 * @returns {PreviewRow[]}
 */
export function mergeTypicalDominicalStructure(rows) {
  const copy = rows.map((r) => ({ ...r, localId: r.localId || crypto.randomUUID() }));
  const labelHas = (sub) =>
    copy.some((s) => (s.label || '').toLowerCase().includes(sub));

  if (!labelHas('bienvenida')) {
    copy.unshift(newPreviewRow('no_digital', 'Bienvenida', 'template'));
  }

  const songIndices = [];
  copy.forEach((r, i) => {
    if (r.type === 'song') songIndices.push(i);
  });

  const hasReading = copy.some((s) => s.type === 'reading');
  if (!hasReading) {
    let pos = 0;
    if (songIndices.length >= 3) pos = songIndices[2] + 1;
    else if (songIndices.length > 0) pos = songIndices[songIndices.length - 1] + 1;
    else {
      const firstNoDigital = copy.findIndex((s) => s.type === 'no_digital');
      pos = firstNoDigital >= 0 ? firstNoDigital + 1 : 0;
    }
    copy.splice(Math.min(pos, copy.length), 0, newPreviewRow('reading', 'Lectura bíblica', 'template'));
  }

  const hasCoreMessage = copy.some(
    (s) => s.type === 'message' && /mensaje/i.test(s.label || '')
  );
  if (!hasCoreMessage) {
    const mid = Math.floor(copy.length / 2);
    copy.splice(mid, 0, newPreviewRow('message', 'Mensaje', 'template'));
  }

  if (!labelHas('ofrenda')) {
    const ins = Math.max(1, copy.length - 1);
    copy.splice(ins, 0, newPreviewRow('no_digital', 'Ofrendas', 'template'));
  }

  if (!labelHas('despedida') && !labelHas('oración final') && !labelHas('oracion final')) {
    copy.push(newPreviewRow('no_digital', 'Oración y despedida', 'template'));
  }

  return copy;
}

export function previewNeedsTypicalStructure(rows) {
  const hasReading = rows.some((s) => s.type === 'reading');
  const hasMessage = rows.some(
    (s) => s.type === 'message' && /mensaje/i.test(s.label || '')
  );
  const hasOfrenda = rows.some((s) =>
    (s.label || '').toLowerCase().includes('ofrenda')
  );
  return !hasReading || !hasMessage || !hasOfrenda;
}
