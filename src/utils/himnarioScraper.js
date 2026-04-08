const PROXY = 'https://corsproxy.io/?url=';
const BASE = 'https://himnario.kichwamusic.com';

const VOWELS = /[aeiouáéíóúüñ]/g;

/**
 * Returns true if `term` looks like a real word (not gibberish).
 * Rules (all must pass):
 *  1. Trimmed length >= 4
 *  2. Contains at least one vowel (Spanish/Kichwa set)
 *  3. Vowel-to-non-space-char ratio >= 30 %
 *  4. No run of 3+ identical consecutive characters (aaaa, ssss…)
 */
export function isValidSearchTerm(term) {
  const s = term.trim().toLowerCase();
  if (s.length < 4) return false;

  const nonSpace = s.replace(/\s+/g, '');
  const vowelCount = (nonSpace.match(VOWELS) || []).length;

  if (vowelCount === 0) return false;
  if (vowelCount / nonSpace.length < 0.30) return false;
  if (/(.)\1{2,}/.test(s)) return false;

  return true;
}

export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchHimnario(term) {
  const url = `${BASE}/search?q=${encodeURIComponent(term)}`;
  const res = await fetch(`${PROXY}${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('article')].flatMap((article) => {
    const a = article.querySelector('a[href*="kichwamusic"]');
    const titleEl = article.querySelector('.post-title, h2, h3');
    const title = titleEl?.textContent?.trim();
    if (!a || !title) return [];
    const entry = article.querySelector('.post-entry');
    const preview = entry?.textContent?.trim() ?? '';
    return [{ title, url: a.href, preview }];
  });
}

export async function fetchHimnarioDetail(url) {
  const res = await fetch(`${PROXY}${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const title =
    doc.querySelector('.post-title, h1, h2')?.textContent?.trim() ?? '';
  const artist =
    doc
      .querySelector('.post-author, .post-authorName, [itemprop="author"]')
      ?.textContent?.trim() ?? '';
  const linesText = [
    ...doc.querySelectorAll('.post-entry p, .entry-content p'),
  ]
    .map((p) => p.textContent.trim())
    .filter(Boolean)
    .join('\n');

  if (!title) throw new Error('No se pudo parsear el título de la canción');
  return { title, artist, linesText };
}
