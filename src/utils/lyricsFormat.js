/**
 * Limpia marcas de repetición tipo himnario: cada bloque // ... // se convierte en
 * el texto interior (sin slashes) seguido de una copia del mismo bloque debajo.
 * Luego se eliminan // sueltos que hayan quedado.
 *
 * @param {string} text
 * @returns {string}
 */
export function cleanRepeatMarkers(text) {
  if (text == null || text === '') return '';
  let s = String(text).replace(/\r\n/g, '\n');
  if (!s.includes('//')) return s;

  const pairRe = /\/\/([\s\S]*?)\/\//g;
  s = s.replace(pairRe, (_, inner) => {
    const core = inner.replace(/^\s+|\s+$/g, '');
    if (!core) return '';
    return `${core}\n${core}`;
  });
  s = s.replace(/\/\//g, '');
  return s.replace(/\n{3,}/g, '\n\n').replace(/\s+$/m, '');
}

const SECTION_HEADER =
  /^(CORO|VERSO|VERSOS|SOLO|SOLISTA|ESTRIBILLO|PUENTE|INTRO|PUENTE MUSICAL)\s*$/i;

/** Sujeto al inicio de frase (Tú con tilde; sin "Tu" posesivo de "Tu amigo") */
const SUBJECT_FLUSH_BEFORE =
  /^(Él|Ella|Yo|Tú|Usted|Ustedes|Nosotros|Nosotras|Ellos|Ellas)$/i;

/** Nombre propio al final de línea de 4 palabras → nueva línea (p. ej. …mi / Jesús) */
const PROPER_LINE_END = /^(Jesús|Jesucristo|Dios|María|Cristo)$/i;

/** Partícula / posesivo al final: no partir "su luz", "el amor", etc. */
const WEAK_TAIL_WORD = /^(el|la|los|las|un|una|su|mis?|tus?|nuestros?|nuestras?|les|nos|me|te|lo|al|del)$/i;

function isLikelyLowercaseContinuation(w) {
  if (!w || !/^[\p{L}]/u.test(w)) return false;
  const c = w.codePointAt(0);
  const lower = String.fromCodePoint(c).toLowerCase();
  return String.fromCodePoint(c) === lower;
}

/** Clíticos al inicio de palabra (…Cristo / te libertará) */
const CLITIC_LINE_START = /^(te|me|le|nos|os|se)\b/i;

function stripTrailPunct(w) {
  return w.replace(/[.,;:!?¿¡]+$/g, '');
}

/**
 * Organiza letras en líneas cortas para karaoke (~3–4 palabras según longitud).
 *
 * @param {string} text
 * @param {{
 *   duplicateLines?: boolean,
 *   maxCharsSoft?: number,
 *   maxCharsHard?: number,
 * }} [options]
 * duplicateLines: por defecto false (una línea por slide; activar solo si se desea repetir cada línea).
 */
export function organizeKaraokeLines(text, options = {}) {
  const duplicateLines = options.duplicateLines === true;
  const maxCharsSoft = options.maxCharsSoft ?? 32;
  const maxCharsHard = options.maxCharsHard ?? 40;

  const body = String(text ?? '').replace(/\r\n/g, '\n').trimEnd();
  if (!body.trim()) return '';

  const stanzas = body.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const outStanzas = [];

  for (const stanza of stanzas) {
    const innerLines = stanza.split('\n').map((l) => l.trim()).filter(Boolean);
    if (innerLines.length === 1 && SECTION_HEADER.test(innerLines[0])) {
      outStanzas.push(innerLines[0]);
      continue;
    }
    const flow = innerLines.join(' ');
    const wrapped = processFlow(flow, { maxCharsSoft, maxCharsHard });
    outStanzas.push(wrapped.join('\n'));
  }

  let result = outStanzas.join('\n\n');

  if (duplicateLines) {
    const lines = result.split('\n');
    const out = [];
    for (const line of lines) {
      out.push(line);
      if (line.trim() && !SECTION_HEADER.test(line.trim()) && !/^solista\b/i.test(line.trim())) {
        out.push(line);
      }
    }
    result = out.join('\n');
  }

  return result.replace(/\n{3,}/g, '\n\n').trimEnd();
}

function normalizeSpaces(t) {
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} t
 * @returns {string[]}
 */
function splitSentences(t) {
  const s = normalizeSpaces(t);
  if (!s) return [];
  return s.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
}

/**
 * @param {string} sentence
 * @returns {string[]}
 */
function splitCommas(sentence) {
  if (!sentence.includes(',')) return [sentence];
  const raw = sentence.split(/,\s+/);
  return raw.map((part, i) => {
    const p = part.trim();
    if (i < raw.length - 1 && p && !p.endsWith(',')) return `${p},`;
    return p;
  }).filter(Boolean);
}

/**
 * @param {string} flow
 * @param {{ maxCharsSoft: number, maxCharsHard: number }} opts
 */
function processFlow(flow, opts) {
  const sentences = splitSentences(flow);
  const all = [];
  for (const sent of sentences) {
    for (const clause of splitCommas(sent)) {
      all.push(...wrapClause(clause, opts));
    }
  }
  return all;
}

/**
 * @param {string} clause
 * @param {{ maxCharsSoft: number, maxCharsHard: number }} opts
 */
function wrapClause(clause, opts) {
  const t = clause.trim();
  if (!t) return [];
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const { maxCharsSoft, maxCharsHard } = opts;
  const out = [];
  let buf = [];

  const lineLen = (arr) => arr.join(' ').length;
  const flush = () => {
    if (buf.length) {
      out.push(buf.join(' '));
      buf = [];
    }
  };

  const startsWithSubject = (arr) => arr.length && SUBJECT_FLUSH_BEFORE.test(arr[0]);

  /** Máx. palabras en la línea actual (5 si todo es corto y cabe en pantalla). */
  function maxWordsNow() {
    const joined = buf.join(' ');
    const len = joined.length;
    const n = buf.length;
    if (len > maxCharsHard) return n;
    if (len > maxCharsSoft && !shortWordsChunk(buf)) return Math.min(4, n);
    if (shortWordsChunk(buf) && len <= 36) return 5;
    return 4;
  }

  for (let j = 0; j < words.length; j++) {
    const w = words[j];

    if (buf.length === 4) {
      const last = stripTrailPunct(buf[buf.length - 1]);
      if (PROPER_LINE_END.test(last)) {
        flush();
      }
    }

    if (buf.length >= 4 && isLikelyLowercaseContinuation(w)) {
      const prev = buf[buf.length - 1] || '';
      const prevBare = stripTrailPunct(prev);
      const skipWeakTail =
        WEAK_TAIL_WORD.test(prevBare) && stripTrailPunct(w).length <= 7;
      if (!prev.endsWith(',') && !prev.endsWith('.') && !skipWeakTail) {
        flush();
      }
    }

    if (buf.length && SUBJECT_FLUSH_BEFORE.test(w)) {
      flush();
    }

    if (buf.length === 3 && startsWithSubject(buf)) {
      flush();
    }

    // "…más / ya en…" (segunda estrofa con "ya")
    if (
      buf.length >= 2 &&
      /^ya$/i.test(w) &&
      stripTrailPunct(buf[buf.length - 1]).toLowerCase() === 'más'
    ) {
      flush();
    }

    // Nueva cláusula con "y …" tras un trozo ya largo
    if (buf.length >= 2 && /^y$/i.test(w) && lineLen(buf) >= 14) {
      flush();
    }

    // "…Cristo / te libertará", "…día / me libertó"
    if (buf.length >= 3 && CLITIC_LINE_START.test(w)) {
      flush();
    }

    if (buf.length >= 2 && /^así$/i.test(w) && lineLen(buf) >= 12) {
      flush();
    }

    if (buf.length) {
      const trial = [...buf, w];
      const len = lineLen(trial);
      if (buf.length >= 3 && len > maxCharsHard) {
        flush();
      } else if (buf.length >= 3 && len > maxCharsSoft && !shortWordsChunk(trial)) {
        flush();
      }
    }

    buf.push(w);

    const joined = buf.join(' ');
    if (w.endsWith(',')) {
      flush();
      continue;
    }

    const maxW = maxWordsNow();
    if (buf.length >= maxW) {
      flush();
      continue;
    }

    if (buf.length >= 3) {
      if (joined.length >= maxCharsSoft && !shortWordsChunk(buf)) {
        flush();
        continue;
      }
      if (joined.length >= maxCharsHard) {
        flush();
      }
    }
  }
  flush();
  return out;
}

/**
 * @param {string[]} arr
 */
function shortWordsChunk(arr) {
  if (arr.length < 3) return true;
  const avg =
    arr.reduce((a, w) => a + w.replace(/[.,;:!?¿¡]/g, '').length, 0) / arr.length;
  return avg <= 4.5;
}
