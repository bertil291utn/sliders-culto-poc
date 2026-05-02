/** @typedef {'header'|'song'|'reading'|'message'|'no_digital'|'unknown'} ParsedKind */

/**
 * @typedef {Object} ParsedItem
 * @property {ParsedKind} kind
 * @property {string} [text]
 * @property {number|null} [number]
 * @property {'es'|'kichwa'|null} [language]
 * @property {string} [title]
 * @property {string} [hint]
 * @property {string} [label]
 */

const BULLET = /^[\s\u00a0]*[•\u2022\u00b7\-\*]\s*/;
const LEADING_NUM = /^[\s\u00a0]*[\(\[]?(\d+)[\)\.\]\u2022\u00b7]?\s*/;
const SUB_ITEM = /^[\s\u00a0]*(?:[→↳]|\u2192|[\[\(]\s*\]\s*|[\[\(]\s*\)|\-\s+)\s*/;
const HYMN_CODE = /(\d{1,4})\s*[\.\,]?\s*([CKck])\b/;
const TRAILING_NUM_PARENS = /\(\s*(\d{1,4})\s*\)\s*$/;
const TRAILING_KEY_PARENS = /\(\s*([E-G][#mb]?(?:\s*\/\s*[E-G][#mb]?)?)\s*\)\s*$/i;

function stripAccents(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function stripLeadingListNumber(line) {
  let s = line.replace(BULLET, '');
  // No quitar el índice si es código de himno: "577.K", "24 C copia", "406. K ..."
  if (/^\s*[\(\[]?\d+(?:\s*[\.\,]\s*|\s+)[CKck]\b/i.test(s)) {
    return s.trim();
  }
  const m = s.match(LEADING_NUM);
  if (m) {
    s = s.slice(m[0].length);
  }
  return s.trim();
}

/**
 * @param {string} raw
 * @returns {ParsedItem[]}
 */
export function parseCultoText(raw) {
  const lines = raw.split(/\r?\n/).map((l) => l.trimEnd());
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line || !line.replace(/\s/g, '')) continue;

    const isSub = SUB_ITEM.test(line) && !HYMN_CODE.test(line.replace(SUB_ITEM, ''));
    if (isSub) {
      line = line.replace(SUB_ITEM, '').trim();
    }

    line = line.replace(BULLET, '');
    line = stripLeadingListNumber(line);
    if (!line) continue;

    const norm = stripAccents(line);

    // Tema / header
    if (/^tema\s*:/i.test(line)) {
      const text = line.replace(/^tema\s*:\s*/i, '').trim();
      items.push({ kind: 'header', text: text || line });
      continue;
    }

    // Instructions to people (skip as header noise)
    if (/melita|te encargo|sacando las letras/i.test(norm)) {
      items.push({ kind: 'header', text: line });
      continue;
    }

    // Section headers like "CULTO DE ADORACIÓN"
    if (/^culto de (adoracion|adoración)/i.test(norm)) {
      items.push({ kind: 'no_digital', label: 'Culto de adoración' });
      continue;
    }

    // Numbered section "4. Alabanzas" — skip generic section titles that don't add a slot
    if (/^\d+\.\s*alabanzas?\b/i.test(norm)) continue;
    if (/^\d+\.\s*(bienvenida|oracion|oración)/i.test(norm)) {
      if (/bienvenida/i.test(norm)) items.push({ kind: 'no_digital', label: 'Bienvenida' });
      else items.push({ kind: 'no_digital', label: 'Oración' });
      continue;
    }

    // Structured worship block (user example)
    if (/^alabanzas?\s*$/i.test(norm)) continue;

    // Reading
    if (/^lectura\b/i.test(norm)) {
      const isBiblica = /biblic|bíblic/i.test(norm);
      const isApertura = /apertura/i.test(norm);
      let label = 'Lectura';
      if (isBiblica) label = 'Lectura bíblica';
      else if (isApertura) label = 'Lectura de apertura';
      items.push({ kind: 'reading', label });
      continue;
    }

    // Message
    if (/^mensaje\b/i.test(norm)) {
      items.push({ kind: 'message', label: 'Mensaje' });
      continue;
    }

    // Ofrenda / ofrendas / combined line
    if (/ofrenda/i.test(norm) && !/[ck]\s*$/i.test(norm) && !/\d{2,4}\s*[ck]/i.test(norm)) {
      items.push({ kind: 'no_digital', label: norm.includes('ofrendas') ? 'Ofrendas' : 'Ofrenda' });
      continue;
    }

    // Other no_digital markers
    if (/^bienvenida\b/i.test(norm)) {
      items.push({ kind: 'no_digital', label: 'Bienvenida' });
      continue;
    }
    if (/^anuncios?\b/i.test(norm)) {
      items.push({ kind: 'message', label: 'Anuncios' });
      continue;
    }
    if (/oracion final|oración final/i.test(norm)) {
      items.push({ kind: 'no_digital', label: 'Oración final' });
      continue;
    }
    if (/^oracion\b|^oración\b|^invitacion\b|^invitación\b/i.test(norm)) {
      items.push({ kind: 'no_digital', label: line.replace(/^\d+\.\s*/, '').trim().split(/\s{2,}/)[0] || 'Oración' });
      continue;
    }
    if (/^especiales?\b/i.test(norm)) {
      items.push({ kind: 'no_digital', label: 'Especiales' });
      continue;
    }
    if (/despedida/i.test(norm)) {
      items.push({ kind: 'no_digital', label: 'Despedida' });
      continue;
    }

    // "MIX" parent line with sub-items handled by skipping MIX alone
    if (/^mix\s*$/i.test(norm)) continue;

    // Song: number + C/K
    let work = line;
    const hintParts = [];
    let number = null;
    let language = null;

    const codeMatch = work.match(new RegExp(`^\\s*${HYMN_CODE.source}`, 'i'));
    if (codeMatch) {
      number = parseInt(codeMatch[1], 10);
      const L = codeMatch[2].toUpperCase();
      language = L === 'K' ? 'kichwa' : 'es';
      work = work.slice(codeMatch[0].length).trim();
    }

    // Trailing (181) as hymn number when no C/K
    if (number == null) {
      const tm = work.match(TRAILING_NUM_PARENS);
      if (tm) {
        number = parseInt(tm[1], 10);
        work = work.replace(TRAILING_NUM_PARENS, '').trim();
        if (language == null) language = 'es';
      }
    }

    // Trailing key like (Am) — goes to hint, not title
    const km = work.match(TRAILING_KEY_PARENS);
    if (km) {
      hintParts.push(km[1]);
      work = work.replace(TRAILING_KEY_PARENS, '').trim();
    }

    // Slash-separated mini-titles → multiple songs
    if (work.includes('/') && !/^https?:\/\//i.test(work)) {
      const parts = work.split(/\s*\/\s*/).map((p) => p.trim()).filter(Boolean);
      for (const part of parts) {
        const sub = parseSongFragment(part, number, language, hintParts);
        if (sub) items.push(sub);
        number = null;
        language = null;
      }
      continue;
    }

    const song = parseSongFragment(work, number, language, hintParts);
    if (song) {
      items.push(song);
      continue;
    }

    items.push({ kind: 'unknown', text: line });
  }

  return items;
}

/**
 * @param {string} work
 * @param {number|null} number
 * @param {'es'|'kichwa'|null} language
 * @param {string[]} hintParts
 * @returns {ParsedItem|null}
 */
function parseSongFragment(work, number, language, hintParts) {
  let w = work.replace(/^\d+\.\s*/, '').trim();

  // "158 fui liberado" / fragmentos con número al inicio (sin C/K en segunda palabra)
  if (number == null && w) {
    const mLead = w.match(/^(\d{1,4})\s+(.+)$/);
    if (mLead) {
      const restFirst = mLead[2].trim().split(/\s+/)[0] || '';
      if (!/^[CKck]\.?$/i.test(restFirst)) {
        number = parseInt(mLead[1], 10);
        w = mLead[2].trim();
      }
    }
  }

  // "535 kichuw" → número + kichwa (typo kichu)
  if (number == null && w) {
    const mk = w.match(/^(\d{1,4})\s+kichu?w?a?\b/i);
    if (mk) {
      number = parseInt(mk[1], 10);
      language = 'kichwa';
      w = w.slice(mk[0].length).trim();
    }
  }
  if (number == null && w) {
    const me = w.match(/^(\d{1,4})\s+(español|espanol)\b/i);
    if (me) {
      number = parseInt(me[1], 10);
      language = 'es';
      w = w.slice(me[0].length).trim();
    }
  }

  if (!w) {
    if (number != null) {
      return { kind: 'song', number, language, title: '', hint: hintParts.join(' ') || undefined };
    }
    return null;
  }

  // "copia", regional notes at end
  const lower = w.toLowerCase();
  const extraHints = [];
  if (/\bcopia\b/i.test(lower)) {
    extraHints.push('copia');
    w = w.replace(/\bcopia\b/gi, '').trim();
  }
  if (/\b(chimborazo|imbabura|coro|corito|coranido|coroznido)\b/i.test(w)) {
    const m = w.match(/\b(Chimborazo|Imbabura|coro[^,\s]*|corito|coranido|coroznido)\b/gi);
    if (m) extraHints.push(...m);
    w = w.replace(/\b(Chimborazo|Imbabura|coro[^,\s]*|corito|coranido|coroznido)\b/gi, '').trim();
  }

  // Strip trailing " - Lam Noe T" style credits (heuristic: long dash segments)
  w = w.replace(/\s+[-–—]\s+[^[\]()]+$/g, '').trim();

  const title = w.replace(/\s*\[[\s\u00a0]*\]\s*/g, '').trim();
  const hint = [...hintParts, ...extraHints].filter(Boolean).join(' ') || undefined;

  if (number != null || title) {
    return {
      kind: 'song',
      number: number ?? null,
      language: language ?? null,
      title: title || '',
      hint,
    };
  }
  return null;
}

/**
 * First header text suitable as culto name (Tema: ...)
 * @param {ParsedItem[]} items
 * @returns {string|null}
 */
export function extractSuggestedCultoName(items) {
  for (const it of items) {
    if (it.kind === 'header' && it.text) {
      const t = it.text.trim();
      if (t && !/melita|encargo|letras/i.test(t)) return t;
    }
  }
  return null;
}
