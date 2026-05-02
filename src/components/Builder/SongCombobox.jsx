import { useState, useEffect, useRef, useMemo } from 'react';
import { getSong, getSongs } from '../../db/database';

function formatSong(s) {
  if (!s) return '';
  return `${s.title}${s.artist ? ` — ${s.artist}` : ''}`;
}

function norm(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Buscador de canción: un solo input; la lista de coincidencias solo se muestra al escribir o al enfocar.
 *
 * @param {{
 *   songId: number | null,
 *   label?: string,
 *   onCommit: (p: { song_id: number | null; label: string }) => void,
 *   inputClassName?: string,
 *   labelText?: string,
 * }} props
 * `label` se usa como texto inicial si no hay canción (p. ej. import vacío). Al elegir canción se envía `label` = título.
 */
export default function SongCombobox({
  songId,
  label = '',
  onCommit,
  inputClassName = '',
  labelText = 'Canción',
}) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const s = songId != null ? getSong(songId) : null;
    if (s) setDraft(formatSong(s));
    else setDraft(label || '');
  }, [songId, label]);

  const matches = useMemo(() => getSongs(draft.trim()).slice(0, 50), [draft]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function commitClear() {
    const t = draft.trim();
    onCommit({ song_id: null, label: t });
    setOpen(false);
  }

  function commitPick(s) {
    onCommit({ song_id: s.id, label: s.title });
    setDraft(formatSong(s));
    setOpen(false);
  }

  function handleBlur() {
    window.setTimeout(() => {
      setOpen(false);
      const s = songId != null ? getSong(songId) : null;
      const t = draft.trim();
      if (songId != null && s) {
        if (norm(draft) !== norm(formatSong(s))) {
          onCommit({ song_id: null, label: t });
        }
      } else if (t !== (label || '').trim()) {
        onCommit({ song_id: null, label: t });
      }
    }, 160);
  }

  const baseInput =
    'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500';

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-xs text-gray-400 mb-1">{labelText}</label>
      <input
        type="text"
        autoComplete="off"
        className={`${baseInput} ${inputClassName}`}
        value={draft}
        placeholder="Buscar en librería…"
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
      />
      {open && (
        <div className="absolute z-[70] left-0 right-0 mt-1 max-h-44 overflow-y-auto flex flex-col gap-0.5 rounded-lg border border-gray-600 bg-gray-800 py-1 shadow-xl">
          <button
            type="button"
            className="text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-700"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => commitClear()}
          >
            (Sin asignar)
          </button>
          {draft.trim().length >= 1 &&
            matches.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`text-left px-3 py-2 text-sm hover:bg-gray-700 ${
                  songId === s.id ? 'bg-indigo-900/50 text-white' : 'text-gray-200'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitPick(s)}
              >
                {formatSong(s)}
              </button>
            ))}
          {draft.trim().length >= 1 && matches.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-500">Sin coincidencias</p>
          )}
          {draft.trim().length === 0 && (
            <p className="px-3 py-1.5 text-xs text-gray-500 border-t border-gray-700">
              Escribí para ver coincidencias en la librería
            </p>
          )}
        </div>
      )}
    </div>
  );
}
