const PROXY = 'https://corsproxy.io/?url=';
const BASE = 'https://himnario.kichwamusic.com';

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
    return [{ title, url: a.href }];
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
