import { useState, useEffect } from 'react';
import { getSong, getSongLines, createSong, updateSong, setSongLines } from '../../db/database';

const DEFAULT_COLOR = '#1e1b4b';

function KaraokePreview({ lines, activeIdx }) {
  const prev = lines[activeIdx - 1] || '';
  const active = lines[activeIdx] || '';
  const next = lines[activeIdx + 1] || '';

  return (
    <div className="rounded-lg p-6 flex flex-col items-center justify-center gap-3 min-h-[140px] text-center"
         style={{ backgroundColor: '#111827' }}>
      <p className="text-gray-500 text-sm">{prev || '\u00a0'}</p>
      <p className="text-white text-xl font-bold">{active || '\u00a0'}</p>
      <p className="text-gray-500 text-sm">{next || '\u00a0'}</p>
    </div>
  );
}

export default function SongEditor({ songId, onSaved, onCancel, initialData }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [linesText, setLinesText] = useState('');
  const [previewIdx, setPreviewIdx] = useState(0);

  useEffect(() => {
    if (songId) {
      const song = getSong(songId);
      if (song) {
        setTitle(song.title);
        setArtist(song.artist || '');
        setColor(song.suggested_color || DEFAULT_COLOR);
        const lines = getSongLines(songId);
        setLinesText(lines.map((l) => l.text).join('\n'));
      }
    } else if (initialData) {
      setTitle(initialData.title);
      setArtist(initialData.artist || '');
      setLinesText(initialData.linesText || '');
      setPreviewIdx(0);
    }
  }, [songId, initialData]);

  const lines = linesText.split('\n');

  function handleSave() {
    if (!title.trim()) return;
    if (songId) {
      updateSong(songId, { title, artist, suggested_color: color });
      setSongLines(songId, lines);
    } else {
      const newId = createSong({ title, artist, suggested_color: color });
      setSongLines(newId, lines);
    }
    onSaved();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Título *</label>
          <input
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre de la canción"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Artista</label>
          <input
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      {/* <div>
        <label className="block text-sm text-gray-400 mb-1">Color de fondo sugerido</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
          <span className="text-gray-400 text-sm">{color}</span>
        </div>
      </div> */}

      <div>
        <label className="block text-sm text-gray-400 mb-1">
          Letras <span className="text-gray-500">(una línea por fila)</span>
        </label>
        <textarea
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500 resize-none"
          rows={12}
          value={linesText}
          onChange={(e) => {
            setLinesText(e.target.value);
            setPreviewIdx(0);
          }}
          placeholder="Santo, santo, santo&#10;Es el Señor de luz&#10;Venimos a adorar..."
        />
      </div>

      {lines.some((l) => l.trim()) && (
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Vista previa karaoke
            <span className="text-gray-500 ml-2">(línea {previewIdx + 1} de {lines.length})</span>
          </label>
          <KaraokePreview lines={lines} activeIdx={previewIdx} />
          <div className="flex gap-2 mt-2">
            <button
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-40"
              onClick={() => setPreviewIdx((i) => Math.max(0, i - 1))}
              disabled={previewIdx === 0}
            >
              ← Anterior
            </button>
            <button
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-40"
              onClick={() => setPreviewIdx((i) => Math.min(lines.length - 1, i + 1))}
              disabled={previewIdx >= lines.length - 1}
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium disabled:opacity-40"
          onClick={handleSave}
          disabled={!title.trim()}
        >
          {songId ? 'Guardar cambios' : 'Agregar canción'}
        </button>
        <button
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
