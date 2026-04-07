import { useState, useEffect } from 'react';
import { initDB } from '../db/database';

let dbReady = false;
const listeners = new Set();

initDB().then(() => {
  dbReady = true;
  listeners.forEach((fn) => fn());
});

export function useDB() {
  const [ready, setReady] = useState(dbReady);

  useEffect(() => {
    if (dbReady) return;
    const handler = () => setReady(true);
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  return ready;
}
