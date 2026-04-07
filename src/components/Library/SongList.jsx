import { useState, useEffect } from 'react';
import { getSongs, deleteSong, getSongLines } from '../../db/database';

export default function SongList({ onEdit, refreshKey }) {
  const [search, setSearch] = useState('');
  const [songs, setSongs] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedLines, setExpandedLines] = useState([]);

  useEffect(() => {
    setSongs(getSongs(search));
  }, [search, refreshKey]);

  function handleExpand(song) {
    if (expandedId === song.id) {
      setExpandedId(null);
    } else {
      setExpandedId(song.id);
      setExpandedLines(getSongLines(song.id));
    }
  }

  function handleDelete(id) {
    if (confirm('¿Eliminar esta canción?')) {
      deleteSong(id);
      setSongs(getSongs(search));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
        placeholder="Buscar por título o artista..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {songs.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          {search ? 'No se encontraron canciones.' : 'No hay canciones. Agrega una para comenzar.'}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {songs.map((song) => (
          <div key={song.id} className="bg-gray-700 rounded-lg overflow-hidden">
            <div className="flex items-center px-4 py-3 gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: song.suggested_color || '#1e1b4b' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{song.title}</p>
                {song.artist && (
                  <p className="text-gray-400 text-sm truncate">{song.artist}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-500 rounded"
                  onClick={() => handleExpand(song)}
                >
                  {expandedId === song.id ? 'Ocultar' : 'Ver letras'}
                </button>
                <button
                  className="px-3 py-1 text-xs bg-indigo-700 hover:bg-indigo-600 rounded"
                  onClick={() => onEdit(song.id)}
                >
                  Editar
                </button>
                <button
                  className="px-3 py-1 text-xs bg-red-800 hover:bg-red-700 rounded"
                  onClick={() => handleDelete(song.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>

            {expandedId === song.id && (
              <div className="border-t border-gray-600 px-4 py-3 bg-gray-800">
                {expandedLines.length === 0 ? (
                  <p className="text-gray-500 text-sm">Sin letras cargadas.</p>
                ) : (
                  <ol className="list-decimal list-inside space-y-1">
                    {expandedLines.map((line) => (
                      <li key={line.id} className="text-gray-300 text-sm">
                        {line.text}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
