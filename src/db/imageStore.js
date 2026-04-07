import { openDB } from 'idb';

const DB_NAME = 'culto_images';
const STORE = 'images';

function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE);
    },
  });
}

export async function saveImage(key, blob) {
  const db = await getDB();
  await db.put(STORE, blob, key);
}

export async function getImageUrl(key) {
  if (!key) return null;
  const db = await getDB();
  const blob = await db.get(STORE, key);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function deleteImage(key) {
  if (!key) return;
  const db = await getDB();
  await db.delete(STORE, key);
}
