import initSqlJs from 'sql.js';
import { SCHEMA } from './schema';

const STORAGE_KEY = 'culto_db';

let db = null;

function saveToStorage() {
  const data = db.export();
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < data.length; i += CHUNK) {
    binary += String.fromCharCode(...data.subarray(i, i + CHUNK));
  }
  localStorage.setItem(STORAGE_KEY, btoa(binary));
}

export async function initDB() {
  if (db) return db;

  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  });

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const binary = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
    db = new SQL.Database(binary);
  } else {
    db = new SQL.Database();
  }

  // Migration: remove CHECK constraint on slots.type to support 'image' type
  try {
    const res = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='slots'");
    if (res.length && res[0].values[0][0].includes('CHECK(type IN')) {
      db.run(`CREATE TABLE slots_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        culto_id INTEGER NOT NULL REFERENCES cultos(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        song_id INTEGER REFERENCES songs(id),
        content TEXT
      )`);
      db.run(`INSERT INTO slots_new SELECT * FROM slots`);
      db.run(`DROP TABLE slots`);
      db.run(`ALTER TABLE slots_new RENAME TO slots`);
      saveToStorage();
    }
  } catch (e) {}

  db.run(SCHEMA);
  return db;
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveToStorage();
}

function runInsert(sql, params = []) {
  db.run(sql, params);
  const id = query(`SELECT last_insert_rowid() as id`)[0].id;
  saveToStorage();
  return id;
}

// ── Songs ──────────────────────────────────────────────────────────────────

export function getSongs(search = '') {
  if (search.trim()) {
    return query(
      `SELECT * FROM songs WHERE title LIKE ? OR artist LIKE ? ORDER BY title`,
      [`%${search}%`, `%${search}%`]
    );
  }
  return query(`SELECT * FROM songs ORDER BY title`);
}

export function getSong(id) {
  return query(`SELECT * FROM songs WHERE id = ?`, [id])[0] || null;
}

export function createSong({ title, artist = '', suggested_color = '#1e1b4b' }) {
  return runInsert(`INSERT INTO songs (title, artist, suggested_color) VALUES (?, ?, ?)`, [
    title,
    artist,
    suggested_color,
  ]);
}

export function updateSong(id, { title, artist, suggested_color }) {
  run(
    `UPDATE songs SET title = ?, artist = ?, suggested_color = ? WHERE id = ?`,
    [title, artist, suggested_color, id]
  );
}

export function deleteSong(id) {
  run(`DELETE FROM songs WHERE id = ?`, [id]);
}

// ── Song Lines ─────────────────────────────────────────────────────────────

export function getSongLines(songId) {
  return query(
    `SELECT * FROM song_lines WHERE song_id = ? ORDER BY line_number`,
    [songId]
  );
}

export function setSongLines(songId, lines) {
  run(`DELETE FROM song_lines WHERE song_id = ?`, [songId]);
  lines.forEach((text, i) => {
    if (text.trim()) {
      run(
        `INSERT INTO song_lines (song_id, line_number, text) VALUES (?, ?, ?)`,
        [songId, i, text]
      );
    }
  });
}

// ── Cultos ─────────────────────────────────────────────────────────────────

export function getCultos() {
  return query(`SELECT * FROM cultos ORDER BY date DESC, id DESC`);
}

export function getCulto(id) {
  return query(`SELECT * FROM cultos WHERE id = ?`, [id])[0] || null;
}

export function createCulto({ name, date = '', background_color = '#1e1b4b' }) {
  return runInsert(`INSERT INTO cultos (name, date, background_color) VALUES (?, ?, ?)`, [
    name,
    date,
    background_color,
  ]);
}

export function updateCulto(id, { name, date, background_color }) {
  run(
    `UPDATE cultos SET name = ?, date = ?, background_color = ? WHERE id = ?`,
    [name, date, background_color, id]
  );
}

export function deleteCulto(id) {
  run(`DELETE FROM cultos WHERE id = ?`, [id]);
}

// ── Slots ──────────────────────────────────────────────────────────────────

export function getSlots(cultoId) {
  return query(
    `SELECT s.*, sg.title as song_title FROM slots s
     LEFT JOIN songs sg ON s.song_id = sg.id
     WHERE s.culto_id = ? ORDER BY s.position`,
    [cultoId]
  );
}

export function createSlot({ culto_id, position, type, label, song_id = null, content = '' }) {
  return runInsert(
    `INSERT INTO slots (culto_id, position, type, label, song_id, content) VALUES (?, ?, ?, ?, ?, ?)`,
    [culto_id, position, type, label, song_id, content]
  );
}

export function updateSlot(id, { position, type, label, song_id, content }) {
  run(
    `UPDATE slots SET position = ?, type = ?, label = ?, song_id = ?, content = ? WHERE id = ?`,
    [position, type, label, song_id ?? null, content ?? '', id]
  );
}

export function deleteSlot(id) {
  run(`DELETE FROM slots WHERE id = ?`, [id]);
}

export function reorderSlots(cultoId, orderedIds) {
  orderedIds.forEach((id, i) => {
    db.run(`UPDATE slots SET position = ? WHERE id = ? AND culto_id = ?`, [i, id, cultoId]);
  });
  saveToStorage();
}
